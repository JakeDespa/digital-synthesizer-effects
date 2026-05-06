import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Custom Audio Engine Hook
 * Implements:
 * - Fourier Synthesis (Custom Oscillator via PeriodicWave)
 * - Convolution Echo Effect
 * - Low-Pass Filtering
 */
export const useAudioEngine = () => {
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const masterGainNode = useRef(null);
  const dryGainNode = useRef(null);
  const wetGainNode = useRef(null);
  const filterNode = useRef(null);
  const convolutionNode = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [harmonics, setHarmonics] = useState(32);
  const [waveType, setWaveType] = useState('square');
  const [filterCutoff, setFilterCutoff] = useState(1000);
  const [echoDepth, setEchoDepth] = useState(0.7); // Start with noticeable echo

  // Initialize Audio Context
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resume audio context if suspended (required by modern browsers)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(err => console.log('AudioContext resume failed:', err));
    }
    
    audioContextRef.current = audioCtx;

    // Master output gain
    masterGainNode.current = audioCtx.createGain();
    masterGainNode.current.gain.value = 0.8; // Main volume control (increased for clarity)
    masterGainNode.current.connect(audioCtx.destination);

    // Low-pass filter (last effect in chain)
    filterNode.current = audioCtx.createBiquadFilter();
    filterNode.current.type = 'lowpass';
    filterNode.current.frequency.value = 1000;
    filterNode.current.Q.value = 2; // Increased for more resonant peaks
    filterNode.current.connect(masterGainNode.current);

    // DRY path: unprocessed signal directly through filter
    dryGainNode.current = audioCtx.createGain();
    dryGainNode.current.gain.value = 0.9; // Start with clean, loud signal
    dryGainNode.current.connect(filterNode.current);

    // WET path: processed through convolver then through filter
    wetGainNode.current = audioCtx.createGain();
    wetGainNode.current.gain.value = 0.8; // Strong echo/wet signal for obvious effect
    wetGainNode.current.connect(filterNode.current);

    // Convolution node (creates the echo/reverb effect)
    convolutionNode.current = audioCtx.createConvolver();
    
    // Create impulse response: y[n] = x[n] + 0.5 * x[n-4]
    // Map 400ms delay
    const delayTime = 0.4; // 400ms
    const sampleRate = audioCtx.sampleRate;
    const delayInSamples = Math.floor(delayTime * sampleRate); // 400ms in samples
    const impulseLength = delayInSamples + 1;
    const impulseResponse = audioCtx.createBuffer(1, impulseLength, sampleRate);
    const impulseData = impulseResponse.getChannelData(0);
    
    // Simple impulse response with delay
    impulseData[0] = 1; // Direct: x[n]
    if (delayInSamples < impulseLength) {
      impulseData[delayInSamples] = 0.75; // Delayed echo: 0.75 * x[n-delay] (stronger feedback)
    }
    
    convolutionNode.current.buffer = impulseResponse;
    convolutionNode.current.connect(wetGainNode.current); // Convolver connects to wet path
  }, []);

  /**
   * Custom Fourier Synthesis Oscillator
   * Creates square or sawtooth waves using PeriodicWave interface
   */
  const createCustomOscillator = useCallback(
    (waveform) => {
      if (!audioContextRef.current) return null;

      const audioCtx = audioContextRef.current;
      const harmonicCount = Math.max(2, harmonics);

      // Initialize real and imaginary parts for PeriodicWave
      // DC component (index 0) is always 0
      const real = new Float32Array(harmonicCount);
      const imag = new Float32Array(harmonicCount);

      real[0] = 0; // DC component
      imag[0] = 0;

      if (waveform === 'square') {
        // Square Wave: B_k = 4 / (k * π) for odd k only
        for (let k = 1; k < harmonicCount; k++) {
          if (k % 2 === 1) {
            // Odd harmonics only
            imag[k] = (4 / (k * Math.PI));
          } else {
            imag[k] = 0;
          }
          real[k] = 0;
        }
      } else if (waveform === 'sawtooth') {
        // Sawtooth Wave: B_k = (-1)^(k+1) * (2 / k) for all k
        for (let k = 1; k < harmonicCount; k++) {
          const sign = (k + 1) % 2 === 0 ? 1 : -1;
          imag[k] = sign * (2 / k);
          real[k] = 0;
        }
      } else if (waveform === 'sine') {
        // Pure sine wave: only fundamental frequency (k=1)
        real[0] = 0;
        imag[1] = 1;
        for (let k = 2; k < harmonicCount; k++) {
          real[k] = 0;
          imag[k] = 0;
        }
      }

      // Create PeriodicWave from Fourier coefficients
      const periodicWave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });

      // Create oscillator and apply custom wave
      const osc = audioCtx.createOscillator();
      osc.setPeriodicWave(periodicWave);
      osc.frequency.value = frequency;

      return osc;
    },
    [harmonics, frequency]
  );

  /**
   * Start Synthesis
   */
  const start = useCallback(async () => {
    if (isPlaying) return;

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      initAudioContext();
    }

    const audioCtx = audioContextRef.current;
    if (!audioCtx || !dryGainNode.current || !convolutionNode.current) return;

    // Resume audio context if suspended (required by modern browsers)
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (err) {
        console.error('Failed to resume audio context:', err);
        return;
      }
    }

    // Create and start custom oscillator
    const osc = createCustomOscillator(waveType);
    if (!osc) return;

    // Route oscillator to BOTH dry and wet paths
    osc.connect(dryGainNode.current);  // Unprocessed signal
    osc.connect(convolutionNode.current); // Processed signal through echo

    osc.start();
    oscillatorRef.current = osc;

    setIsPlaying(true);
  }, [isPlaying, waveType, initAudioContext, createCustomOscillator]);

  /**
   * Stop Synthesis
   */
  const stop = useCallback(() => {
    if (!isPlaying || !oscillatorRef.current) return;

    oscillatorRef.current.stop();
    oscillatorRef.current.disconnect();
    oscillatorRef.current = null;

    setIsPlaying(false);
  }, [isPlaying]);

  /**
   * Update Frequency
   */
  const updateFrequency = useCallback((value) => {
    setFrequency(value);
    if (oscillatorRef.current) {
      oscillatorRef.current.frequency.value = value;
    }
  }, []);

  /**
   * Update Harmonics (requires stopping and restarting)
   */
  const updateHarmonics = useCallback((value) => {
    setHarmonics(value);
    if (isPlaying) {
      stop();
      setHarmonics(value); // State update, will take effect on next start
    }
  }, [isPlaying, stop]);

  /**
   * Change Wave Type (requires stopping and restarting)
   */
  const changeWaveType = useCallback((type) => {
    setWaveType(type);
    if (isPlaying) {
      stop();
      setWaveType(type);
    }
  }, [isPlaying, stop]);

  /**
   * Update Filter Cutoff
   */
  const updateFilterCutoff = useCallback((value) => {
    setFilterCutoff(value);
    if (filterNode.current) {
      filterNode.current.frequency.value = value;
    }
  }, []);

  /**
   * Update Echo/Convolution Depth (controls wet/dry balance)
   */
  const updateEchoDepth = useCallback((value) => {
    setEchoDepth(value);
    if (wetGainNode.current && dryGainNode.current) {
      // As echo depth increases, wet signal increases dramatically and dry decreases
      wetGainNode.current.gain.value = value * 1.0; // Wet: 0-1.0 (full range)
      dryGainNode.current.gain.value = (1 - value) * 0.9; // Dry: 0.9→0 (obvious change)
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (isPlaying) {
        stop();
      }
    };
  }, []);

  return {
    // Control methods
    start,
    stop,
    updateFrequency,
    updateHarmonics,
    changeWaveType,
    updateFilterCutoff,
    updateEchoDepth,
    // Initialization
    initAudioContext,
    // State
    isPlaying,
    frequency,
    harmonics,
    waveType,
    filterCutoff,
    echoDepth,
    // Audio context and effects for MIDI integration (pass refs)
    audioContextRef,
    effectsChain: {
      audioContextRef,
      dryGainNodeRef: dryGainNode,
      wetGainNodeRef: wetGainNode,
      filterNodeRef: filterNode,
      convolutionNodeRef: convolutionNode,
      masterGainNodeRef: masterGainNode,
    },
  };
};
