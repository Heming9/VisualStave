export interface Note {
  id: string;
  pitch: number;
  velocity: number;
  startTime: number;
  endTime?: number;
  isPlaying: boolean;
}

export interface Chord {
  id: string;
  notes: Note[];
  startTime: number;
  endTime?: number;
  isPlaying: boolean;
}

export type MidiMessageType = 'noteOn' | 'noteOff';

export interface MidiMessage {
  type: MidiMessageType;
  pitch: number;
  velocity: number;
  timestamp: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  input: MIDIInput;
}
