import { create } from 'zustand';
import { Note, Chord, MidiDevice } from '../types';

interface AppState {
  notes: Note[];
  chords: Chord[];
  selectedDevice: MidiDevice | null;
  devices: MidiDevice[];
  chordThreshold: number;
  showGrid: boolean;
  bpm: number;
  scrollPosition: number;
  currentTime: number;
  pixelsPerSecond: number;
  stats: {
    totalNotesPlayed: number;
    totalChordsPlayed: number;
  };
  setNotes: (notes: Note[]) => void;
  setChords: (chords: Chord[]) => void;
  setSelectedDevice: (device: MidiDevice | null) => void;
  setDevices: (devices: MidiDevice[]) => void;
  setChordThreshold: (threshold: number) => void;
  setShowGrid: (show: boolean) => void;
  setBpm: (bpm: number) => void;
  setScrollPosition: (position: number) => void;
  setCurrentTime: (time: number) => void;
  incrementNoteCount: () => void;
  incrementChordCount: () => void;
  resetStats: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  notes: [],
  chords: [],
  selectedDevice: null,
  devices: [],
  chordThreshold: 60,
  showGrid: true,
  bpm: 60,
  scrollPosition: 0,
  currentTime: 0,
  pixelsPerSecond: 100,
  stats: {
    totalNotesPlayed: 0,
    totalChordsPlayed: 0,
  },
  setNotes: (notes) => set({ notes }),
  setChords: (chords) => set({ chords }),
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  setDevices: (devices) => set({ devices }),
  setChordThreshold: (threshold) => set({ chordThreshold: threshold }),
  setShowGrid: (show) => set({ showGrid: show }),
  setBpm: (bpm) => set({ bpm }),
  setScrollPosition: (position) => set({ scrollPosition: position }),
  setCurrentTime: (time) => set({ currentTime: time }),
  incrementNoteCount: () => set((state) => ({
    stats: {
      ...state.stats,
      totalNotesPlayed: state.stats.totalNotesPlayed + 1,
    },
  })),
  incrementChordCount: () => set((state) => ({
    stats: {
      ...state.stats,
      totalChordsPlayed: state.stats.totalChordsPlayed + 1,
    },
  })),
  resetStats: () => set({
    stats: {
      totalNotesPlayed: 0,
      totalChordsPlayed: 0,
    },
  }),
}));
