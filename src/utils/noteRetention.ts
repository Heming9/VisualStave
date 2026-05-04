import type { Note } from '../types';

/**
 * 去掉「时值末端」已落在滚动视窗左沿左侧足够远处」的音符（等同已从画布流走）。
 * 仍在发声的音用 `elapsedMs` 作为末端，不会被误删。
 */
export function dropNotesFullyPastViewport(
  notes: readonly Note[],
  elapsedMs: number,
  scrollLeadMs: number,
  /** 视窗外再保留一段（毫秒） */
  marginMs: number,
): Note[] {
  const scrollPosition = Math.max(0, elapsedMs - scrollLeadMs);
  const cutoff = scrollPosition - marginMs;

  if (notes.length === 0) return [];

  if (cutoff <= 0) {
    return notes as Note[];
  }

  let start = 0;
  while (start < notes.length) {
    const tail = notes[start].endTime ?? elapsedMs;
    if (tail >= cutoff) break;
    start++;
  }

  if (start === 0) return notes as Note[];
  if (start >= notes.length) return [];

  return notes.slice(start);
}
