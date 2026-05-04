export interface BeamableNote {
  id: string;
  anchorMs: number;
  staff: 'treble' | 'bass';
  stemDown: boolean;
  y: number;
  stemX: number;
  headSpanMinX: number;
  headSpanMaxX: number;
  durationMs: number;
}

export interface BeamLayoutResult {
  flagCount: number;
  stemLen: number;
  stemTipY: number;
  isBeamed: boolean;
  beamParallelLines: number;
  beamOuterY: number | null;
  beamMinX: number | null;
  beamMaxX: number | null;
}

/** 外梁中心线端点 + 用于内梁法向的符头重心（相对梁中点） */
export interface BeamStroke {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  parallelLines: number;
  stemDown: boolean;
  headMeanX: number;
  headMeanY: number;
}

const MIN_BPM = 40;
const MAX_BPM = 220;
/** 符杠最大斜率 |dy/dx|（像素比），避免过陡 */
const MAX_BEAM_SLOPE = 0.11;

function quarterMsFromBpm(bpm: number): number {
  return 60000 / Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

/**
 * 将演奏时长量化到十六分音符网格，减轻 MIDI 抖动对符尾/符杠分组的影响。
 */
export function quantizeDurationMs(durationMs: number, bpm: number): number {
  const q = quarterMsFromBpm(bpm);
  const grid = q / 4;
  const n = Math.round(durationMs / grid);
  return Math.max(grid, n * grid);
}

export function classifyFlagCount(durationMs: number, bpm: number): number {
  const d = quantizeDurationMs(durationMs, bpm);
  const q = quarterMsFromBpm(bpm);
  if (d >= q * 0.9) return 0;
  if (d >= q * 0.42) return 1;
  if (d >= q * 0.22) return 2;
  return 3;
}

function defaultStemLenPx(stemLengthConst: number): number {
  return stemLengthConst;
}

function linearRegressionSlopeIntercept(
  points: readonly { x: number; y: number }[],
): { m: number; b: number } {
  const n = points.length;
  if (n < 2) return { m: 0, b: points[0]?.y ?? 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    const dx = p.x - mx;
    num += dx * (p.y - my);
    den += dx * dx;
  }
  let m = den > 1e-6 ? num / den : 0;
  m = Math.max(-MAX_BEAM_SLOPE, Math.min(MAX_BEAM_SLOPE, m));
  const b = my - m * mx;
  return { m, b };
}

export function layoutBeamAndStems(
  notes: BeamableNote[],
  bpm: number,
  stemLengthConst: number,
): { byId: Map<string, BeamLayoutResult>; beams: BeamStroke[] } {
  const quarterMs = quarterMsFromBpm(bpm);
  const eighthMs = quarterMs / 2;
  const byId = new Map<string, BeamLayoutResult>();
  const beams: BeamStroke[] = [];

  const flagById = new Map<string, number>();
  for (const n of notes) {
    flagById.set(n.id, classifyFlagCount(n.durationMs, bpm));
  }

  for (const n of notes) {
    const fc = flagById.get(n.id)!;
    const stemLen = defaultStemLenPx(stemLengthConst);
    const stemTipY = n.stemDown ? n.y + stemLen : n.y - stemLen;
    byId.set(n.id, {
      flagCount: fc,
      stemLen,
      stemTipY,
      isBeamed: false,
      beamParallelLines: 0,
      beamOuterY: null,
      beamMinX: null,
      beamMaxX: null,
    });
  }

  const short = notes.filter((n) => flagById.get(n.id)! >= 1);
  if (short.length < 2) return { byId, beams };

  for (const staff of ['treble', 'bass'] as const) {
    const list = short.filter((n) => n.staff === staff).sort((a, b) => a.anchorMs - b.anchorMs || a.y - b.y);
    let i = 0;
    while (i < list.length) {
      const start = list[i]!;
      const beatKey = Math.floor(start.anchorMs / quarterMs);
      const stemDown = start.stemDown;
      const group: BeamableNote[] = [start];
      let j = i + 1;
      while (j < list.length) {
        const m = list[j]!;
        if (Math.floor(m.anchorMs / quarterMs) !== beatKey) break;
        if (m.stemDown !== stemDown) break;
        const gap = m.anchorMs - group[group.length - 1]!.anchorMs;
        if (gap > eighthMs * 2.35) break;
        group.push(m);
        j++;
      }

      if (group.length >= 2) {
        const maxFlags = Math.min(3, Math.max(1, ...group.map((g) => flagById.get(g.id)!)));
        const stemLens = group.map(() => defaultStemLenPx(stemLengthConst));
        const defaultTips = group.map((g, idx) => (stemDown ? g.y + stemLens[idx]! : g.y - stemLens[idx]!));
        const pts = group.map((g, idx) => ({ x: g.stemX, y: defaultTips[idx]! }));
        const { m, b } = linearRegressionSlopeIntercept(pts);
        const pad = stemLengthConst * 0.06;
        const bAdj = stemDown ? b + pad : b - pad;

        /** 梁端必须落在最外两根符干的 stemX 上；混用符头 span 会左右不对称 → 一端悬空、一端外凸 */
        const stemXMin = Math.min(...group.map((g) => g.stemX));
        const stemXMax = Math.max(...group.map((g) => g.stemX));
        let x0 = stemXMin;
        let x1 = stemXMax;
        if (x1 - x0 < stemLengthConst * 0.35) {
          const cx = (x0 + x1) / 2;
          const half = (stemLengthConst * 0.35) / 2;
          x0 = cx - half;
          x1 = cx + half;
        }
        const y0 = m * x0 + bAdj;
        const y1 = m * x1 + bAdj;
        const headMeanY = group.reduce((s, g) => s + g.y, 0) / group.length;
        const headMeanX = group.reduce((s, g) => s + g.stemX, 0) / group.length;

        beams.push({
          x0,
          y0,
          x1,
          y1,
          parallelLines: maxFlags,
          stemDown,
          headMeanX,
          headMeanY,
        });

        for (let gi = 0; gi < group.length; gi++) {
          const g = group[gi]!;
          const tipOnBeam = m * g.stemX + bAdj;
          const stemLen = stemDown ? tipOnBeam - g.y : g.y - tipOnBeam;
          const stemTipY = stemDown ? g.y + stemLen : g.y - stemLen;
          byId.set(g.id, {
            flagCount: flagById.get(g.id)!,
            stemLen: Math.max(stemLengthConst * 0.35, stemLen),
            stemTipY,
            isBeamed: true,
            beamParallelLines: maxFlags,
            beamOuterY: tipOnBeam,
            beamMinX: x0,
            beamMaxX: x1,
          });
        }
        i = j;
      } else {
        i += 1;
      }
    }
  }

  return { byId, beams };
}
