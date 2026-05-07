# Digital Synthesizer & Effects Engine

Python desktop synthesizer and MIDI player built with CustomTkinter, NumPy, SciPy, Mido, and SoundDevice.

## Run

```bash
pip install -r requirements.txt
python app.py
```

## Features

- Fourier synthesis for square, sawtooth, sine, and triangle waveforms
- Echo convolution with a 400 ms delayed tap
- Low-pass filtering with a Butterworth-style response
- MIDI loading, transposition, playback speed control, and waveform selection

## Notes

- The app starts from a user gesture in the GUI and plays audio through `sounddevice`.
- MIDI files with no playable note events may be rejected during parsing.
- The included `test_midi.mid` file was previously observed to be malformed, so use a valid `.mid` or `.midi` file for playback.
