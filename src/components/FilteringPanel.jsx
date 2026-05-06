import React from 'react';
import { Slider, ControlPanel, Meter } from './Controls';

/**
 * Filtering Panel
 * Controls for low-pass filtering and frequency cutoff
 */
export const FilteringPanel = ({
  filterCutoff,
  onFilterCutoffChange,
}) => {
  // Calculate normalized cutoff (for display purposes)
  const maxCutoffFreq = 1000; // Match the slider range (20-1000Hz)
  const normalizedCutoff = ((filterCutoff - 20) / (maxCutoffFreq - 20)) * 100;

  return (
    <ControlPanel title="FILTERING">
      {/* Filter Status */}
      <div className="mb-6 p-3 border-2 border-neon-cyan/40 rounded-lg bg-dark-border/20">
        <span className="text-xs uppercase tracking-wider text-neon-cyan">
          ◈ Low-Pass Filter Active
        </span>
      </div>

      {/* Filter Meter */}
      <Meter label="CUTOFF FREQUENCY" value={normalizedCutoff} max={100} />

      {/* Cutoff Frequency Control */}
      <Slider
        label="Cutoff Frequency"
        value={filterCutoff}
        min={20}
        max={1000}
        step={1}
        onChange={onFilterCutoffChange}
        unit="Hz"
      />

      {/* Filter Specifications */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
          <div className="text-xs text-neon-magenta/70 uppercase tracking-wider">Type</div>
          <div className="text-xs text-neon-magenta font-bold mt-1">Lowpass</div>
        </div>
        <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
          <div className="text-xs text-neon-magenta/70 uppercase tracking-wider">Q Factor</div>
          <div className="text-xs text-neon-magenta font-bold mt-1">1.0 (Butterworth)</div>
        </div>
        <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
          <div className="text-xs text-neon-magenta/70 uppercase tracking-wider">Roll-off</div>
          <div className="text-xs text-neon-magenta font-bold mt-1">-6 dB/octave</div>
        </div>
      </div>

      {/* Filter Info */}
      <div className="p-4 border-2 border-neon-purple/40 rounded-lg bg-dark-border/20 mb-6">
        <p className="text-xs text-neon-purple/70 leading-relaxed">
          <strong>BiquadFilterNode (Low-Pass):</strong> Simulates an 8th-order Butterworth filter
          with smooth roll-off. Removes high-frequency noise (e.g., 3000+ Hz hiss). Q=1 provides
          flat response with minimal resonance for clean audio.
        </p>
      </div>

      {/* Frequency Response Visualization (simple) */}
      <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
        <div className="text-xs text-neon-cyan/70 uppercase tracking-wider mb-2">Frequency Response</div>
        <div className="flex items-end justify-between h-16 gap-1 pt-2">
          {[100, 150, 200, 250, 300, 400, 500, 600, 800, 1000].map((freq, idx) => {
            const passRatio = filterCutoff >= freq ? 1 : 0.2;
            return (
              <div
                key={idx}
                className="flex-1 bg-gradient-to-t from-neon-lime to-neon-cyan rounded-t transition-all duration-300"
                style={{
                  height: `${passRatio * 100}%`,
                  opacity: 0.7,
                }}
              />
            );
          })}
        </div>
        <div className="text-xs text-neon-cyan/50 mt-2 text-center">
          Pass → Stop Transition @ {filterCutoff.toFixed(0)} Hz
        </div>
      </div>
    </ControlPanel>
  );
};
