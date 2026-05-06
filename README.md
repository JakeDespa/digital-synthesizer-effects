# Digital Synthesizer & Effects Engine

A professional-grade web-based audio synthesizer with custom Fourier synthesis, convolution effects, and intelligent filtering. Built with **React**, **Vite**, and the native **Web Audio API**.

## 🎛️ Features

### Custom Fourier Synthesis
- **Waveform Types**: Square, Sawtooth, and Sine waves
- **Custom Harmonics Control**: Generate waveforms using up to 256 harmonics
- **Mathematical Precision**:
  - **Square Wave**: B_k = 4 / (k·π) for odd harmonics only
  - **Sawtooth Wave**: B_k = (-1)^(k+1) · (2 / k) for all harmonics
  - Uses Web Audio API's `PeriodicWave` interface for custom oscillators

### Convolution & Echo Effects
- **LTI (Linear Time-Invariant) System**: Implements y[n] = x[n] + 0.5·x[n-4]
- **400ms Temporal Delay**: Maps discrete delay steps to realistic temporal delays
- **Adjustable Echo Depth**: Control the feedback level of the convolution effect
- Uses Web Audio API's `ConvolverNode` for authentic convolution processing

### Intelligent Low-Pass Filtering
- **Butterworth Filter Design**: Q=1 for smooth, natural roll-off (-6dB/octave)
- **Dynamic Cutoff Control**: Adjust filter frequency from 20Hz to 20kHz
- **BiquadFilterNode Implementation**: Professional-grade filtering using Web Audio API
- Removes high-frequency noise (e.g., 3000+ Hz hiss)

### Cyberpunk Aesthetic UI
- **Neon Color Scheme**: Cyan, Magenta, Lime, and Orange accents
- **Dark Theme**: Professional dark background (#0a0e27) with transparency effects
- **Responsive Design**: Optimized for desktop and tablet displays
- **Interactive Controls**: Real-time sliders, buttons, and visual feedback

## 🛠️ Technology Stack

- **React 18**: UI component framework
- **Vite 5**: Lightning-fast build tool and dev server
- **Tailwind CSS 3**: Utility-first CSS framework
- **Web Audio API**: Native browser audio processing
- **JavaScript ES6+**: Modern JavaScript with hooks and async/await

## 📊 Digital Signal Processing

### Synthesizer Engine
The synthesizer uses **custom PeriodicWave** oscillators instead of default types:

```javascript
// Square Wave Fourier Coefficients (implemented in useAudioEngine)
B_k = 4 / (k * π)  // Only for odd k (1, 3, 5, 7, ...)

// Sawtooth Wave Fourier Coefficients
B_k = (-1)^(k+1) * (2 / k)  // For all k (1, 2, 3, 4, ...)
```

### Convolution Echo System
The echo effect models a discrete LTI system:

```
y[n] = x[n] + 0.5 * x[n-4]

Where:
- Input signal: x[n]
- Delayed signal: x[n-4] (mapped to 400ms)
- Feedback coefficient: 0.5
- Creates natural echo/reverb effect
```

### Filtering
Low-pass filter removes high-frequency content:

```
Type: Butterworth
Q Factor: 1.0 (Unity gain at cutoff)
Roll-off: -6dB/octave (first-order)
Frequency Range: 20Hz - 20kHz
```

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Usage

1. **Start the Synthesizer**: Click the **PLAY** button to activate audio generation
2. **Adjust Frequency**: Use the frequency slider (20Hz - 2kHz)
3. **Control Harmonics**: Select number of harmonics (2 - 256)
4. **Choose Waveform**: Switch between Square, Sawtooth, or Sine
5. **Add Echo**: Increase the Echo Depth slider for convolution effects
6. **Filter Noise**: Adjust the Cutoff Frequency to remove high-frequency noise

## 📁 Project Structure

```
signals/
├── src/
│   ├── components/
│   │   ├── Controls.jsx          # Reusable UI components
│   │   ├── SynthesizerPanel.jsx  # Oscillator & frequency controls
│   │   ├── EffectsPanel.jsx      # Echo & convolution controls
│   │   └── FilteringPanel.jsx    # Low-pass filter controls
│   ├── hooks/
│   │   └── useAudioEngine.js     # Audio processing logic (DSP)
│   ├── App.jsx                   # Main application component
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles & Tailwind
├── index.html                     # HTML entry point
├── vite.config.js                # Vite configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
└── package.json                  # Dependencies & scripts
```

## 🎨 Customization

### Modify Fourier Coefficients
Edit the `createCustomOscillator` function in `src/hooks/useAudioEngine.js`:

```javascript
// Add custom waveform (e.g., triangle wave)
if (waveform === 'triangle') {
  for (let k = 1; k < harmonicCount; k++) {
    if (k % 2 === 1) {
      imag[k] = (8 / (k * k * Math.PI * Math.PI)) * ((k % 4 === 1) ? 1 : -1);
    }
  }
}
```

### Adjust Echo Delay
In `useAudioEngine.js`, modify the delay calculation:

```javascript
const delayTime = 0.4; // Change from 400ms to desired value
```

### Change Filter Type
In `useAudioEngine.js`, modify the filter node:

```javascript
filterNode.current.type = 'highpass'; // Switch to high-pass
```

## 🔊 Audio Specifications

| Parameter | Min | Max | Default | Unit |
|-----------|-----|-----|---------|------|
| Frequency | 20 | 1,000 | 440 | Hz |
| Harmonics | 2 | 256 | 32 | count |
| Cutoff Freq | 20 | 1,000 | 1,000 | Hz |
| Echo Depth | 0 | 1 | 0.7 | ratio |

## 📚 Learning Resources

- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Fourier Series & Synthesis](https://en.wikipedia.org/wiki/Fourier_series)
- [Digital Signal Processing Fundamentals](https://en.wikipedia.org/wiki/Digital_signal_processing)
- [Butterworth Filter Design](https://en.wikipedia.org/wiki/Butterworth_filter)

## ⚙️ Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (with webkit prefix)
- **Mobile**: Limited support (iOS requires user gesture to start audio)

## 📝 License

This project is open-source and available for educational and commercial use.

## 🎓 Educational Value

This synthesizer is an excellent learning tool for:
- **DSP Concepts**: Fourier analysis, convolution, filtering
- **Web Audio API**: Real-time audio processing in browsers
- **React Patterns**: Custom hooks, state management, component composition
- **Audio Engineering**: Frequency response, resonance, signal flow

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues, feature requests, or pull requests.

---

**Built with ❤️ by React & DSP Enthusiasts**
