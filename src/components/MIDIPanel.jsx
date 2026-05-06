import React from 'react';
import { Slider, Button, ControlPanel } from './Controls';

/**
 * MIDI Panel
 * Controls for MIDI file upload, playback, and transposition
 */
export const MIDIPanel = ({
  isPlaying,
  midiFile,
  transposeAmount,
  onPlayMIDI,
  onStopMIDI,
  onFileUpload,
  onTransposeChange,
}) => {
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file extension instead of MIME type (more reliable)
      const isMIDI = file.name.toLowerCase().endsWith('.mid') || 
                     file.name.toLowerCase().endsWith('.midi');
      
      if (isMIDI) {
        onFileUpload(file);
        e.target.value = ''; // Reset input
      } else {
        alert('Please select a valid MIDI file (.mid or .midi)');
        e.target.value = '';
      }
    }
  };

  return (
    <ControlPanel title="MIDI SEQUENCER">
      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-neon-cyan uppercase tracking-wider mb-3">
          Load MIDI File
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".mid,.midi"
            onChange={handleFileChange}
            className="hidden"
            id="midi-upload"
          />
          <label
            htmlFor="midi-upload"
            className="block w-full p-3 border-2 border-neon-cyan text-neon-cyan text-center cursor-pointer hover:bg-neon-cyan/10 transition-colors rounded-lg"
          >
            {midiFile ? `📄 ${midiFile}` : '📂 Click to select MIDI'}
          </label>
        </div>
      </div>

      {/* Play/Stop Controls */}
      {midiFile && (
        <div className="mb-8 flex gap-4">
          <Button
            label={isPlaying ? '⏸ STOP' : '▶ PLAY'}
            onClick={isPlaying ? onStopMIDI : onPlayMIDI}
            active={isPlaying}
            variant="primary"
          />
          <div
            className={`flex-1 border-2 border-neon-lime p-3 rounded-lg text-center ${
              isPlaying ? 'bg-neon-lime/10' : 'bg-dark-border/20'
            }`}
          >
            <span className="text-sm uppercase tracking-wider text-neon-lime">
              {isPlaying ? '▸ PLAYING' : '⊘ STOPPED'}
            </span>
          </div>
        </div>
      )}

      {/* Transposition Control */}
      {midiFile && (
        <>
          <Slider
            label="Transpose"
            value={transposeAmount}
            min={-24}
            max={24}
            step={1}
            onChange={onTransposeChange}
            unit="semitones"
          />

          <div className="p-4 border-2 border-neon-orange/40 rounded-lg bg-dark-border/20 mb-6">
            <p className="text-xs text-neon-orange/70 leading-relaxed">
              <strong>MIDI Transposition:</strong> Shift all MIDI notes up or down. Range: ±24 semitones (±2 octaves).
              Current: <span className="text-neon-orange">{transposeAmount > 0 ? '+' : ''}{transposeAmount}</span> semitones.
            </p>
          </div>

          {/* Note Information Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
              <div className="text-xs text-neon-cyan/70 uppercase tracking-wider">Status</div>
              <div className="text-sm text-neon-cyan font-bold mt-1">
                {isPlaying ? 'Playing' : 'Ready'}
              </div>
            </div>
            <div className="p-3 border-2 border-dark-border rounded-lg bg-dark-border/10">
              <div className="text-xs text-neon-cyan/70 uppercase tracking-wider">Effects</div>
              <div className="text-xs text-neon-cyan font-bold mt-1">
                Filter + Echo
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!midiFile && (
        <div className="p-4 border-2 border-neon-magenta/30 rounded-lg bg-dark-border/10">
          <p className="text-xs text-neon-magenta/60 text-center">
            Upload a MIDI file to begin sequencing
          </p>
        </div>
      )}
    </ControlPanel>
  );
};
