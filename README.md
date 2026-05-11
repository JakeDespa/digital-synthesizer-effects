# Digital Synthesizer & Effects Engine

Python desktop synthesizer and MIDI player built with CustomTkinter, NumPy, SciPy, Mido, and SoundDevice.

## Run

```bash
pip install -r requirements.txt
python app.py
```

## Features

- Synthesizer playback: generate audio tones with Fourier synthesis using square, sawtooth, sine, or triangle waveforms.
- Harmonics control: increase or decrease harmonic detail to make the generated sound cleaner or richer.
- Echo effect: blend in a delayed copy of the signal with a 400 ms tap to add space and depth.
- Low-pass filter: reduce high frequencies with a Butterworth-style filter and adjust the cutoff frequency.
- MIDI loading: open a `.mid` or `.midi` file from the desktop GUI and render it as audio.
- Transpose control: shift all MIDI notes up or down by semitones before playback.
- Playback speed control: slow down or speed up the MIDI rendering without changing the note content.
- Instrument selection: choose a waveform for MIDI playback, or use `original` to map MIDI program changes to a basic waveform family.
- Playback controls: start and stop synthesized audio or MIDI playback directly from the app.

## Notes

- Audio playback runs through `sounddevice` from the desktop GUI.
- MIDI files with no playable note events are rejected during parsing.
- The included `Hatsune Miku - Senbonzakura.mid` file is a working example you can load and play.

## Formulas Used

- MIDI pitch to frequency: $f = 440 \cdot 2^{(n - 69) / 12}$
- Sine wave: $x(t) = \sin(2\pi f t)$
- Square wave Fourier series: $x(t) = \frac{4}{\pi} \sum_{k=1,3,5,\dots}^{N} \frac{\sin(2\pi k f t)}{k}$
- Sawtooth wave Fourier series: $x(t) = \frac{2}{\pi} \sum_{k=1}^{N} \frac{(-1)^{k+1}\sin(2\pi k f t)}{k}$
- Triangle wave Fourier series: $x(t) = \frac{8}{\pi^2} \sum_{k=1,3,5,\dots}^{N} \frac{(-1)^{(k-1)/2}\sin(2\pi k f t)}{k^2}$
- Echo tap: $y[n] = x[n] + 0.75\,x[n-d]$ with a 400 ms delay tap and wet/dry mixing
- Low-pass filtering: a 2nd-order Butterworth low-pass filter is designed with the cutoff normalized by the sample rate
