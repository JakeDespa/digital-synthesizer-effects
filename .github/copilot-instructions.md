<!-- Digital Synthesizer & Effects Engine - Project Completion -->

# Copilot Instructions - Digital Synthesizer & Effects Engine

## Project Overview

This is a professional-grade web-based Custom Digital Synthesizer & Effects Engine built with React, Vite, and the native Web Audio API. The application implements:

1. **Custom Fourier Synthesis** - Square and Sawtooth waveforms using mathematical Fourier coefficients (not default OscillatorNode types)
2. **Convolution Echo Effects** - LTI system implementation: y[n] = x[n] + 0.5·x[n-4] with 400ms temporal mapping
3. **Intelligent Low-Pass Filtering** - Butterworth filter design (Q=1, -6dB/octave roll-off)
4. **Cyberpunk UI** - Dark theme with neon cyan, magenta, lime accents using Tailwind CSS

## Project Setup Status

✓ Vite + React scaffolding complete
✓ Tailwind CSS & PostCSS configured
✓ All dependencies installed
✓ Project builds successfully
✓ Documentation complete

## Key Files & Their Purpose

### Core Audio Engine
- `src/hooks/useAudioEngine.js` - CompleteWeb Audio API implementation with custom oscillators, convolution, and filtering

### UI Components
- `src/components/Controls.jsx` - Reusable slider, button, meter, and control panel components
- `src/components/SynthesizerPanel.jsx` - Frequency, harmonics, and waveform controls
- `src/components/EffectsPanel.jsx` - Echo depth and convolution effect controls
- `src/components/FilteringPanel.jsx` - Cutoff frequency and filter specification controls

### Main Application
- `src/App.jsx` - Root component with 3-column dashboard layout
- `src/main.jsx` - React entry point
- `src/index.css` - Global Tailwind CSS styles

### Configuration
- `vite.config.js` - Vite build configuration with React plugin
- `tailwind.config.js` - Tailwind theme extension with neon colors
- `postcss.config.js` - PostCSS plugins for Tailwind
- `package.json` - Dependencies and build scripts
- `index.html` - HTML entry point

## DSP Implementation Details

### Fourier Synthesis (Square Wave)
B_k = 4 / (k·π) for odd k only (k = 1, 3, 5, 7, ...)

### Fourier Synthesis (Sawtooth Wave)
B_k = (-1)^(k+1) · (2 / k) for all integer k (k = 1, 2, 3, 4, ...)

### Convolution Echo
- Discrete system: y[n] = x[n] + 0.5·x[n-4]
- Temporal mapping: n-4 steps → 400ms delay
- Amplitude scaling: 0.5 feedback coefficient

### Low-Pass Filter
- Type: Butterworth
- Q Value: 1.0 (flat response, minimal resonance)
- Roll-off: -6dB/octave (first-order nominal)
- Frequency range: 20Hz - 20kHz

## How to Run

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

Access the application at `http://localhost:5173` (default Vite port)

## Development Guidelines

### Adding New Waveforms
1. Update `useAudioEngine.js` - add new case in `createCustomOscillator`
2. Calculate Fourier coefficients for the desired waveform
3. Update `SynthesizerPanel.jsx` - add button in waveform selection grid

### Modifying Echo Effect
1. Edit `useAudioEngine.js` - adjust `delayTime` variable (currently 0.4 = 400ms)
2. Modify impulse response coefficients for different echo characteristics
3. Test with `updateEchoDepth()` control

### Customizing Filter
1. Change filter type in `useAudioEngine.js`: `filterNode.current.type`
2. Adjust Q factor: `filterNode.current.Q.value`
3. Options: 'lowpass', 'highpass', 'bandpass', 'notch'

### Styling Updates
1. Use Tailwind utility classes (already configured)
2. Custom neon colors defined in `tailwind.config.js`
3. Extend theme for additional colors/effects

## Performance Notes

- All audio processing happens on the audio thread via Web Audio API
- UI updates are decoupled from audio processing
- React hooks manage state efficiently
- Vite provides instant HMR (Hot Module Reload) for development

## Browser Compatibility

- Chrome/Edge 14+: Full support
- Firefox 25+: Full support
- Safari 14+: Full support (with webkit prefixes)
- Mobile: Requires user gesture to initiate audio playback

## Known Limitations

- Mobile support limited due to audio autoplay restrictions
- iOS requires user interaction to start synthesis
- Maximum frequency limited to 2kHz by slider (can be extended)

---

**Project Status**: ✓ Complete and Ready for Development
