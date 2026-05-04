import React, { useRef, useEffect, type MutableRefObject } from 'react';
import { Note } from '../types';
import {
  GRAND_STAFF_LAYOUT,
  pitchToGrandStaffY,
  getAccidentalUnicode,
  getLedgerLineYs,
} from '../utils/music';
import {
  anchorChordOnsetTimes,
  buildNoteHeadStaggerOffsets,
  compareNotesDrawOrder,
  CHORD_ONSET_CLUSTER_MS,
} from '../utils/chordLayout';

interface StaffProps {
  width?: number;
  height?: number;
  /** 画布每帧读取，不经 React；与 useRealtimeNotes 写入同一引用 */
  canvasNotesRef: MutableRefObject<Note[]>;
  sessionStartRef: MutableRefObject<number>;
  scrollLeadMs?: number;
  pixelsPerSecond?: number;
  showGrid?: boolean;
  bpm?: number;
}

const { lineSpacing: LINE_SPACING, trebleBottomY: TREBLE_BOTTOM_Y, bassTopY: BASS_TOP_Y, leftMargin: LEFT_MARGIN } =
  GRAND_STAFF_LAYOUT;

/** 间高约等于 LINE_SPACING；符头竖直径略小于间宽以免溢出 */
const NOTE_HEAD_RY = LINE_SPACING * 0.42;
const NOTE_HEAD_RX = LINE_SPACING * 0.48;

type FrameParams = {
  width: number;
  height: number;
  pixelsPerSecond: number;
  showGrid: boolean;
  bpm: number;
};

