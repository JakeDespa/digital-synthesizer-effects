from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path

import customtkinter as ctk
import mido
import numpy as np
import sounddevice as sd
from scipy.signal import butter, sosfilt
from tkinter import Canvas, filedialog, messagebox


SAMPLE_RATE = 44100
MAX_HARMONICS = 256
DEFAULT_DURATION = 2.5
MAX_FILTER_CUTOFF = 5000.0


@dataclass
class MidiNote:
    start: float
    duration: float
    note: int
    velocity: int
    program: int
    channel: int


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def midi_note_to_frequency(note_number: int, transpose_semitones: int = 0) -> float:
    adjusted_note = note_number + transpose_semitones
    return 440.0 * (2.0 ** ((adjusted_note - 69) / 12.0))


def waveform_from_program(program_number: int) -> str:
    if program_number <= 15:
        return "triangle"
    if program_number <= 39:
        return "sawtooth"
    if program_number <= 63:
        return "square"
    if program_number <= 95:
        return "triangle"
    if program_number <= 111:
        return "sine"
    return "sawtooth"


def apply_envelope(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    if audio.size == 0:
        return audio

    fade_samples = max(1, int(0.01 * sample_rate))
    fade_samples = min(fade_samples, audio.size)
    envelope = np.ones_like(audio)
    envelope[:fade_samples] = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
    envelope[-fade_samples:] = np.minimum(envelope[-fade_samples:], np.linspace(1.0, 0.0, fade_samples, dtype=np.float32))
    return audio * envelope


def generate_periodic_wave(
    frequency: float,
    duration: float,
    harmonics: int,
    waveform: str,
    sample_rate: int,
) -> np.ndarray:
    sample_count = max(1, int(duration * sample_rate))
    time = np.arange(sample_count, dtype=np.float32) / sample_rate
    phase = 2.0 * np.pi * frequency * time
    harmonics = max(1, min(MAX_HARMONICS, int(harmonics)))

    if waveform == "sine":
        wave = np.sin(phase)
    elif waveform == "square":
        wave = np.zeros_like(phase)
        for harmonic in range(1, harmonics + 1, 2):
            wave += np.sin(harmonic * phase) / harmonic
        wave *= 4.0 / np.pi
    elif waveform == "sawtooth":
        wave = np.zeros_like(phase)
        for harmonic in range(1, harmonics + 1):
            wave += ((-1) ** (harmonic + 1)) * np.sin(harmonic * phase) / harmonic
        wave *= 2.0 / np.pi
    elif waveform == "triangle":
        wave = np.zeros_like(phase)
        odd_index = 0
        for harmonic in range(1, harmonics + 1, 2):
            sign = 1.0 if odd_index % 2 == 0 else -1.0
            wave += sign * np.sin(harmonic * phase) / (harmonic * harmonic)
            odd_index += 1
        wave *= 8.0 / (np.pi * np.pi)
    else:
        wave = np.sin(phase)

    return wave.astype(np.float32)


def apply_echo(audio: np.ndarray, depth: float, sample_rate: int) -> np.ndarray:
    if audio.size == 0:
        return audio

    depth = clamp(depth, 0.0, 1.0)
    delay_samples = int(0.4 * sample_rate)
    wet = np.array(audio, copy=True)

    if delay_samples < audio.size:
        wet[delay_samples:] += 0.75 * audio[:-delay_samples]

    dry_gain = (1.0 - depth) * 0.9
    wet_gain = depth
    return (dry_gain * audio) + (wet_gain * wet)


def apply_low_pass_filter(audio: np.ndarray, cutoff_hz: float, sample_rate: int) -> np.ndarray:
    cutoff_hz = clamp(cutoff_hz, 20.0, min(MAX_FILTER_CUTOFF, sample_rate / 2.0 - 100.0))
    normalized = cutoff_hz / (sample_rate / 2.0)
    sos = butter(2, normalized, btype="low", output="sos")
    return sosfilt(sos, audio).astype(np.float32)


def normalize_audio(audio: np.ndarray) -> np.ndarray:
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak <= 0.0:
        return audio.astype(np.float32)
    return (audio / peak * 0.95).astype(np.float32)


def render_note(
    frequency: float,
    duration: float,
    waveform: str,
    harmonics: int,
    sample_rate: int,
    velocity: float,
) -> np.ndarray:
    samples = max(1, int(duration * sample_rate))
    wave = generate_periodic_wave(frequency, duration, harmonics, waveform, sample_rate)
    wave = apply_envelope(wave, sample_rate)
    return (wave[:samples] * velocity * 0.9).astype(np.float32)


def parse_midi_file(path: Path) -> list[MidiNote]:
    midi_file = mido.MidiFile(path)
    current_tempo = 500000
    current_seconds = 0.0
    channel_programs: dict[int, int] = {}
    active_notes: dict[tuple[int, int], tuple[float, int, int]] = {}
    notes: list[MidiNote] = []

    for message in mido.merge_tracks(midi_file.tracks):
        current_seconds += mido.tick2second(message.time, midi_file.ticks_per_beat, current_tempo)

        if message.type == "set_tempo":
            current_tempo = message.tempo
            continue

        if message.type == "program_change":
            channel_programs[message.channel] = message.program
            continue

        if message.type == "note_on" and message.velocity > 0:
            key = (message.channel, message.note)
            active_notes[key] = (
                current_seconds,
                message.velocity,
                channel_programs.get(message.channel, 0),
            )
            continue

        if message.type in {"note_off", "note_on"}:
            if message.type == "note_on" and message.velocity > 0:
                continue

            key = (message.channel, message.note)
            if key not in active_notes:
                continue

            start_time, velocity, program = active_notes.pop(key)
            notes.append(
                MidiNote(
                    start=start_time,
                    duration=max(0.05, current_seconds - start_time),
                    note=message.note,
                    velocity=velocity,
                    program=program,
                    channel=message.channel,
                )
            )

    return sorted(notes, key=lambda note: note.start)


def render_midi_audio(
    path: Path,
    transpose_semitones: int,
    midi_wave_type: str,
    playback_speed: float,
    harmonics: int,
    echo_depth: float,
    filter_cutoff: float,
    sample_rate: int,
) -> np.ndarray:
    notes = parse_midi_file(path)
    if not notes:
        raise ValueError("No playable notes were found in the MIDI file")

    playback_speed = clamp(playback_speed, 0.5, 2.0)
    total_duration = max((note.start + note.duration) for note in notes) / playback_speed + 1.0
    total_samples = max(1, int(total_duration * sample_rate))
    audio = np.zeros(total_samples, dtype=np.float32)

    for note in notes:
        start_time = note.start / playback_speed
        note_duration = note.duration / playback_speed
        start_sample = int(start_time * sample_rate)
        note_samples = max(1, int(note_duration * sample_rate))
        frequency = midi_note_to_frequency(note.note, transpose_semitones)
        waveform = midi_wave_type if midi_wave_type != "original" else waveform_from_program(note.program)
        segment = render_note(
            frequency=frequency,
            duration=note_samples / sample_rate,
            waveform=waveform,
            harmonics=harmonics,
            sample_rate=sample_rate,
            velocity=note.velocity / 127.0,
        )

        end_sample = min(total_samples, start_sample + segment.size)
        if end_sample > start_sample:
            audio[start_sample:end_sample] += segment[: end_sample - start_sample]

    audio = apply_echo(audio, echo_depth, sample_rate)
    audio = apply_low_pass_filter(audio, filter_cutoff, sample_rate)
    audio = normalize_audio(audio)
    return np.clip(audio * 0.75, -1.0, 1.0).astype(np.float32)


def render_synth_audio(
    frequency: float,
    harmonics: int,
    wave_type: str,
    echo_depth: float,
    filter_cutoff: float,
    sample_rate: int,
    duration: float = DEFAULT_DURATION,
) -> np.ndarray:
    base = generate_periodic_wave(frequency, duration, harmonics, wave_type, sample_rate)
    base = apply_envelope(base, sample_rate)
    audio = apply_echo(base, echo_depth, sample_rate)
    audio = apply_low_pass_filter(audio, filter_cutoff, sample_rate)
    audio = normalize_audio(audio)
    return np.clip(audio * 0.75, -1.0, 1.0).astype(np.float32)


class SynthApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        self.title("Digital Synthesizer - Python Port")
        self.geometry("1320x860")
        self.minsize(1180, 760)

        self.midi_file_path: Path | None = None
        self.current_playback_thread: threading.Thread | None = None
        self.is_playing = False
        self.loaded_midi_notes: list[MidiNote] = []
        self.midi_song_duration: float = 0.0
        self.midi_playback_started_at: float | None = None
        self.midi_playback_progress: float = 0.0
        self.midi_playback_active = False

        self.frequency_var = ctk.DoubleVar(value=440.0)
        self.harmonics_var = ctk.IntVar(value=32)
        self.wave_type_var = ctk.StringVar(value="square")
        self.filter_cutoff_var = ctk.DoubleVar(value=5000.0)
        self.echo_depth_var = ctk.DoubleVar(value=0.7)
        self.transpose_var = ctk.IntVar(value=0)
        self.playback_speed_var = ctk.DoubleVar(value=1.0)
        self.midi_wave_type_var = ctk.StringVar(value="original")
        self.status_var = ctk.StringVar(value="Ready")
        self.midi_label_var = ctk.StringVar(value="No MIDI file loaded")
        self.midi_preview_var = ctk.StringVar(value="Instrument preview: original")

        self._build_layout()
        self._refresh_filter_visual()
        self._refresh_midi_visual()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_layout(self) -> None:
        container = ctk.CTkScrollableFrame(self, fg_color="#0b1024")
        container.pack(fill="both", expand=True, padx=18, pady=18)

        header = ctk.CTkFrame(container, fg_color="#11172f", corner_radius=18)
        header.pack(fill="x", pady=(0, 16))

        ctk.CTkLabel(
            header,
            text="DIGITAL SYNTHESIZER",
            font=ctk.CTkFont(size=30, weight="bold"),
        ).pack(anchor="w", padx=20, pady=(18, 4))

        ctk.CTkLabel(
            header,
            text="Fourier synthesis • echo convolution • low-pass filtering • MIDI sequencing",
            text_color="#7ed9ff",
        ).pack(anchor="w", padx=20, pady=(0, 8))

        ctk.CTkLabel(header, textvariable=self.status_var, text_color="#f5d76e").pack(anchor="w", padx=20, pady=(0, 16))

        grid = ctk.CTkFrame(container, fg_color="transparent")
        grid.pack(fill="both", expand=True)
        grid.grid_columnconfigure((0, 1), weight=1, uniform="panel")
        grid.grid_rowconfigure((0, 1), weight=1)

        self._build_synth_panel(grid).grid(row=0, column=0, padx=(0, 10), pady=(0, 10), sticky="nsew")
        self._build_effects_panel(grid).grid(row=0, column=1, padx=(10, 0), pady=(0, 10), sticky="nsew")
        self._build_filter_panel(grid).grid(row=1, column=0, padx=(0, 10), pady=(10, 0), sticky="nsew")
        self._build_midi_panel(grid).grid(row=1, column=1, padx=(10, 0), pady=(10, 0), sticky="nsew")

    def _panel(self, parent: ctk.CTkFrame, title: str) -> ctk.CTkFrame:
        frame = ctk.CTkFrame(parent, fg_color="#11172f", corner_radius=18)
        ctk.CTkLabel(frame, text=title, font=ctk.CTkFont(size=20, weight="bold"), text_color="#7ed9ff").pack(
            anchor="w", padx=18, pady=(16, 12)
        )
        return frame

    def _slider_row(
        self,
        parent: ctk.CTkFrame,
        label: str,
        variable,
        from_: float,
        to: float,
        command,
        number_of_steps: int | None = None,
        suffix: str = "",
    ) -> None:
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x", padx=18, pady=(0, 12))
        title_row = ctk.CTkFrame(row, fg_color="transparent")
        title_row.pack(fill="x")
        ctk.CTkLabel(title_row, text=label.upper(), text_color="#9edcff", anchor="w").pack(side="left")
        value_label = ctk.CTkLabel(title_row, text=self._format_value(variable.get(), suffix), text_color="#f5d76e")
        value_label.pack(side="right")

        def on_change(value: str) -> None:
            if isinstance(variable, ctk.IntVar):
                variable.set(int(float(value)))
            else:
                variable.set(float(value))
            value_label.configure(text=self._format_value(variable.get(), suffix))
            if command:
                command(variable.get())

        ctk.CTkSlider(row, from_=from_, to=to, number_of_steps=number_of_steps, command=on_change).pack(fill="x", pady=(6, 0))

    def _format_value(self, value: float | int, suffix: str) -> str:
        if suffix == "Hz":
            return f"{float(value):.0f} Hz"
        if suffix == "semitones":
            return f"{int(value):+d} semitones"
        if suffix == "x":
            return f"{float(value):.1f}x"
        if suffix:
            return f"{float(value):.2f} {suffix}"
        if isinstance(value, float) and not float(value).is_integer():
            return f"{float(value):.2f}"
        return str(int(value))

    def _build_synth_panel(self, parent: ctk.CTkFrame) -> ctk.CTkFrame:
        frame = self._panel(parent, "SYNTHESIZER")

        actions = ctk.CTkFrame(frame, fg_color="transparent")
        actions.pack(fill="x", padx=18, pady=(0, 14))
        ctk.CTkButton(actions, text="PLAY", command=self.play_synth, fg_color="#19c5ff", hover_color="#11a2d4").pack(
            side="left", expand=True, fill="x", padx=(0, 8)
        )
        ctk.CTkButton(actions, text="STOP", command=self.stop_audio, fg_color="#ff5f8a", hover_color="#d94672").pack(
            side="left", expand=True, fill="x", padx=(8, 0)
        )

        self._slider_row(frame, "Frequency", self.frequency_var, 20, 1000, self._on_frequency_change, 980, "Hz")
        self._slider_row(frame, "Harmonics", self.harmonics_var, 2, MAX_HARMONICS, self._on_harmonics_change, MAX_HARMONICS - 2)

        choice_row = ctk.CTkFrame(frame, fg_color="transparent")
        choice_row.pack(fill="x", padx=18, pady=(0, 12))
        ctk.CTkLabel(choice_row, text="WAVEFORM TYPE", text_color="#9edcff", anchor="w").pack(anchor="w")
        ctk.CTkOptionMenu(
            choice_row,
            values=["square", "sawtooth", "sine"],
            variable=self.wave_type_var,
            command=self._on_wave_type_change,
        ).pack(fill="x", pady=(8, 0))

        meter = ctk.CTkFrame(frame, fg_color="#0c152f", corner_radius=14)
        meter.pack(fill="x", padx=18, pady=(0, 18))
        self.play_status_label = ctk.CTkLabel(meter, text="Idle", text_color="#89f7ae")
        self.play_status_label.pack(padx=14, pady=14)
        return frame

    def _build_effects_panel(self, parent: ctk.CTkFrame) -> ctk.CTkFrame:
        frame = self._panel(parent, "EFFECTS")
        self._slider_row(frame, "Echo Depth", self.echo_depth_var, 0.0, 1.0, self._on_echo_depth_change, 100)

        info = ctk.CTkTextbox(frame, height=140, fg_color="#0c152f", corner_radius=14, wrap="word")
        info.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        info.insert(
            "1.0",
            "LTI convolution: y[n] = x[n] + 0.5·x[n-4]\n\n"
            "The Python port models the 400 ms delay with a delayed tap and mixes wet/dry signal based on the echo depth slider.",
        )
        info.configure(state="disabled")
        return frame

    def _build_filter_panel(self, parent: ctk.CTkFrame) -> ctk.CTkFrame:
        frame = self._panel(parent, "FILTERING")
        self._slider_row(frame, "Cutoff Frequency", self.filter_cutoff_var, 20, MAX_FILTER_CUTOFF, self._on_cutoff_change, int(MAX_FILTER_CUTOFF - 20), "Hz")

        input_row = ctk.CTkFrame(frame, fg_color="transparent")
        input_row.pack(fill="x", padx=18, pady=(0, 12))
        ctk.CTkLabel(input_row, text="MANUAL INPUT", text_color="#9edcff", anchor="w").pack(anchor="w")
        
        def on_input_enter(value: str) -> None:
            try:
                cutoff = float(value)
                cutoff = max(20.0, min(MAX_FILTER_CUTOFF, cutoff))
                self.filter_cutoff_var.set(cutoff)
                self._refresh_filter_visual()
            except ValueError:
                pass
            self.cutoff_input.delete(0, "end")
            self.cutoff_input.insert(0, f"{float(self.filter_cutoff_var.get()):.0f}")
        
        self.cutoff_input = ctk.CTkEntry(input_row, placeholder_text="Enter Hz value")
        self.cutoff_input.pack(fill="x", pady=(8, 0))
        self.cutoff_input.insert(0, f"{float(self.filter_cutoff_var.get()):.0f}")
        self.cutoff_input.bind("<Return>", lambda _e: on_input_enter(self.cutoff_input.get()))

        response = ctk.CTkFrame(frame, fg_color="#0c152f", corner_radius=14)
        response.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        ctk.CTkLabel(response, text="Live low-pass response", text_color="#9edcff").pack(anchor="w", padx=14, pady=(12, 8))
        self.filter_visual = Canvas(response, height=220, highlightthickness=0, bg="#0c152f")
        self.filter_visual.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self.filter_visual.bind("<Configure>", lambda _event: self._refresh_filter_visual())
        return frame

    def _build_midi_panel(self, parent: ctk.CTkFrame) -> ctk.CTkFrame:
        frame = self._panel(parent, "MIDI SEQUENCER")

        upload_row = ctk.CTkFrame(frame, fg_color="transparent")
        upload_row.pack(fill="x", padx=18, pady=(0, 14))
        ctk.CTkButton(upload_row, text="LOAD MIDI FILE", command=self.load_midi_file).pack(fill="x")
        ctk.CTkLabel(upload_row, textvariable=self.midi_label_var, wraplength=450, text_color="#8fd3ff").pack(
            anchor="w", pady=(10, 0)
        )

        actions = ctk.CTkFrame(frame, fg_color="transparent")
        actions.pack(fill="x", padx=18, pady=(0, 14))
        ctk.CTkButton(actions, text="PLAY MIDI", command=self.play_midi, fg_color="#89f7ae", hover_color="#63d98c").pack(
            side="left", expand=True, fill="x", padx=(0, 8)
        )
        ctk.CTkButton(actions, text="STOP", command=self.stop_audio, fg_color="#ff5f8a", hover_color="#d94672").pack(
            side="left", expand=True, fill="x", padx=(8, 0)
        )

        self._slider_row(frame, "Transpose", self.transpose_var, -24, 24, self._on_transpose_change, 48, "semitones")
        self._slider_row(frame, "Playback Speed", self.playback_speed_var, 0.5, 2.0, self._on_speed_change, 15, "x")

        choice_row = ctk.CTkFrame(frame, fg_color="transparent")
        choice_row.pack(fill="x", padx=18, pady=(0, 12))
        ctk.CTkLabel(choice_row, text="INSTRUMENT TYPE", text_color="#9edcff", anchor="w").pack(anchor="w")
        ctk.CTkOptionMenu(
            choice_row,
            values=["original", "sine", "square", "sawtooth", "triangle"],
            variable=self.midi_wave_type_var,
            command=self._on_midi_wave_type_change,
        ).pack(fill="x", pady=(8, 0))
        ctk.CTkLabel(choice_row, textvariable=self.midi_preview_var, text_color="#f5d76e", anchor="w").pack(
            anchor="w", pady=(8, 0)
        )

        info = ctk.CTkTextbox(frame, height=120, fg_color="#0c152f", corner_radius=14, wrap="word")
        info.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        info.insert(
            "1.0",
            "Upload a .mid or .midi file, then render it through the same echo and filter chain as the synthesizer.\n\n"
            "Original mode maps MIDI program changes to a basic waveform family approximation.",
        )
        info.configure(state="disabled")

        visual = ctk.CTkFrame(frame, fg_color="#0c152f", corner_radius=14)
        visual.pack(fill="both", expand=False, padx=18, pady=(0, 18))
        ctk.CTkLabel(visual, text="MIDI waveform + timeline preview", text_color="#9edcff").pack(anchor="w", padx=14, pady=(12, 8))
        self.midi_visual = Canvas(visual, height=220, highlightthickness=0, bg="#0c152f")
        self.midi_visual.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self.midi_visual.bind("<Configure>", lambda _event: self._refresh_midi_visual())
        return frame

    def _draw_canvas_grid(self, canvas: Canvas, width: int, height: int) -> None:
        canvas.create_rectangle(0, 0, width, height, fill="#0c152f", outline="#0c152f")
        for x in range(0, width, 40):
            canvas.create_line(x, 0, x, height, fill="#18223f")
        for y in range(0, height, 40):
            canvas.create_line(0, y, width, y, fill="#18223f")

    def _filter_response_points(self, width: int, height: int) -> list[tuple[float, float]]:
        cutoff = max(20.0, float(self.filter_cutoff_var.get()))
        x_values = np.geomspace(20.0, MAX_FILTER_CUTOFF, num=120)
        response = 1.0 / np.sqrt(1.0 + np.power(x_values / cutoff, 4.0))
        points = []
        for index, _frequency in enumerate(x_values):
            x = 24 + (index / (len(x_values) - 1)) * (width - 48)
            y = 18 + (1.0 - float(response[index])) * (height - 56)
            points.append((x, y))
        return points

    def _refresh_filter_visual(self) -> None:
        canvas = getattr(self, "filter_visual", None)
        if canvas is None:
            return

        canvas.delete("all")
        width = max(1, canvas.winfo_width() or 440)
        height = max(1, canvas.winfo_height() or 220)
        self._draw_canvas_grid(canvas, width, height)

        points = self._filter_response_points(width, height)
        flattened: list[float] = []
        for x, y in points:
            flattened.extend([x, y])

        if len(flattened) >= 4:
            canvas.create_line(*flattened, fill="#19c5ff", width=3, smooth=True)
            baseline = [flattened[0], height - 20] + flattened + [flattened[-2], height - 20]
            canvas.create_polygon(*baseline, fill="#19c5ff", outline="", stipple="gray25")

        cutoff = float(self.filter_cutoff_var.get())
        marker_x = 24 + (np.log10(cutoff) - np.log10(20.0)) / (np.log10(MAX_FILTER_CUTOFF) - np.log10(20.0)) * (width - 48)
        canvas.create_line(marker_x, 12, marker_x, height - 18, fill="#f5d76e", width=2, dash=(5, 4))
        canvas.create_text(marker_x + 4, 18, anchor="nw", fill="#f5d76e", text=f"{cutoff:.0f} Hz cutoff")
        canvas.create_text(24, height - 14, anchor="sw", fill="#7faed4", text="20 Hz")
        canvas.create_text(width - 24, height - 14, anchor="se", fill="#7faed4", text="20 kHz")
        canvas.create_text(24, 14, anchor="nw", fill="#89f7ae", text="Pass")
        canvas.create_text(width - 24, 14, anchor="ne", fill="#ff8fc1", text="Stop")

    def _midi_waveform_name(self) -> str:
        selected = self.midi_wave_type_var.get()
        if selected != "original":
            return selected
        if self.loaded_midi_notes:
            return waveform_from_program(self.loaded_midi_notes[0].program)
        return "triangle"

    def _midi_preview_label(self) -> str:
        selected = self.midi_wave_type_var.get()
        if selected == "original":
            if self.loaded_midi_notes:
                program = self.loaded_midi_notes[0].program
                return f"Instrument preview: original map -> {waveform_from_program(program)}"
            return "Instrument preview: original"
        return f"Instrument preview: {selected}"

    def _midi_note_name(self, note_number: int) -> str:
        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        octave = (note_number // 12) - 1
        return f"{note_names[note_number % 12]}{octave}"

    def _midi_frequency_band(self, frequency: float) -> str:
        if frequency < 200.0:
            return "low"
        if frequency < 800.0:
            return "mid"
        return "high"

    def _waveform_samples(self, waveform: str, sample_count: int) -> np.ndarray:
        x = np.linspace(0.0, 1.0, sample_count, dtype=np.float32)
        phase = 2.0 * np.pi * x

        if waveform == "sine":
            return np.sin(phase)
        if waveform == "square":
            return np.sign(np.sin(phase))
        if waveform == "sawtooth":
            return 2.0 * (x - np.floor(x + 0.5))
        if waveform == "triangle":
            return 2.0 * np.abs(2.0 * (x - np.floor(x + 0.5))) - 1.0
        return np.sin(phase)

    def _refresh_midi_visual(self) -> None:
        canvas = getattr(self, "midi_visual", None)
        if canvas is None:
            return

        canvas.delete("all")
        width = max(1, canvas.winfo_width() or 440)
        height = max(1, canvas.winfo_height() or 220)
        self._draw_canvas_grid(canvas, width, height)

        display_duration = max(0.001, self.midi_song_duration) if self.loaded_midi_notes else 0.001

        header_bottom = 44
        lane_top = 62
        lane_bottom = height - 34
        canvas.create_text(24, 20, anchor="nw", fill="#7ed9ff", text="Piano-roll note map")
        canvas.create_text(width - 24, 20, anchor="ne", fill="#f5d76e", text=self._midi_preview_label())
        canvas.create_rectangle(20, lane_top, width - 20, lane_bottom, outline="#294060", width=1)

        pitch_min = 21
        pitch_max = 108
        pitch_span = pitch_max - pitch_min

        for pitch in range(pitch_min, pitch_max + 1, 12):
            y = lane_bottom - ((pitch - pitch_min) / pitch_span) * (lane_bottom - lane_top)
            canvas.create_line(20, y, width - 20, y, fill="#18223f")
            note_label = self._midi_note_name(pitch)
            frequency = midi_note_to_frequency(pitch)
            canvas.create_text(24, y - 2, anchor="sw", fill="#7faed4", text=f"{note_label}  {frequency:.0f}Hz")

        for marker in range(0, 101, 10):
            x = 24 + (marker / 100.0) * (width - 56)
            canvas.create_line(x, lane_top, x, lane_bottom, fill="#18223f", dash=(2, 6))
            if marker < 100:
                canvas.create_text(x, lane_bottom + 6, anchor="n", fill="#7faed4", text=f"{marker}%")

        legend_x = width - 180
        legend_y = 42
        legend_items = [("low", "#19c5ff"), ("mid", "#89f7ae"), ("high", "#f5d76e")]
        for index, (label, color) in enumerate(legend_items):
            offset_y = legend_y + index * 18
            canvas.create_rectangle(legend_x, offset_y, legend_x + 10, offset_y + 10, fill=color, outline=color)
            canvas.create_text(legend_x + 16, offset_y + 5, anchor="w", fill="#d8e6ff", text=label)

        if self.loaded_midi_notes:
            total_duration = max(note.start + note.duration for note in self.loaded_midi_notes)
            note_count = len(self.loaded_midi_notes)
            for note in self.loaded_midi_notes:
                left = 24 + (note.start / display_duration) * (width - 56)
                right = 24 + ((note.start + note.duration) / display_duration) * (width - 56)
                pitch_ratio = (note.note - pitch_min) / pitch_span
                center_y = lane_bottom - pitch_ratio * (lane_bottom - lane_top)
                bar_height = 12 + (note.velocity / 127.0) * 22
                band = self._midi_frequency_band(midi_note_to_frequency(note.note))
                color = {"low": "#19c5ff", "mid": "#89f7ae", "high": "#f5d76e"}[band]
                canvas.create_rectangle(left, center_y - bar_height, max(left + 4, right), center_y, fill=color, outline=color, width=1)
                if right - left > 60 and note_count <= 120:
                    canvas.create_text(
                        left + 4,
                        center_y - bar_height - 2,
                        anchor="sw",
                        fill="#ffffff",
                        text=f"{self._midi_note_name(note.note)} {midi_note_to_frequency(note.note):.0f}Hz",
                    )
        else:
            canvas.create_text(
                width / 2,
                (lane_top + lane_bottom) / 2,
                fill="#7faed4",
                text="Load a MIDI file to preview note timing, pitch, and frequency bands",
            )

        if self.midi_playback_active and self.midi_song_duration > 0.0:
            play_x = 24 + self.midi_playback_progress * (width - 56)
            canvas.create_line(play_x, lane_top - 14, play_x, lane_bottom + 4, fill="#ffffff", width=3)
            canvas.create_oval(play_x - 6, lane_top - 20, play_x + 6, lane_top - 8, fill="#ffffff", outline="#ffffff")
            canvas.create_text(
                play_x + 8,
                lane_top - 20,
                anchor="sw",
                fill="#ffffff",
                text=f"{self.midi_playback_progress * 100:.0f}%",
            )

        label = self.midi_label_var.get()
        if self.loaded_midi_notes:
            note_count = len(self.loaded_midi_notes)
            playback_speed = max(0.5, float(self.playback_speed_var.get()))
            duration_label = f"{(self.midi_song_duration / playback_speed):.1f}s @ {playback_speed:.1f}x"
            canvas.create_text(
                24,
                height - 10,
                anchor="sw",
                fill="#f5d76e",
                text=f"{label} | {note_count} notes | {duration_label}",
            )
        else:
            canvas.create_text(24, height - 10, anchor="sw", fill="#f5d76e", text=f"{label} | {self._midi_preview_label()}")

    def _set_status(self, text: str) -> None:
        self.status_var.set(text)

    def _set_playback_indicator(self, text: str, color: str) -> None:
        self.play_status_label.configure(text=text, text_color=color)

    def _play_audio(self, audio: np.ndarray, status_message: str) -> None:
        self.stop_audio()
        self._set_status(status_message)
        self._set_playback_indicator("Playing", "#89f7ae")
        self.is_playing = True

        def worker() -> None:
            try:
                sd.play(audio, SAMPLE_RATE)
                sd.wait()
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror("Playback error", str(exc)))
            finally:
                self.after(0, self._playback_finished)

        self.current_playback_thread = threading.Thread(target=worker, daemon=True)
        self.current_playback_thread.start()

    def _playback_finished(self) -> None:
        self.is_playing = False
        self.midi_playback_active = False
        self.midi_playback_started_at = None
        self.midi_playback_progress = 0.0
        self._set_playback_indicator("Idle", "#89f7ae")
        self._set_status("Ready")
        self._refresh_midi_visual()

    def stop_audio(self) -> None:
        try:
            sd.stop()
        except Exception:
            pass
        self.is_playing = False
        self.midi_playback_active = False
        self.midi_playback_started_at = None
        self.midi_playback_progress = 0.0
        self._set_playback_indicator("Stopped", "#ffcc66")
        self._set_status("Stopped")
        self._refresh_midi_visual()

    def play_synth(self) -> None:
        try:
            audio = render_synth_audio(
                frequency=float(self.frequency_var.get()),
                harmonics=int(self.harmonics_var.get()),
                wave_type=self.wave_type_var.get(),
                echo_depth=float(self.echo_depth_var.get()),
                filter_cutoff=float(self.filter_cutoff_var.get()),
                sample_rate=SAMPLE_RATE,
            )
            self._play_audio(audio, "Rendering synthesizer audio")
        except Exception as exc:
            messagebox.showerror("Synthesis error", str(exc))

    def load_midi_file(self) -> None:
        file_name = filedialog.askopenfilename(
            title="Select a MIDI file",
            filetypes=[("MIDI files", "*.mid *.midi"), ("All files", "*.*")],
        )
        if not file_name:
            return

        path = Path(file_name)
        if path.suffix.lower() not in {".mid", ".midi"}:
            messagebox.showerror("Invalid file", "Please select a .mid or .midi file")
            return

        self.midi_file_path = path
        self.midi_label_var.set(path.name)
        try:
            self.loaded_midi_notes = parse_midi_file(path)
        except Exception:
            self.loaded_midi_notes = []
        self.midi_song_duration = max((note.start + note.duration) for note in self.loaded_midi_notes) if self.loaded_midi_notes else 0.0
        self.midi_preview_var.set(self._midi_preview_label())
        self._refresh_midi_visual()
        self._set_status(f"Loaded MIDI file: {path.name}")

    def play_midi(self) -> None:
        if not self.midi_file_path:
            messagebox.showwarning("No MIDI file", "Load a MIDI file before playing")
            return

        try:
            audio = render_midi_audio(
                path=self.midi_file_path,
                transpose_semitones=int(self.transpose_var.get()),
                midi_wave_type=self.midi_wave_type_var.get(),
                playback_speed=float(self.playback_speed_var.get()),
                harmonics=int(self.harmonics_var.get()),
                echo_depth=float(self.echo_depth_var.get()),
                filter_cutoff=float(self.filter_cutoff_var.get()),
                sample_rate=SAMPLE_RATE,
            )
            self._play_audio(audio, f"Rendering MIDI: {self.midi_file_path.name}")
            self._start_midi_progress(audio.size / SAMPLE_RATE)
        except Exception as exc:
            messagebox.showerror("MIDI error", str(exc))

    def _play_midi_preview(self) -> None:
        if not self.midi_file_path:
            return

        try:
            audio = render_midi_audio(
                path=self.midi_file_path,
                transpose_semitones=int(self.transpose_var.get()),
                midi_wave_type=self.midi_wave_type_var.get(),
                playback_speed=float(self.playback_speed_var.get()),
                harmonics=int(self.harmonics_var.get()),
                echo_depth=float(self.echo_depth_var.get()),
                filter_cutoff=float(self.filter_cutoff_var.get()),
                sample_rate=SAMPLE_RATE,
            )
            preview_samples = min(audio.size, int(SAMPLE_RATE * 2.0))
            if preview_samples > 0:
                self._play_audio(audio[:preview_samples], f"Previewing MIDI instrument: {self.midi_wave_type_var.get()}")
                self._start_midi_progress(preview_samples / SAMPLE_RATE)
        except Exception as exc:
            messagebox.showerror("MIDI preview error", str(exc))

    def _start_midi_progress(self, duration_seconds: float) -> None:
        self.midi_playback_started_at = time.monotonic()
        self.midi_playback_progress = 0.0
        self.midi_playback_active = True
        self.midi_song_duration = max(duration_seconds, 0.001)
        self._refresh_midi_visual()
        self.after(50, self._tick_midi_progress)

    def _tick_midi_progress(self) -> None:
        if not self.midi_playback_active or self.midi_playback_started_at is None:
            return

        elapsed = time.monotonic() - self.midi_playback_started_at
        playback_speed = max(0.5, float(self.playback_speed_var.get()))
        duration = max(self.midi_song_duration, 0.001)
        self.midi_playback_progress = min(1.0, (elapsed * playback_speed) / duration)
        self._refresh_midi_visual()

        if self.is_playing and self.midi_playback_progress < 1.0:
            self.after(50, self._tick_midi_progress)

    def _on_frequency_change(self, value: float) -> None:
        self.frequency_var.set(float(value))
        self._set_status(f"Frequency set to {float(value):.0f} Hz")

    def _on_harmonics_change(self, value: float) -> None:
        self.harmonics_var.set(int(value))
        self._set_status(f"Harmonics set to {int(value)}")

    def _on_wave_type_change(self, value: str) -> None:
        self.wave_type_var.set(value)
        self._set_status(f"Waveform set to {value}")

    def _on_echo_depth_change(self, value: float) -> None:
        self.echo_depth_var.set(float(value))
        self._set_status(f"Echo depth set to {float(value):.2f}")

    def _on_cutoff_change(self, value: float) -> None:
        self.filter_cutoff_var.set(float(value))
        self._refresh_filter_visual()
        self._set_status(f"Cutoff set to {float(value):.0f} Hz")

    def _on_transpose_change(self, value: float) -> None:
        self.transpose_var.set(int(value))
        self._set_status(f"Transpose set to {int(value):+d} semitones")

    def _on_speed_change(self, value: float) -> None:
        self.playback_speed_var.set(float(value))
        self._set_status(f"Playback speed set to {float(value):.1f}x")
        self._refresh_midi_visual()

    def _on_midi_wave_type_change(self, value: str) -> None:
        self.midi_wave_type_var.set(value)
        self.midi_preview_var.set(self._midi_preview_label())
        self._refresh_midi_visual()
        self._set_status(f"MIDI waveform set to {value}")
        if self.midi_file_path is not None:
            self._play_midi_preview()

    def _on_close(self) -> None:
        self.stop_audio()
        self.destroy()


def main() -> None:
    app = SynthApp()
    app.mainloop()


if __name__ == "__main__":
    main()