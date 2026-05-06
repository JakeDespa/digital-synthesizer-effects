import React from 'react';
import { Slider, Button, ControlPanel, Meter } from './Controls';

/**
 * Synthesizer Panel
 * Controls for oscillator, frequency, harmonics, and waveform selection
 */
export const SynthesizerPanel = ({
  isPlaying,
  frequency,
  harmonics,
  waveType,
  onStart,
  onStop,
  onFrequencyChange,
  onHarmonicsChange,
  onWaveTypeChange,
}) => {
  return (
    <ControlPanel title="SYNTHESIZER">
      {/* Play/Stop Controls */}
      <div className="mb-8 flex gap-4">
        <Button
          label={isPlaying ? '⏸ STOP' : '▶ PLAY'}
          onClick={isPlaying ? onStop : onStart}
          active={isPlaying}
          variant="primary"
        />
        <div className={`flex-1 border-2 border-neon-cyan p-3 rounded-lg text-center ${isPlaying ? 'bg-neon-cyan/10' : 'bg-dark-border/20'}`}>
          <span className="text-sm uppercase tracking-wider">
            {isPlaying ? '🔊 SYNTHESIZER ACTIVE' : '⊘ IDLE'}
          </span>
        </div>
      </div>

      {/* Signal Meter */}
      <Meter label="SIGNAL LEVEL" value={isPlaying ? 75 : 0} max={100} />

      {/* Frequency Control */}
      <Slider
        label="Frequency"
        value={frequency}
        min={20}
        max={1000}
        step={1}
        onChange={onFrequencyChange}
        unit="Hz"
      />

      {/* Harmonics Control */}
      <Slider
        label="Harmonics"
        value={harmonics}
        min={2}
        max={256}
        step={1}
        onChange={(value) => {
          onHarmonicsChange(value);
          if (isPlaying) {
            onStop();
          }
        }}
        unit=""
      />

      {/* Waveform Selection */}
      <div className="mb-6">
        <label className="text-sm font-bold text-neon-cyan uppercase tracking-wider mb-3 block">
          Waveform Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {['square', 'sawtooth', 'sine'].map((type) => (
            <Button
              key={type}
              label={type.toUpperCase()}
              onClick={() => {
                onWaveTypeChange(type);
                if (isPlaying) {
                  onStop();
                }
              }}
              active={waveType === type}
              variant="secondary"
            />
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 border-2 border-neon-magenta/40 rounded-lg bg-dark-border/20">
        <p className="text-xs text-neon-magenta/70 leading-relaxed">
          <strong>Custom Fourier Synthesis:</strong> Creates waveforms using Fourier coefficients.
          Square: B_k = 4/(k·π) (odd harmonics). Sawtooth: B_k = (-1)^(k+1)·(2/k) (all harmonics).
        </p>
      </div>
    </ControlPanel>
  );
};