function drawStaffFrame(
  ctx: CanvasRenderingContext2D,
  p: FrameParams,
  scrollPosition: number,
  currentTime: number,
  notes: readonly Note[],
): void {
  const { width, height, pixelsPerSecond, showGrid, bpm } = p;

  const timeToX = (timeMs: number) =>
    LEFT_MARGIN +
    (timeMs / 1000) * pixelsPerSecond -
    scrollPosition * (pixelsPerSecond / 1000);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#1a202c';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = TREBLE_BOTTOM_Y - i * LINE_SPACING;
    ctx.beginPath();
    ctx.moveTo(LEFT_MARGIN - 20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  for (let i = 0; i < 5; i++) {
    const y = BASS_TOP_Y + i * LINE_SPACING;
    ctx.beginPath();
    ctx.moveTo(LEFT_MARGIN - 20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#1a202c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(LEFT_MARGIN - 20, TREBLE_BOTTOM_Y - 4 * LINE_SPACING);
  ctx.lineTo(LEFT_MARGIN - 20, TREBLE_BOTTOM_Y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(LEFT_MARGIN - 20, BASS_TOP_Y);
  ctx.lineTo(LEFT_MARGIN - 20, BASS_TOP_Y + 4 * LINE_SPACING);
  ctx.stroke();

  if (showGrid) {
    const beatDuration = 60000 / bpm;
    const startBeat = Math.floor(scrollPosition / beatDuration) * beatDuration;
    const visibleEndTime = scrollPosition + (width / pixelsPerSecond) * 1000;

    for (let i = 0; i < 50; i++) {
      const beatTime = startBeat + i * beatDuration;
      if (beatTime > visibleEndTime + beatDuration) break;

      const x = timeToX(beatTime);
      if (x < LEFT_MARGIN - 20 || x > width + 20) continue;

      ctx.strokeStyle = i % 4 === 0 ? 'rgba(99, 102, 241, 0.6)' : 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, TREBLE_BOTTOM_Y - 4 * LINE_SPACING - 30);
      ctx.lineTo(x, BASS_TOP_Y + 4 * LINE_SPACING + 30);
      ctx.stroke();
    }
  }

  const visibleStartTime = scrollPosition - 500;
  const visibleEndTime = scrollPosition + (width / pixelsPerSecond) * 1000 + 500;

  const drawLedgerLines = (x: number, y: number, staff: 'treble' | 'bass') => {
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 1.5;
    const halfHead = NOTE_HEAD_RY;
    for (const ly of getLedgerLineYs(y, staff, GRAND_STAFF_LAYOUT, halfHead)) {
      ctx.beginPath();
      ctx.moveTo(x - 16, ly);
      ctx.lineTo(x + 16, ly);
      ctx.stroke();
    }
  };

  let startIndex = 0;
  while (startIndex < notes.length) {
    const n = notes[startIndex];
    const tail = n.endTime ?? currentTime;
    if (tail >= visibleStartTime) break;
    startIndex++;
  }

  const candidates: Note[] = [];
  for (let i = startIndex; i < notes.length; i++) {
    const note = notes[i];
    const tailTime = note.endTime ?? currentTime;
    if (tailTime < visibleStartTime || note.startTime > visibleEndTime) continue;
    candidates.push(note);
  }

  const anchorById = anchorChordOnsetTimes(candidates, CHORD_ONSET_CLUSTER_MS);

  const visible: Note[] = [];
  for (const note of candidates) {
    const anchor = anchorById.get(note.id) ?? note.startTime;
    const xAnchor = timeToX(anchor);
    if (xAnchor < LEFT_MARGIN - 50 || xAnchor > width + 50) continue;
    visible.push(note);
  }

  const layoutItems = visible.map((note) => {
    const anchor = anchorById.get(note.id) ?? note.startTime;
    const { y } = pitchToGrandStaffY(note.pitch);
    return {
      id: note.id,
      pitch: note.pitch,
      anchorOnsetMs: anchor,
      xBase: timeToX(anchor),
      y,
    };
  });

  const dxMap = buildNoteHeadStaggerOffsets(layoutItems, {
    noteHeadRx: NOTE_HEAD_RX,
    noteHeadRy: NOTE_HEAD_RY,
    lineSpacing: LINE_SPACING,
  });

  visible.sort((a, b) => compareNotesDrawOrder(a, b, dxMap, anchorById));

  for (const note of visible) {
    const anchor = anchorById.get(note.id) ?? note.startTime;
    const xBase = timeToX(anchor);
    const dx = dxMap.get(note.id) ?? 0;
    const xDraw = xBase + dx;

    const { y, staff } = pitchToGrandStaffY(note.pitch);
    const alpha = 0.82 + (note.velocity / 127) * 0.18;

    drawLedgerLines(xDraw, y, staff);

    const accidental = getAccidentalUnicode(note.pitch);
    if (accidental) {
      const gapFromHead = LINE_SPACING * 0.42;
      const accRightX = xDraw - NOTE_HEAD_RX - gapFromHead;
      ctx.save();
      ctx.fillStyle = '#050505';
      ctx.font =
        '600 16px "Segoe UI Symbol", "Apple Symbols", "Noto Music", "Arial Unicode MS", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillText(accidental, accRightX, y);
      ctx.restore();
    }

    ctx.fillStyle = `rgba(12, 12, 14, ${alpha})`;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(xDraw, y, NOTE_HEAD_RX, NOTE_HEAD_RY, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const playheadX = timeToX(currentTime);
  if (playheadX >= LEFT_MARGIN - 20 && playheadX <= width - 20) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(playheadX, TREBLE_BOTTOM_Y - 4 * LINE_SPACING - 30);
    ctx.lineTo(playheadX, BASS_TOP_Y + 4 * LINE_SPACING + 30);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(playheadX, TREBLE_BOTTOM_Y - 4 * LINE_SPACING - 30);
    ctx.lineTo(playheadX - 8, TREBLE_BOTTOM_Y - 4 * LINE_SPACING - 15);
    ctx.lineTo(playheadX + 8, TREBLE_BOTTOM_Y - 4 * LINE_SPACING - 15);
    ctx.closePath();
    ctx.fill();
  }
}

export const Staff = React.memo(function Staff({
  width = 1200,
  height = 500,
  canvasNotesRef,
  sessionStartRef,
  scrollLeadMs = 3000,
  pixelsPerSecond = 100,
  showGrid = true,
  bpm = 60,
}: StaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameParamsRef = useRef<FrameParams>({
    width,
    height,
    pixelsPerSecond,
    showGrid,
    bpm,
  });

  frameParamsRef.current = {
    width,
    height,
    pixelsPerSecond,
    showGrid,
    bpm,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let rafId = 0;

    const step = () => {
      const elapsed = Date.now() - sessionStartRef.current;
      const scrollPosition = Math.max(0, elapsed - scrollLeadMs);
      drawStaffFrame(ctx, frameParamsRef.current, scrollPosition, elapsed, canvasNotesRef.current);
    };

    const loop = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        rafId = 0;
        return;
      }
      step();
      rafId = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        if (rafId !== 0) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else {
        kick();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    kick();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [canvasNotesRef, sessionStartRef, scrollLeadMs]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded-xl bg-white shadow-xl"
    />
  );
});

export default Staff;
