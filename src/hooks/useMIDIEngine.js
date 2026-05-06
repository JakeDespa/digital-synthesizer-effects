import { useEffect, useRef, useCallback, useState } from 'react';
import MidiParser from 'midi-parser-js';

/**
 * MIDI Engine Hook
 * Handles MIDI file parsing and playback with pitch transposition
 */
export const useMIDIEngine = (audioContextRef, effectsChainRefs) => {
  const midiDataRef = useRef(null);
  const midiOscillatorsRef = useRef([]);
  const midiNotesRef = useRef([]);
  const playbackTimeRef = useRef(0);
  const animationIdRef = useRef(null);
  const lastScheduledTimeRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [midiFile, setMidiFile] = useState(null);
  const [transposeAmount, setTransposeAmount] = useState(0); // in semitones

  /**
   * Parse MIDI file and extract note data
   */
  const parseMIDIFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const midiData = MidiParser.parse(data);
        processMIDIData(midiData);
        setMidiFile(file.name);
      } catch (err) {
        console.error('Failed to parse MIDI file:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  /**
   * Process MIDI data and extract note events
   */
  const processMIDIData = useCallback((midiData) => {
    if (!midiData || !midiData.tracks) {
      console.error('Invalid MIDI data');
      return;
    }

    const notes = [];
    const ticksPerQuarter = midiData.header.ticksPerQuarter;
    let currentTempo = 500000; // Default: 120 BPM in microseconds per quarter note

    // Process all tracks
    midiData.tracks.forEach((track) => {
      let time = 0;
      track.forEach((event) => {
        time += event.deltaTime;

        // Handle tempo changes
        if (event.meta === true && event.metaType === 81) {
          currentTempo = event.data; // microseconds per quarter note
        }

        // Handle note on events
        if (event.type === 9 && event.data[1] !== undefined) {
          const noteNumber = event.data[0];
          const velocity = event.data[1];

          if (velocity > 0) {
            // Convert time to seconds
            const timeInSeconds = (time / ticksPerQuarter) * (currentTempo / 1000000);

            notes.push({
              noteNumber,
              velocity,
              startTime: timeInSeconds,
            });
          }
        }

        // Handle note off events
        if ((event.type === 8 || (event.type === 9 && event.data[1] === 0)) && event.data[0] !== undefined) {
          const noteNumber = event.data[0];
          const timeInSeconds = (time / ticksPerQuarter) * (currentTempo / 1000000);

          // Find matching note on and set duration
          for (let i = notes.length - 1; i >= 0; i--) {
            if (notes[i].noteNumber === noteNumber && !notes[i].duration) {
              notes[i].duration = Math.max(0.05, timeInSeconds - notes[i].startTime);
              break;
            }
          }
        }
      });
    });

    // Ensure all notes have a duration
    notes.forEach((note) => {
      if (!note.duration) {
        note.duration = 0.5; // Default 500ms
      }
    });

    midiNotesRef.current = notes.sort((a, b) => a.startTime - b.startTime);
    midiDataRef.current = midiData;
  }, []);

  /**
   * Convert MIDI note number to frequency in Hz
   * A4 (MIDI 69) = 440 Hz
   */
  const midiNoteToFrequency = useCallback((noteNumber, transposeSemitones = 0) => {
    const A4 = 440;
    const A4_MIDI = 69;
    const adjustedNote = noteNumber + transposeSemitones;
    const semitonesFromA4 = adjustedNote - A4_MIDI;
    return A4 * Math.pow(2, semitonesFromA4 / 12);
  }, []);

  /**
   * Stop all playing MIDI notes
   */
  const stopAllNotes = useCallback(() => {
    midiOscillatorsRef.current.forEach((osc) => {
      if (osc && osc.oscillator) {
        try {
          osc.oscillator.stop();
          osc.oscillator.disconnect();
        } catch (e) {
          // Oscillator already stopped
        }
      }
    });
    midiOscillatorsRef.current = [];
  }, []);

  /**
   * Start MIDI playback
   */
  const start = useCallback(async () => {
    if (isPlaying || !midiNotesRef.current || !audioContextRef.current) return;

    const audioContext = audioContextRef.current;

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (err) {
        console.error('Failed to resume audio context:', err);
        return;
      }
    }

    playbackTimeRef.current = audioContext.currentTime;
    lastScheduledTimeRef.current = 0;
    setIsPlaying(true);

    const scheduleNotes = () => {
      const currentTime = audioContextRef.current.currentTime;
      const scheduleAheadTime = 0.1; // Schedule 100ms ahead

      // Schedule all notes that should play
      midiNotesRef.current.forEach((note) => {
        const audioCTXStartTime = playbackTimeRef.current + note.startTime;
        const noteEndTime = audioCTXStartTime + note.duration;

        // Schedule this note if it hasn't been scheduled yet
        if (
          lastScheduledTimeRef.current < audioCTXStartTime &&
          currentTime + scheduleAheadTime >= audioCTXStartTime
        ) {
          const frequency = midiNoteToFrequency(note.noteNumber, transposeAmount);
          scheduleNote(frequency, audioCTXStartTime, noteEndTime, note.velocity);
          lastScheduledTimeRef.current = Math.max(lastScheduledTimeRef.current, audioCTXStartTime);
        }
      });

      // Calculate total MIDI duration
      const maxEndTime = Math.max(
        ...midiNotesRef.current.map((n) => n.startTime + n.duration)
      );

      // Continue scheduling if playback is still ongoing
      if (currentTime < playbackTimeRef.current + maxEndTime) {
        animationIdRef.current = requestAnimationFrame(scheduleNotes);
      } else {
        setIsPlaying(false);
        stopAllNotes();
      }
    };

    animationIdRef.current = requestAnimationFrame(scheduleNotes);
  }, [isPlaying, transposeAmount, midiNoteToFrequency]);

  /**
   * Schedule a single MIDI note to play
   */
  const scheduleNote = useCallback(
    (frequency, startTime, endTime, velocity) => {
      const audioContext = audioContextRef.current;
      const dryGain = effectsChainRefs?.dryGainNodeRef?.current;

      if (!audioContext || !dryGain) return;

      try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.frequency.value = frequency;
        osc.type = 'sine'; // MIDI notes use sine wave

        // Apply MIDI velocity (0-127) to gain (0-1)
        const velocityGain = velocity / 127;
        gain.gain.setValueAtTime(velocityGain * 0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, endTime);

        osc.connect(gain);
        gain.connect(dryGain); // Route through effects

        osc.start(startTime);
        osc.stop(endTime);

        midiOscillatorsRef.current.push({ oscillator: osc, gain });
      } catch (err) {
        console.error('Failed to schedule note:', err);
      }
    },
    [effectsChainRefs]
  );

  /**
   * Stop MIDI playback
   */
  const stop = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    stopAllNotes();
    setIsPlaying(false);
  }, [stopAllNotes]);

  /**
   * Update transpose amount (in semitones)
   */
  const updateTranspose = useCallback((semitones) => {
    setTransposeAmount(semitones);
  }, []);

  useEffect(() => {
    return () => {
      if (isPlaying) {
        stop();
      }
    };
  }, []);

  return {
    isPlaying,
    midiFile,
    transposeAmount,
    parseMIDIFile,
    start,
    stop,
    updateTranspose,
  };
};
