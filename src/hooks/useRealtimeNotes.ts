import { useEffect, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { MidiMessage, Note } from '../types';
import { useAppStore } from '../store/useAppStore';
import { computeAlignedStartTime } from '../utils/chordAlignment';

type SubscribeFn = (
  onMessage: (message: MidiMessage) => void,
  getElapsedMs: () => number,
) => () => void;

interface UseRealtimeNotesOptions {
  subscribeToMidi: SubscribeFn;
  enabled: boolean;
  sessionStartRef: MutableRefObject<number>;
}

export function useRealtimeNotes({
  subscribeToMidi,
  enabled,
  sessionStartRef,
}: UseRealtimeNotesOptions) {
  const chordThreshold = useAppStore((s) => s.chordThreshold);
  const setNotes = useAppStore((s) => s.setNotes);
  const incrementNoteCount = useAppStore((s) => s.incrementNoteCount);
  const incrementChordCount = useAppStore((s) => s.incrementChordCount);

  const notesRef = useRef<Note[]>([]);
  const lastNoteTimeRef = useRef(0);
  const flushScheduledRef = useRef(false);
  const flushRafRef = useRef(0);

  const clearRecording = useCallback(() => {
    lastNoteTimeRef.current = 0;
    notesRef.current = [];
    flushScheduledRef.current = false;
    if (flushRafRef.current) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = 0;
    }
    setNotes([]);
  }, [setNotes]);

  const scheduleNotesFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    flushRafRef.current = requestAnimationFrame(() => {
      flushScheduledRef.current = false;
      flushRafRef.current = 0;
      setNotes([...notesRef.current]);
    });
  }, [setNotes]);

  useEffect(() => {
    if (!enabled) return;

    notesRef.current = [...useAppStore.getState().notes];

    const getElapsedMs = () => Date.now() - sessionStartRef.current;

    const unsubscribe = subscribeToMidi((msg) => {
      if (msg.type === 'noteOn') {
        const timestamp = msg.timestamp;
        const alignedStart = computeAlignedStartTime(
          timestamp,
          notesRef.current,
          chordThreshold,
          lastNoteTimeRef.current,
        );
        lastNoteTimeRef.current = timestamp;

        const newNote = {
          id: `${timestamp}-${msg.pitch}`,
          pitch: msg.pitch,
          velocity: msg.velocity,
          startTime: alignedStart,
          isPlaying: true,
        };

        const next = [...notesRef.current, newNote];
        notesRef.current = next;
        scheduleNotesFlush();
        incrementNoteCount();

        const playingSameStart = next.filter(
          (n) => n.startTime === alignedStart && n.isPlaying,
        );
        if (playingSameStart.length === 2) {
          incrementChordCount();
        }
      } else {
        const timestamp = msg.timestamp;
        const next = notesRef.current.map((n) =>
          n.pitch === msg.pitch && n.isPlaying
            ? { ...n, isPlaying: false, endTime: timestamp }
            : n,
        );
        notesRef.current = next;
        scheduleNotesFlush();
      }
    }, getElapsedMs);

    return () => {
      if (flushRafRef.current) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = 0;
      }
      flushScheduledRef.current = false;
      unsubscribe();
    };
  }, [
    chordThreshold,
    enabled,
    incrementChordCount,
    incrementNoteCount,
    scheduleNotesFlush,
    sessionStartRef,
    subscribeToMidi,
  ]);

  return { clearRecording };
}
