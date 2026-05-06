import { useEffect, useRef, useCallback, useState } from 'react';
import MidiParser from 'midi-parser-js';

/**
 * MIDI Engine Hook
 * Handles MIDI file parsing and playback with pitch transposition
 */
export const useMIDIEngine = (audioContextRef, effectsChainRefs, initAudioContext) => {
  const midiDataRef = useRef(null);
  const midiOscillatorsRef = useRef([]);
  const midiNotesRef = useRef([]);
  const playbackTimeRef = useRef(0);
  const animationIdRef = useRef(null);
  const lastScheduledTimeRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [midiFile, setMidiFile] = useState(null);
  const [transposeAmount, setTransposeAmount] = useState(0); // in semitones
  const [midiWaveType, setMidiWaveType] = useState('sine'); // MIDI instrument waveform

  /**
   * Parse MIDI file and extract note data
   */
  const parseMIDIFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        console.log('MIDI file loaded, size:', data.byteLength, 'bytes');
        
        // Convert ArrayBuffer to Uint8Array, then to regular array for parser
        const uint8Array = new Uint8Array(data);
        const byteArray = Array.from(uint8Array);
        console.log('First 10 bytes:', byteArray.slice(0, 10));
        
        // Try parsing with both formats
        let midiData;
        try {
          // First try with Uint8Array
          midiData = MidiParser.parse(uint8Array);
        } catch (e1) {
          console.log('Failed with Uint8Array, trying plain array...');
          // Try with plain array
          midiData = MidiParser.parse(byteArray);
        }
        
        console.log('MIDI parsed successfully:', midiData);
        console.log('MIDI data structure:', JSON.stringify(Object.keys(midiData).map(k => ({ key: k, type: typeof midiData[k], value: midiData[k] })), null, 2));
        
        // The midi-parser-js returns track data in different format
        // Check if we can access tracks via different property names
        let tracksArray = null;
        if (Array.isArray(midiData.tracks)) {
          tracksArray = midiData.tracks;
        } else if (midiData.track && Array.isArray(midiData.track)) {
          tracksArray = midiData.track;
        } else if (midiData.Tracks && Array.isArray(midiData.Tracks)) {
          tracksArray = midiData.Tracks;
        } else {
          // Maybe tracks are in a different format - look through all properties
          for (const key in midiData) {
            if (Array.isArray(midiData[key]) && midiData[key].length > 0 && 
                typeof midiData[key][0] === 'object') {
              console.log(`Found potential tracks in property '${key}'`);
              tracksArray = midiData[key];
              break;
            }
          }
        }
        
        if (!tracksArray || !Array.isArray(tracksArray) || tracksArray.length === 0) {
          console.error('Could not find valid tracks in MIDI data');
          throw new Error('MIDI file contains no valid tracks');
        }
        
        processMIDIData(midiData, tracksArray);
        setMidiFile(file.name);
        console.log('MIDI file ready for playback');
      } catch (err) {
        console.error('Failed to parse MIDI file:', err);
        alert(`Error parsing MIDI file: ${err.message}`);
        setMidiFile(null);
      }
    };
    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
      alert('Failed to read MIDI file');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  /**
   * Process MIDI data and extract note events
   */
  const processMIDIData = useCallback((midiData, tracksArray) => {
    console.log('processMIDIData called with tracksArray:', tracksArray ? `${tracksArray.length} tracks` : 'null');
    console.log('tracksArray contents:', JSON.stringify(tracksArray?.slice(0, 1) || null, null, 2));
    
    if (!tracksArray || !Array.isArray(tracksArray) || tracksArray.length === 0) {
      console.error('No valid tracks provided to processMIDIData');
      throw new Error('MIDI file contains no tracks');
    }

    const notes = [];
    const headerData = midiData?.header || midiData?.Header || {};
    const ticksPerQuarter = headerData?.ticksPerQuarter || headerData?.ticksPerQua || midiData?.ticksPerQuarter || 480;
    let currentTempo = 500000; // Default: 120 BPM in microseconds per quarter note

    // Process all tracks
    tracksArray.forEach((track, trackIndex) => {
      console.log(`Processing track ${trackIndex}, type:`, typeof track, 'isArray:', Array.isArray(track), 'length:', track ? track.length : 'N/A');
      
      let time = 0;
      let trackNotes = 0;
      
      // Handle different track event formats
      let events = [];
      if (Array.isArray(track)) {
        events = track;
      } else if (typeof track === 'object' && track !== null) {
        // The midi-parser-js library uses track.event (lowercase, singular)
        if (Array.isArray(track.event)) {
          events = track.event;
        } else if (Array.isArray(track.events)) {
          events = track.events;
        } else if (Array.isArray(track.Event)) {
          events = track.Event;
        } else {
          // Try to extract events from numeric properties
          events = Object.values(track).filter(e => e && Array.isArray(e) && e.length > 0 && typeof e[0] === 'object');
        }
      }
      
      console.log(`Track ${trackIndex}: found ${events.length} events (${Array.isArray(events[0]) ? 'nested array' : 'direct events'})`);
      
      events.forEach((event, eventIdx) => {
        if (!event) return;
        
        time += event.deltaTime || 0;

        // Handle tempo changes (meta event)
        if ((event.meta === true || event.type === 0xFF) && event.metaType === 81 && event.data) {
          currentTempo = event.data;
          console.log(`Tempo set to ${120000000 / currentTempo} BPM`);
        }

        // Handle note on events (status 0x90)
        if ((event.type === 9 || event.type === 0x90) && event.data && event.data[0] !== undefined) {
          const noteNumber = event.data[0];
          const velocity = event.data[1] || 0;

          if (velocity > 0) {
            // Convert time to seconds
            const timeInSeconds = (time / ticksPerQuarter) * (currentTempo / 1000000);

            notes.push({
              noteNumber,
              velocity,
              startTime: timeInSeconds,
              duration: 0.5, // Default until note off
            });
            trackNotes++;
            console.log(`Note ON: note=${noteNumber}, vel=${velocity}, time=${timeInSeconds}`);
          }
        }

        // Handle note off events (status 0x80 or 0x90 with velocity 0)
        if ((event.type === 8 || event.type === 0x80 || (event.type === 9 && event.data && event.data[1] === 0)) && event.data && event.data[0] !== undefined) {
          const noteNumber = event.data[0];
          const timeInSeconds = (time / ticksPerQuarter) * (currentTempo / 1000000);

          // Find matching note on and set duration
          for (let i = notes.length - 1; i >= 0; i--) {
            if (notes[i].noteNumber === noteNumber && notes[i].duration === 0.5) {
              notes[i].duration = Math.max(0.05, timeInSeconds - notes[i].startTime);
              console.log(`Note OFF: note=${noteNumber}, duration=${notes[i].duration}`);
              break;
            }
          }
        }
      });
      
      console.log(`Track ${trackIndex}: ${trackNotes} note events extracted`);
    });

    console.log(`Total notes extracted: ${notes.length}`);
    if (notes.length === 0) {
      console.warn('No notes found in MIDI file!');
    }

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
    console.log('START called - isPlaying:', isPlaying, 'hasNotes:', midiNotesRef.current?.length);
    
    if (isPlaying || !midiNotesRef.current) {
      console.log('START EARLY RETURN - isPlaying:', isPlaying, 'hasNotes:', midiNotesRef.current?.length);
      return;
    }

    // Initialize audio context if needed (in case synthesizer hasn't been played)
    if (!audioContextRef.current) {
      console.log('MIDI: Initializing audio context');
      if (initAudioContext) {
        initAudioContext();
      }
    }

    if (!audioContextRef.current) {
      console.error('MIDI: Failed to initialize audio context');
      return;
    }

    const audioContext = audioContextRef.current;

    // Ensure effects chain is initialized
    const dryGain = effectsChainRefs?.dryGainNodeRef?.current;
    if (!dryGain) {
      console.error('MIDI: Effects chain (dryGainNode) not available. Audio context may not be properly initialized.');
      return;
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
        console.log('Audio context resumed');
      } catch (err) {
        console.error('Failed to resume audio context:', err);
        return;
      }
    }

    console.log('Starting MIDI playback with', midiNotesRef.current.length, 'notes');
    playbackTimeRef.current = audioContext.currentTime;
    lastScheduledTimeRef.current = -99999; // Initialize to very small number so first notes get scheduled
    setIsPlaying(true);

    const scheduleNotes = () => {
      const currentTime = audioContextRef.current.currentTime;
      const scheduleAheadTime = 0.1; // Schedule 100ms ahead

      console.log('scheduleNotes called - currentTime:', currentTime, 'playbackStart:', playbackTimeRef.current);

      // Schedule all notes that should play
      midiNotesRef.current.forEach((note, idx) => {
        const audioCTXStartTime = playbackTimeRef.current + note.startTime;
        const noteEndTime = audioCTXStartTime + note.duration;

        console.log(`Note ${idx}: scheduled=${lastScheduledTimeRef.current >= audioCTXStartTime}, shouldSchedule=${currentTime + scheduleAheadTime >= audioCTXStartTime}, startTime=${audioCTXStartTime}`);

        // Schedule this note if it hasn't been scheduled yet
        if (
          lastScheduledTimeRef.current < audioCTXStartTime &&
          currentTime + scheduleAheadTime >= audioCTXStartTime
        ) {
          console.log(`Scheduling note ${idx} at ${audioCTXStartTime}`);
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
        console.log('MIDI playback complete');
        setIsPlaying(false);
        stopAllNotes();
      }
    };

    animationIdRef.current = requestAnimationFrame(scheduleNotes);
  }, [isPlaying, transposeAmount, midiNoteToFrequency, effectsChainRefs, initAudioContext]);

  /**
   * Schedule a single MIDI note to play
   */
  const scheduleNote = useCallback(
    (frequency, startTime, endTime, velocity) => {
      const audioContext = audioContextRef.current;
      const dryGain = effectsChainRefs?.dryGainNodeRef?.current;

      console.log('scheduleNote:', { frequency, startTime, endTime, velocity, waveType: midiWaveType, hasDryGain: !!dryGain, hasAudioContext: !!audioContext });

      if (!audioContext || !dryGain) {
        console.error('Cannot schedule note - missing audioContext or dryGain');
        return;
      }

      try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.frequency.value = frequency;
        
        // Set waveform based on MIDI instrument selection
        // For custom waveforms, we'd need PeriodicWave, but built-in types work for MIDI
        if (midiWaveType === 'sine' || midiWaveType === 'square' || midiWaveType === 'sawtooth' || midiWaveType === 'triangle') {
          osc.type = midiWaveType;
        } else {
          // Default to sine if unknown type
          osc.type = 'sine';
        }

        // Apply MIDI velocity (0-127) to gain (0-1)
        const velocityGain = velocity / 127;
        gain.gain.setValueAtTime(velocityGain * 0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, endTime);

        osc.connect(gain);
        gain.connect(dryGain); // Route through effects

        console.log('Starting oscillator at', startTime, 'ending at', endTime, 'type:', osc.type);
        osc.start(startTime);
        osc.stop(endTime);

        midiOscillatorsRef.current.push({ oscillator: osc, gain });
      } catch (err) {
        console.error('Failed to schedule note:', err);
      }
    },
    [effectsChainRefs, midiWaveType]
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

  /**
   * Change MIDI instrument waveform
   */
  const changeMidiWaveType = useCallback((type) => {
    setMidiWaveType(type);
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
    midiWaveType,
    parseMIDIFile,
    start,
    stop,
    updateTranspose,
    changeMidiWaveType,
  };
};
