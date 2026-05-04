import type { Note } from '../types';

/**
 * 将相近时间触发的音符对齐到同一纵向时间轴（和弦“整齐”视觉）。
 */
export function computeAlignedStartTime(
  eventTime: number,
  notes: readonly Note[],
  chordThreshold: number,
  lastEventTime: number,
): number {
  let chordStartTime = eventTime;
  const timeDiff = eventTime - lastEventTime;
  if (timeDiff <= chordThreshold) {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (eventTime - note.startTime <= chordThreshold) {
        chordStartTime = note.startTime;
        break;
      }
    }
  }
  return chordStartTime;
}
