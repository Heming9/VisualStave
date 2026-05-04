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
import { layoutBeamAndStems, type BeamStroke } from '../utils/beamLayout';

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

/** 符干长度（约 3.5 间） */
const STEM_LENGTH = LINE_SPACING * 3.5;
/** 与倾斜椭圆符头视觉相接的水平偏移 */
const STEM_HEAD_X_FACTOR = 0.62;

function stemDownForStaff(y: number, staff: 'treble' | 'bass'): boolean {
  if (staff === 'treble') {
    const midY = TREBLE_BOTTOM_Y - 2 * LINE_SPACING;
    return y <= midY;
  }
  const midY = BASS_TOP_Y + 2 * LINE_SPACING;
  return y >= midY;
}

const BEAM_LINE_H = 2.9;
const BEAM_PARALLEL_GAP = 3.5;
/** 和弦等 stemX 重合时避免符杠过细（水平投影长度） */
const BEAM_MIN_WIDTH = LINE_SPACING * 0.44;
function fillSlantedBeamStrip(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfW: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * halfW;
  const py = (dx / len) * halfW;
  ctx.beginPath();
  ctx.moveTo(x0 + px, y0 + py);
  ctx.lineTo(x1 + px, y1 + py);
  ctx.lineTo(x1 - px, y1 - py);
  ctx.lineTo(x0 - px, y0 - py);
  ctx.closePath();
  ctx.fill();
}

function drawBeamStack(ctx: CanvasRenderingContext2D, beam: BeamStroke, alpha: number): void {
  const origX0 = beam.x0;
  const origX1 = beam.x1;
  let x0 = beam.x0;
  let y0 = beam.y0;
  let x1 = beam.x1;
  let y1 = beam.y1;
  if (Math.abs(x1 - x0) < BEAM_MIN_WIDTH) {
    const cx = (x0 + x1) / 2;
    const half = BEAM_MIN_WIDTH / 2;
    const dx0 = origX1 - origX0;
    const m = Math.abs(dx0) > 1e-6 ? (beam.y1 - beam.y0) / dx0 : 0;
    x0 = cx - half;
    x1 = cx + half;
    y0 = beam.y0 + m * (x0 - origX0);
    y1 = beam.y0 + m * (x1 - origX0);
  }

  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const signedDist = (-dy * (beam.headMeanX - x0) + dx * (beam.headMeanY - y0)) / len;
  let innerSign = -Math.sign(signedDist) || -1;
  if (!beam.stemDown) innerSign *= -1;

  const halfW = BEAM_LINE_H / 2;
  const a = Math.min(1, alpha * 0.98);
  ctx.fillStyle = `rgba(22, 22, 28, ${a})`;
  for (let k = beam.parallelLines - 1; k >= 0; k--) {
    const ox = innerSign * nx * BEAM_PARALLEL_GAP * k;
    const oy = innerSign * ny * BEAM_PARALLEL_GAP * k;
    fillSlantedBeamStrip(ctx, x0 + ox, y0 + oy, x1 + ox, y1 + oy, halfW);
  }
}

