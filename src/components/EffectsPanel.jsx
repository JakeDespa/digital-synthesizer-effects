import React from 'react';
import { Slider, ControlPanel, Meter } from './Controls';

/**
 * Effects Panel
 * Controls for convolution, echo, and reverb-like effects
 */
export const EffectsPanel = ({
  echoDepth,
  onEchoDepthChange,
  isPlaying,
}) => {
  return (
    <ControlPanel title="EFFECTS & CONVOLUTION">
      {/* Echo Status */}
      <div className="mb-6 p-3 border-2 border-neon-pink/40 rounded-lg bg-dark-border/20">
        <span className="text-xs uppercase tracking-wider text-neon-pink">
          {echoDepth > 0 ? '◆ Echo Active' : '◇ Echo Inactive'}
        </span>
      </div>

      {/* Echo Depth Meter */}
      <Meter label="ECHO OUTPUT LEVEL" value={echoDepth * 100} max={100} />

      {/* Echo Depth Control */}
      <Slider
        label="Echo Depth"
        value={echoDepth}
        min={0}
        max={1}
        step={0.01}
        onChange={onEchoDepthChange}
        unit=""
      />

      {/* Convolution Info */}
      <div className="p-4 border-2 border-neon-lime/40 rounded-lg bg-dark-border/20 mb-6">
        <p className="text-xs text-neon-lime/70 leading-relaxed">
          <strong>LTI Convolution:</strong> Implements y[n] = x[n] + 0.5·x[n-4].
          Maps discrete delay (n-4) to 400ms temporal delay with 0.5 amplitude scaling.
        </p>
      </div>

      {/* Technical Parameters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
          <div className="text-xs text-neon-cyan/70 uppercase tracking-wider">Delay Buffer</div>
          <div className="text-sm text-neon-cyan font-bold mt-1">400 ms</div>
        </div>
        <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
          <div className="text-xs text-neon-cyan/70 uppercase tracking-wider">Feedback Coeff.</div>
          <div className="text-sm text-neon-cyan font-bold mt-1">0.50</div>
        </div>
      </div>

      {/* Processing Status */}
      <div className="p-3 border-l-4 border-neon-orange rounded-sm bg-neon-orange/5">
        <span className="text-xs uppercase tracking-wider text-neon-orange">
          → Convolution processing enabled
        </span>
      </div>
    </ControlPanel>
  );
};
