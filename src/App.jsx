import React, { useState } from 'react';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useMIDIEngine } from './hooks/useMIDIEngine';
import { SynthesizerPanel } from './components/SynthesizerPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { FilteringPanel } from './components/FilteringPanel';
import { MIDIPanel } from './components/MIDIPanel';

/**
 * Main Application Component
 * Digital Synthesizer & Effects Engine with Web Audio API & MIDI Support
 */
function App() {
  const audioEngine = useAudioEngine();
  const midiEngine = useMIDIEngine(audioEngine.audioContextRef, audioEngine.effectsChain, audioEngine.initAudioContext);

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-cyan uppercase tracking-widest mb-2">
          ◆ DIGITAL SYNTHESIZER ◆
        </h1>
        <p className="text-sm text-neon-cyan/60 uppercase tracking-widest">
          Fourier Synthesis • Convolution Effects • Filtering • MIDI Sequencing
        </p>
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-50" />
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8 mb-12">
        {/* Left Column: Synthesizer */}
        <div>
          <SynthesizerPanel
            isPlaying={audioEngine.isPlaying}
            frequency={audioEngine.frequency}
            harmonics={audioEngine.harmonics}
            waveType={audioEngine.waveType}
            onStart={audioEngine.start}
            onStop={audioEngine.stop}
            onFrequencyChange={audioEngine.updateFrequency}
            onHarmonicsChange={audioEngine.updateHarmonics}
            onWaveTypeChange={audioEngine.changeWaveType}
          />
        </div>

        {/* Second Column: Effects */}
        <div>
          <EffectsPanel
            echoDepth={audioEngine.echoDepth}
            onEchoDepthChange={audioEngine.updateEchoDepth}
            isPlaying={audioEngine.isPlaying}
          />
        </div>

        {/* Third Column: Filtering */}
        <div>
          <FilteringPanel
            filterCutoff={audioEngine.filterCutoff}
            onFilterCutoffChange={audioEngine.updateFilterCutoff}
          />
        </div>

        {/* Fourth Column: MIDI */}
        <div>
          <MIDIPanel
            isPlaying={midiEngine.isPlaying}
            midiFile={midiEngine.midiFile}
            transposeAmount={midiEngine.transposeAmount}
            midiWaveType={midiEngine.midiWaveType}
            playbackSpeed={midiEngine.playbackSpeed}
            onPlayMIDI={midiEngine.start}
            onStopMIDI={midiEngine.stop}
            onFileUpload={midiEngine.parseMIDIFile}
            onTransposeChange={midiEngine.updateTranspose}
            onWaveTypeChange={midiEngine.changeMidiWaveType}
            onPlaybackSpeedChange={midiEngine.updatePlaybackSpeed}
          />
        </div>
      </div>

      {/* Footer Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* DSP Info */}
        <div className="p-6 border-2 border-neon-lime/40 rounded-lg bg-dark-surface/30 backdrop-blur-sm">
          <h3 className="text-neon-lime uppercase font-bold tracking-widest mb-3">
            ▤ Digital Signal Processing
          </h3>
          <ul className="space-y-2 text-xs text-neon-lime/70">
            <li>
              <strong>Custom Oscillator:</strong> PeriodicWave interface with selectable harmonics
            </li>
            <li>
              <strong>Square Wave:</strong> B_k = 4/(k·π) for odd harmonics only
            </li>
            <li>
              <strong>Sawtooth Wave:</strong> B_k = (-1)^(k+1)·(2/k) for all integer harmonics
            </li>
          </ul>
        </div>

        {/* Audio System Info */}
        <div className="p-6 border-2 border-neon-orange/40 rounded-lg bg-dark-surface/30 backdrop-blur-sm">
          <h3 className="text-neon-orange uppercase font-bold tracking-widest mb-3">
            ⚙ Audio System
          </h3>
          <ul className="space-y-2 text-xs text-neon-orange/70">
            <li>
              <strong>Web Audio API:</strong> OscillatorNode + ConvolverNode + BiquadFilterNode
            </li>
            <li>
              <strong>Convolution:</strong> y[n] = x[n] + 0.5·x[n-4] (400ms delay)
            </li>
            <li>
              <strong>Filtering:</strong> Butterworth Low-Pass (Q=2, smooth resonance)
            </li>
          </ul>
        </div>

        {/* MIDI Info */}
        <div className="p-6 border-2 border-neon-pink/40 rounded-lg bg-dark-surface/30 backdrop-blur-sm">
          <h3 className="text-neon-pink uppercase font-bold tracking-widest mb-3">
            🎹 MIDI Sequencing
          </h3>
          <ul className="space-y-2 text-xs text-neon-pink/70">
            <li>
              <strong>File Format:</strong> Standard MIDI (.mid, .midi)
            </li>
            <li>
              <strong>Transposition:</strong> ±24 semitones (2 octave range)
            </li>
            <li>
              <strong>Effects:</strong> MIDI notes routed through filter & echo
            </li>
          </ul>
        </div>
      </div>

      {/* Technical Specification Section */}
      <div className="p-6 border-2 border-neon-purple/30 rounded-lg bg-dark-surface/20 backdrop-blur-sm">
        <h3 className="text-neon-purple uppercase font-bold tracking-widest mb-4">
          📊 System Specifications
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-neon-purple/60 uppercase">Frequency Range</span>
            <span className="text-neon-purple font-bold">20 Hz - 1 kHz</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neon-purple/60 uppercase">Max Harmonics</span>
            <span className="text-neon-purple font-bold">256</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neon-purple/60 uppercase">Filter Cutoff</span>
            <span className="text-neon-purple font-bold">20 Hz - 1 kHz</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neon-purple/60 uppercase">Echo Delay</span>
            <span className="text-neon-purple font-bold">0 - 400 ms</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neon-purple/60 uppercase">MIDI Transpose</span>
            <span className="text-neon-purple font-bold">±24 semitones</span>
          </div>
          <div className="flex flex-col">
            <span className="text-neon-purple/60 uppercase">Supported Format</span>
            <span className="text-neon-purple font-bold">.mid / .midi</span>
          </div>
        </div>
      </div>

      {/* Bottom Border */}
      <div className="mt-12 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-30" />
    </div>
  );
}

export default App;