function drawOneEighthFlag(
  ctx: CanvasRenderingContext2D,
  sx: number,
  tipY: number,
  stemDown: boolean,
  alpha: number,
): void {
  const w = LINE_SPACING * 0.52;
  const h = LINE_SPACING * 1.05;
  ctx.fillStyle = `rgba(22, 22, 28, ${alpha * 0.96})`;
  ctx.beginPath();
  if (stemDown) {
    ctx.moveTo(sx, tipY);
    ctx.quadraticCurveTo(sx + w * 1.15, tipY + h * 0.12, sx + w * 0.82, tipY + h);
    ctx.quadraticCurveTo(sx + w * 0.28, tipY + h * 0.62, sx, tipY + h * 0.28);
  } else {
    ctx.moveTo(sx, tipY);
    ctx.quadraticCurveTo(sx - w * 1.15, tipY - h * 0.12, sx - w * 0.82, tipY - h);
    ctx.quadraticCurveTo(sx - w * 0.28, tipY - h * 0.62, sx, tipY - h * 0.28);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStackedFlags(
  ctx: CanvasRenderingContext2D,
  sx: number,
  stemTipY: number,
  stemDown: boolean,
  flagCount: number,
  alpha: number,
): void {
  const stack = LINE_SPACING * 0.36;
  for (let f = 0; f < flagCount; f++) {
    const along = f * stack;
    const tipY = stemDown ? stemTipY - along : stemTipY + along;
    drawOneEighthFlag(ctx, sx, tipY, stemDown, alpha);
  }
}

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
    const gridVisibleEndTime = scrollPosition + (width / pixelsPerSecond) * 1000;

    for (let i = 0; i < 50; i++) {
      const beatTime = startBeat + i * beatDuration;
      if (beatTime > gridVisibleEndTime + beatDuration) break;

      const x = timeToX(beatTime);
      if (x < LEFT_MARGIN - 20 || x > width + 20) continue;

      /** 按绝对拍号对齐小节强拍（4/4：每 4 拍一条加粗），勿用循环下标 i%4（会随滚动错位） */
      const beatIndex = Math.floor(beatTime / beatDuration + 1e-9);
      const isBarlineBeat = beatIndex % 4 === 0;

      ctx.strokeStyle = isBarlineBeat ? 'rgba(99, 102, 241, 0.6)' : 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = isBarlineBeat ? 2 : 1;
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

  const clusterMembers = new Map<string, Note[]>();
  for (const note of visible) {
    const anchor = anchorById.get(note.id) ?? note.startTime;
    const { staff } = pitchToGrandStaffY(note.pitch);
    const k = `${anchor}|${staff}`;
    if (!clusterMembers.has(k)) clusterMembers.set(k, []);
    clusterMembers.get(k)!.push(note);
  }

  /** 同 anchor + 同谱表：共用一根符干（符杠宽度用整组符头 span） */
  const chordStemInfo = new Map<string, { championId: string; stemDown: boolean; stemX: number }>();
  for (const [, members] of clusterMembers) {
    if (members.length < 2) continue;
    const staff = pitchToGrandStaffY(members[0]!.pitch).staff;
    const ys = members.map((m) => pitchToGrandStaffY(m.pitch).y);
    const midY =
      staff === 'treble' ? TREBLE_BOTTOM_Y - 2 * LINE_SPACING : BASS_TOP_Y + 2 * LINE_SPACING;
    let farY = ys[0]!;
    let bestD = -1;
    for (const y of ys) {
      const d = Math.abs(y - midY);
      if (d > bestD) {
        bestD = d;
        farY = y;
      }
    }
    const chordStemDown = stemDownForStaff(farY, staff);
    const champion = chordStemDown
      ? members.reduce((a, b) => (a.pitch < b.pitch ? a : b))
      : members.reduce((a, b) => (a.pitch > b.pitch ? a : b));
    const championAnchor = anchorById.get(champion.id) ?? champion.startTime;
    const championXDraw = timeToX(championAnchor) + (dxMap.get(champion.id) ?? 0);
    const sharedStemX = chordStemDown
      ? championXDraw - NOTE_HEAD_RX * STEM_HEAD_X_FACTOR
      : championXDraw + NOTE_HEAD_RX * STEM_HEAD_X_FACTOR;
    for (const m of members) {
      chordStemInfo.set(m.id, {
        championId: champion.id,
        stemDown: chordStemDown,
        stemX: sharedStemX,
      });
    }
  }

  const beamInputs = visible.map((note) => {
    const anchor = anchorById.get(note.id) ?? note.startTime;
    const dx = dxMap.get(note.id) ?? 0;
    const xBase = timeToX(anchor);
    const xDraw = xBase + dx;
    const { y, staff } = pitchToGrandStaffY(note.pitch);
    const k = `${anchor}|${staff}`;
    const group = clusterMembers.get(k)!;
    const xDraws = group.map(
      (nn) => timeToX(anchorById.get(nn.id) ?? nn.startTime) + (dxMap.get(nn.id) ?? 0),
    );
    const headSpanMinX = Math.min(...xDraws) - NOTE_HEAD_RX * 0.65;
    const headSpanMaxX = Math.max(...xDraws) + NOTE_HEAD_RX * 0.65;
    const chord = chordStemInfo.get(note.id);
    const stemDown = chord?.stemDown ?? stemDownForStaff(y, staff);
    const stemX =
      chord?.stemX ??
      (stemDown ? xDraw - NOTE_HEAD_RX * STEM_HEAD_X_FACTOR : xDraw + NOTE_HEAD_RX * STEM_HEAD_X_FACTOR);
    const durationMs = Math.max(1, (note.endTime ?? currentTime) - note.startTime);
    return {
      id: note.id,
      anchorMs: anchor,
      staff,
      stemDown,
      y,
      stemX,
      headSpanMinX,
      headSpanMaxX,
      durationMs,
    };
  });

  const { byId: beamById, beams } = layoutBeamAndStems(beamInputs, bpm, STEM_LENGTH);

  type NoteRow = {
    note: Note;
    xDraw: number;
    y: number;
    staff: 'treble' | 'bass';
    alpha: number;
    stemX: number;
    stemDown: boolean;
    stemLen: number;
    stemTipY: number;
    flagCount: number;
    isBeamed: boolean;
    drawsStem: boolean;
    drawsFlags: boolean;
  };

  const rows: NoteRow[] = visible.map((note) => {
    const anchor = anchorById.get(note.id) ?? note.startTime;
    const xBase = timeToX(anchor);
    const dx = dxMap.get(note.id) ?? 0;
    const xDraw = xBase + dx;
    const { y, staff } = pitchToGrandStaffY(note.pitch);
    const alpha = 0.82 + (note.velocity / 127) * 0.18;
    const blSelf = beamById.get(note.id)!;
    const chord = chordStemInfo.get(note.id);
    const championBl = chord ? beamById.get(chord.championId)! : blSelf;
    const stemDown = chord?.stemDown ?? stemDownForStaff(y, staff);
    const stemX =
      chord?.stemX ??
      (stemDown ? xDraw - NOTE_HEAD_RX * STEM_HEAD_X_FACTOR : xDraw + NOTE_HEAD_RX * STEM_HEAD_X_FACTOR);
    const drawsStem = !chord || chord.championId === note.id;
    const drawsFlags = drawsStem && !championBl.isBeamed && championBl.flagCount > 0;
    return {
      note,
      xDraw,
      y,
      staff,
      alpha,
      stemX,
      stemDown,
      stemLen: drawsStem ? championBl.stemLen : 0,
      stemTipY: drawsStem ? championBl.stemTipY : 0,
      flagCount: championBl.flagCount,
      isBeamed: blSelf.isBeamed,
      drawsStem,
      drawsFlags,
    };
  });

  for (const r of rows) {
    drawLedgerLines(r.xDraw, r.y, r.staff);
  }

  /** 符梁盖住符干端点；圆帽会伸出梁外形成突起，故符杠音符用平头并略缩进梁内 */
  const STEM_BEAM_TRIM = 0.65;

  for (const r of rows) {
    if (!r.drawsStem) continue;
    let stemY1 = r.stemDown ? r.y + r.stemLen : r.y - r.stemLen;
    if (r.isBeamed) {
      stemY1 = r.stemDown ? stemY1 - STEM_BEAM_TRIM : stemY1 + STEM_BEAM_TRIM;
    }
    ctx.save();
    ctx.strokeStyle = `rgba(26, 26, 30, ${r.alpha})`;
    ctx.lineWidth = 1.35;
    ctx.lineCap = r.isBeamed ? 'butt' : 'round';
    ctx.beginPath();
    ctx.moveTo(r.stemX, r.y);
    ctx.lineTo(r.stemX, stemY1);
    ctx.stroke();
    ctx.restore();
  }

  for (const b of beams) {
    drawBeamStack(ctx, b, 0.9);
  }

  for (const r of rows) {
    if (!r.drawsFlags) continue;
    drawStackedFlags(ctx, r.stemX, r.stemTipY, r.stemDown, r.flagCount, r.alpha);
  }

  for (const r of rows) {
    const accidental = getAccidentalUnicode(r.note.pitch);
    if (accidental) {
      const gapFromHead = LINE_SPACING * 0.42;
      const accRightX = r.xDraw - NOTE_HEAD_RX - gapFromHead;
      ctx.save();
      ctx.fillStyle = '#050505';
      ctx.font =
        '600 16px "Segoe UI Symbol", "Apple Symbols", "Noto Music", "Arial Unicode MS", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillText(accidental, accRightX, r.y);
      ctx.restore();
    }
  }

  for (const r of rows) {
    ctx.fillStyle = `rgba(12, 12, 14, ${r.alpha})`;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(r.xDraw, r.y, NOTE_HEAD_RX, NOTE_HEAD_RY, -0.3, 0, Math.PI * 2);
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
