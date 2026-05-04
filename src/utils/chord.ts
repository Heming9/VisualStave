import { Note, Chord, MidiMessage } from '../types';

const DEFAULT_CHORD_THRESHOLD = 60;

export class ChordDetector {
  private pendingNotes: Map<number, Note> = new Map();
  private chords: Map<string, Chord> = new Map();
  private chordThreshold: number;

  constructor(chordThreshold: number = DEFAULT_CHORD_THRESHOLD) {
    this.chordThreshold = chordThreshold;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  public handleMidiMessage(message: MidiMessage): {
    notes: Note[];
    chords: Chord[];
  } {
    if (message.type === 'noteOn') {
      const note: Note = {
        id: this.generateId(),
        pitch: message.pitch,
        velocity: message.velocity,
        startTime: message.timestamp,
        isPlaying: true,
      };

      this.pendingNotes.set(message.pitch, note);

      const notesToGroup = Array.from(this.pendingNotes.values()).filter(
        (n) => message.timestamp - n.startTime <= this.chordThreshold
      );

      if (notesToGroup.length > 0) {
        const chord: Chord = {
          id: this.generateId(),
          notes: notesToGroup,
          startTime: Math.min(...notesToGroup.map((n) => n.startTime)),
          isPlaying: true,
        };
        this.chords.set(chord.id, chord);
      }
    } else if (message.type === 'noteOff') {
      const note = this.pendingNotes.get(message.pitch);
      if (note) {
        note.isPlaying = false;
        note.endTime = message.timestamp;
        this.pendingNotes.delete(message.pitch);

        this.chords.forEach((chord) => {
          const chordNote = chord.notes.find((n) => n.pitch === message.pitch);
          if (chordNote) {
            chordNote.isPlaying = false;
            chordNote.endTime = message.timestamp;

            const allNotesEnded = chord.notes.every((n) => !n.isPlaying);
            if (allNotesEnded) {
              chord.isPlaying = false;
              chord.endTime = Math.max(...chord.notes.map((n) => n.endTime!));
            }
          }
        });
      }
    }

    const activeNotes = Array.from(this.pendingNotes.values());
    const activeChords = Array.from(this.chords.values()).filter(
      (c) => c.isPlaying
    );

    return { notes: activeNotes, chords: activeChords };
  }

  public clear(): void {
    this.pendingNotes.clear();
    this.chords.clear();
  }

  public getActiveChords(): Chord[] {
    return Array.from(this.chords.values()).filter((c) => c.isPlaying);
  }

  public getActiveNotes(): Note[] {
    return Array.from(this.pendingNotes.values());
  }
}

export const createChordDetector = (
  chordThreshold: number = DEFAULT_CHORD_THRESHOLD
) => {
  return new ChordDetector(chordThreshold);
};
