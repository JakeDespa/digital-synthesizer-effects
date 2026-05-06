import React from 'react';

/**
 * Slider Component
 * Reusable slider with neon styling
 */
export const Slider = ({ label, value, min, max, step, onChange, unit = '' }) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-bold text-neon-cyan uppercase tracking-wider">
          {label}
        </label>
        <span className="text-neon-magenta font-bold">
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-neon-cyan"
        style={{
          background: `linear-gradient(to right, #00f0ff 0%, #00f0ff ${((value - min) / (max - min)) * 100}%, #2a3050 ${((value - min) / (max - min)) * 100}%, #2a3050 100%)`
        }}
      />
    </div>
  );
};

/**
 * Button Component
 * Reusable button with neon styling
 */
export const Button = ({ label, onClick, active = false, variant = 'primary' }) => {
  const baseClass = 'px-6 py-2 font-bold uppercase tracking-wider border-2 transition-all duration-200 text-sm';
  const primaryClass = active
    ? 'bg-neon-cyan text-dark-bg border-neon-cyan shadow-neon-lg'
    : 'bg-transparent border-neon-cyan text-neon-cyan hover:shadow-neon hover:bg-neon-cyan hover:text-dark-bg';
  
  const secondaryClass = active
    ? 'bg-neon-magenta text-dark-bg border-neon-magenta shadow-neon-lg'
    : 'bg-transparent border-neon-magenta text-neon-magenta hover:shadow-neon hover:bg-neon-magenta hover:text-dark-bg';

  const buttonClass = variant === 'secondary' ? secondaryClass : primaryClass;

  return (
    <button
      onClick={onClick}
      className={`${baseClass} ${buttonClass}`}
    >
      {label}
    </button>
  );
};

/**
 * Control Panel Section
 * Container for control groups
 */
export const ControlPanel = ({ title, children }) => {
  return (
    <div className="border-2 border-neon-cyan p-6 rounded-lg bg-dark-surface/50 backdrop-blur-sm">
      <h2 className="text-lg font-bold text-neon-cyan uppercase tracking-widest mb-6 pb-4 border-b-2 border-dark-border">
        ▸ {title}
      </h2>
      {children}
    </div>
  );
};

/**
 * Meter Component
 * Visual feedback for signal levels
 */
export const Meter = ({ label, value, max = 100 }) => {
  const percentage = (value / max) * 100;
  return (
    <div className="mb-4">
      <div className="text-xs text-neon-cyan uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="w-full h-3 bg-dark-border rounded-sm overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-lime to-neon-cyan transition-all duration-100"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
