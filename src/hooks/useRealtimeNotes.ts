import { useEffect, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { MidiMessage, Note } from '../types';
import { useAppStore } from '../store/useAppStore';
import { computeAlignedStartTime } from '../utils/chordAlignment';
import { dropNotesFullyPastViewport } from '../utils/noteRetention';

const MAX_RETAINED_NOTES = 4000;
const STORE_SYNC_MS = 160;
const PRUNE_MARGIN_MS = 2800;
const PRUNE_INTERVAL_MS = 400;

type SubscribeFn = (
  onMessage: (message: MidiMessage) => void,
  getElapsedMs: () => number,
) => () => void;

export interface LiveMetrics {
  noteCount: number;
}

interface UseRealtimeNotesOptions {
  subscribeToMidi: SubscribeFn;
  enabled: boolean;
  sessionStartRef: MutableRefObject<number>;
  canvasNotesRef: MutableRefObject<Note[]>;
  onLiveMetrics?: (m: LiveMetrics) => void;
  scrollLeadMs?: number;
}

function trimNotesIfNeeded(list: Note[]): Note[] {
  if (list.length <= MAX_RETAINED_NOTES) return list;
  return list.slice(list.length - MAX_RETAINED_NOTES);
}

export function useRealtimeNotes({
  subscribeToMidi,
  enabled,
  sessionStartRef,
  canvasNotesRef,
  onLiveMetrics,
  scrollLeadMs = 3000,
}: UseRealtimeNotesOptions) {
  const chordThreshold = useAppStore((s) => s.chordThreshold);
  const setNotes = useAppStore((s) => s.setNotes);

  const notesRef = useRef<Note[]>([]);
  const lastNoteTimeRef = useRef(0);
  const lastStoreSyncRef = useRef(0);
  const storeSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statsPendingRef = useRef({ notes: 0, chords: 0 });
  const statsRafRef = useRef(0);

  const flushPendingStats = useCallback(() => {
    statsRafRef.current = 0;
    const p = statsPendingRef.current;
    statsPendingRef.current = { notes: 0, chords: 0 };
    if (p.notes !== 0 || p.chords !== 0) {
      useAppStore.getState().addNoteStatsDelta(p);
    }
  }, []);

  const queueStatsDelta = useCallback(
    (d: { notes?: number; chords?: number }) => {
      statsPendingRef.current.notes += d.notes ?? 0;
      statsPendingRef.current.chords += d.chords ?? 0;
      if (!statsRafRef.current) {
        statsRafRef.current = requestAnimationFrame(flushPendingStats);
      }
    },
    [flushPendingStats],
  );

  const flushToStore = useCallback(() => {
    const snapshot = notesRef.current;
    canvasNotesRef.current = snapshot;
    setNotes([...snapshot]);
    onLiveMetrics?.({ noteCount: snapshot.length });
  }, [canvasNotesRef, onLiveMetrics, setNotes]);

  const scheduleThrottledStoreSync = useCallback(() => {
    canvasNotesRef.current = notesRef.current;
    const now = performance.now();
    const elapsed = now - lastStoreSyncRef.current;

    if (elapsed >= STORE_SYNC_MS) {
      lastStoreSyncRef.current = now;
      if (storeSyncTimerRef.current) {
        clearTimeout(storeSyncTimerRef.current);
        storeSyncTimerRef.current = null;
      }
      flushToStore();
      return;
    }

    if (storeSyncTimerRef.current) return;

    storeSyncTimerRef.current = setTimeout(() => {
      storeSyncTimerRef.current = null;
      lastStoreSyncRef.current = performance.now();
      flushToStore();
    }, STORE_SYNC_MS - elapsed);
  }, [canvasNotesRef, flushToStore]);

  const pruneAndCommit = useCallback(
    (candidate: Note[]) => {
      const elapsed = Date.now() - sessionStartRef.current;
      let list = dropNotesFullyPastViewport(candidate, elapsed, scrollLeadMs, PRUNE_MARGIN_MS);
      list = trimNotesIfNeeded(list);
      notesRef.current = list;
      canvasNotesRef.current = list;
      scheduleThrottledStoreSync();
    },
    [canvasNotesRef, scheduleThrottledStoreSync, scrollLeadMs, sessionStartRef],
  );

  const clearRecording = useCallback(() => {
    lastNoteTimeRef.current = 0;
    lastStoreSyncRef.current = 0;
    if (storeSyncTimerRef.current) {
      clearTimeout(storeSyncTimerRef.current);
      storeSyncTimerRef.current = null;
    }
    if (statsRafRef.current) {
      cancelAnimationFrame(statsRafRef.current);
      statsRafRef.current = 0;
    }
    statsPendingRef.current = { notes: 0, chords: 0 };

    notesRef.current = [];
    canvasNotesRef.current = [];
    setNotes([]);
    onLiveMetrics?.({ noteCount: 0 });
  }, [canvasNotesRef, onLiveMetrics, setNotes]);

  useEffect(() => {
    if (!enabled) return;

    const initial = [...useAppStore.getState().notes];
    notesRef.current = initial;
    canvasNotesRef.current = initial;

    const getElapsedMs = () => Date.now() - sessionStartRef.current;

    const pruneIdle = () => {
      const elapsed = Date.now() - sessionStartRef.current;
      const prev = notesRef.current;
      let list = dropNotesFullyPastViewport(prev, elapsed, scrollLeadMs, PRUNE_MARGIN_MS);
      list = trimNotesIfNeeded(list);
      if (list === prev) return;
      notesRef.current = list;
      canvasNotesRef.current = list;
      scheduleThrottledStoreSync();
    };

    const pruneTimer = window.setInterval(pruneIdle, PRUNE_INTERVAL_MS);

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
        pruneAndCommit(next);
        queueStatsDelta({ notes: 1 });

        const playingSameStart = notesRef.current.filter(
          (n) => n.startTime === alignedStart && n.isPlaying,
        );
        if (playingSameStart.length === 2) {
          queueStatsDelta({ chords: 1 });
        }
      } else {
        const timestamp = msg.timestamp;
        const next = notesRef.current.map((n) =>
          n.pitch === msg.pitch && n.isPlaying
            ? { ...n, isPlaying: false, endTime: timestamp }
            : n,
        );
        pruneAndCommit(next);
      }
    }, getElapsedMs);

    return () => {
      window.clearInterval(pruneTimer);
      if (storeSyncTimerRef.current) {
        clearTimeout(storeSyncTimerRef.current);
        storeSyncTimerRef.current = null;
      }
      if (statsRafRef.current) {
        cancelAnimationFrame(statsRafRef.current);
        statsRafRef.current = 0;
      }
      const p = statsPendingRef.current;
      if (p.notes !== 0 || p.chords !== 0) {
        useAppStore.getState().addNoteStatsDelta(p);
      }
      statsPendingRef.current = { notes: 0, chords: 0 };

      unsubscribe();
    };
  }, [
    canvasNotesRef,
    chordThreshold,
    enabled,
    pruneAndCommit,
    queueStatsDelta,
    scheduleThrottledStoreSync,
    scrollLeadMs,
    sessionStartRef,
    subscribeToMidi,
  ]);

  return { clearRecording };
}
