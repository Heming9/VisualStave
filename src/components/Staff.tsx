import React, { useRef, useEffect, type MutableRefObject } from 'react';
import { Note } from '../types';
import {
  GRAND_STAFF_LAYOUT,
  pitchToGrandStaffY,
  isBlackKey,
} from '../utils/music';

interface StaffProps {
  width?: number;
  height?: number;
  notes?: Note[];
  /** 会话起点（与 MIDI 时间轴一致），由父组件维护；不在 React state 里每帧更新 */
  sessionStartRef: MutableRefObject<number>;
  /** 滚动让播放头落后内容的时间（毫秒），默认 3000 */
  scrollLeadMs?: number;
  pixelsPerSecond?: number;
  showGrid?: boolean;
  bpm?: number;
}

const { lineSpacing: LINE_SPACING, trebleBottomY: TREBLE_BOTTOM_Y, bassTopY: BASS_TOP_Y, leftMargin: LEFT_MARGIN } =
  GRAND_STAFF_LAYOUT;

type FrameParams = {
  width: number;
  height: number;
  pixelsPerSecond: number;
  showGrid: boolean;
  bpm: number;
  notes: Note[];
};

function drawStaffFrame(
  ctx: CanvasRenderingContext2D,
  p: FrameParams,
  scrollPosition: number,
  currentTime: number,
): void {
  const { width, height, pixelsPerSecond, showGrid, bpm, notes } = p;

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

    const TREBLE_TOP = TREBLE_BOTTOM_Y - 4 * LINE_SPACING;
    const TREBLE_BOTTOM = TREBLE_BOTTOM_Y;
    const BASS_BOTTOM = BASS_TOP_Y + 4 * LINE_SPACING;

    let ledgerStartY = 0;
    let ledgerEndY = 0;
    let drawLedger = false;

    if (staff === 'treble' && y < TREBLE_TOP - LINE_SPACING) {
      ledgerStartY = TREBLE_TOP - LINE_SPACING;
      ledgerEndY = y + LINE_SPACING;
      drawLedger = true;
    }
    if (staff === 'treble' && y > TREBLE_BOTTOM + LINE_SPACING) {
      ledgerStartY = TREBLE_BOTTOM + LINE_SPACING;
      ledgerEndY = y - LINE_SPACING;
      drawLedger = true;
    }
    if (staff === 'bass' && y < BASS_TOP_Y - LINE_SPACING) {
      ledgerStartY = BASS_TOP_Y - LINE_SPACING;
      ledgerEndY = y + LINE_SPACING;
      drawLedger = true;
    }
    if (staff === 'bass' && y > BASS_BOTTOM + LINE_SPACING) {
      ledgerStartY = BASS_BOTTOM + LINE_SPACING;
      ledgerEndY = y - LINE_SPACING;
      drawLedger = true;
    }

    if (drawLedger) {
      const step = ledgerEndY > ledgerStartY ? LINE_SPACING : -LINE_SPACING;
      for (let ly = ledgerStartY; step > 0 ? ly <= ledgerEndY : ly >= ledgerEndY; ly += step) {
        ctx.beginPath();
        ctx.moveTo(x - 16, ly);
        ctx.lineTo(x + 16, ly);
        ctx.stroke();
      }
    }
  };

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const tailTime = note.endTime ?? currentTime;
    if (tailTime < visibleStartTime || note.startTime > visibleEndTime) continue;

    const xStart = timeToX(note.startTime);
    const xEnd = timeToX(tailTime);
    if (xEnd < LEFT_MARGIN - 50 || xStart > width + 50) continue;

    const { y, staff } = pitchToGrandStaffY(note.pitch);
    const alpha = 0.3 + (note.velocity / 127) * 0.7;
    const barWidth = Math.max(0, xEnd - xStart);

    if (barWidth > 1) {
      ctx.fillStyle = `rgba(79, 70, 229, ${alpha * 0.35})`;
      const bh = 10;
      const r = 4;
      const bx = xStart;
      const by = y - bh / 2;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, barWidth, bh, r);
      } else {
        ctx.rect(bx, by, barWidth, bh);
      }
      ctx.fill();
    }

    drawLedgerLines(xStart, y, staff);

    const NOTE_COLOR = `rgba(79, 70, 229, ${alpha})`;
    ctx.fillStyle = NOTE_COLOR;
    ctx.strokeStyle = NOTE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(xStart, y, 11, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isBlackKey(note.pitch)) {
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('#', xStart - 3, y - 2);
    }
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
  notes = [],
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
    notes,
  });

  frameParamsRef.current = {
    width,
    height,
    pixelsPerSecond,
    showGrid,
    bpm,
    notes,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const tick = () => {
      const elapsed = Date.now() - sessionStartRef.current;
      const scrollPosition = Math.max(0, elapsed - scrollLeadMs);
      drawStaffFrame(ctx, frameParamsRef.current, scrollPosition, elapsed);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [sessionStartRef, scrollLeadMs]);

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
