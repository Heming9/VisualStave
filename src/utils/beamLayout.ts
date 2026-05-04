export interface BeamableNote {
  id: string;
  anchorMs: number;
  staff: 'treble' | 'bass';
  /** 入参时的朝向（分组时不再强制一致）；符杠组内会覆盖 */
  stemDown: boolean;
  y: number;
  stemX: number;
  /** 符头中心 X，用于符杠统一朝向后重算 stemX */
  centerX: number;
  headSpanMinX: number;
  headSpanMaxX: number;
  durationMs: number;
  /** 同簇和弦（Staff 内 `${anchor}|${staff}`）；仅同一和弦内多音同时短时值时用于跳过退化符杠 */
  chordClusterKey?: string;
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
  /** 符杠组统一符干（仅 isBeamed 时写入） */
  beamedStemDown?: boolean;
  beamedStemX?: number;
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

/** 与和弦逻辑一致：距该谱表第三线最远的音决定整组符干朝向 */
function unifiedStemDownForBeamGroup(
  group: BeamableNote[],
  stemDownForStaff: (y: number, staff: 'treble' | 'bass') => boolean,
  midStaffY: (staff: 'treble' | 'bass') => number,
): boolean {
  const staff = group[0]!.staff;
  const midY = midStaffY(staff);
  let farY = group[0]!.y;
  let bestD = -1;
  for (const g of group) {
    const d = Math.abs(g.y - midY);
    if (d > bestD) {
      bestD = d;
      farY = g.y;
    }
  }
  return stemDownForStaff(farY, staff);
}

export function layoutBeamAndStems(
  notes: BeamableNote[],
  bpm: number,
  stemLengthConst: number,
  stemSideOffset: number,
  stemDownForStaff: (y: number, staff: 'treble' | 'bass') => boolean,
  midStaffY: (staff: 'treble' | 'bass') => number,
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
      const group: BeamableNote[] = [start];
      let j = i + 1;
      while (j < list.length) {
        const m = list[j]!;
        if (Math.floor(m.anchorMs / quarterMs) !== beatKey) break;
        const gap = m.anchorMs - group[group.length - 1]!.anchorMs;
        if (gap > eighthMs * 2.35) break;
        group.push(m);
        j++;
      }

      if (group.length >= 2) {
        const ck0 = group[0]!.chordClusterKey;
        const groupIsSingleChordCluster =
          ck0 !== undefined &&
          ck0.length > 0 &&
          group.every((g) => g.chordClusterKey === ck0);
        /** 同一和弦簇内多音 stemX 常相同，回归会退化成水平「符杠块」；无其它声部参与时不画符杠 */
        if (groupIsSingleChordCluster) {
          i = j;
          continue;
        }

        const unified = unifiedStemDownForBeamGroup(group, stemDownForStaff, midStaffY);
        const stemLenConst = defaultStemLenPx(stemLengthConst);
        const stemXs = group.map((g) =>
          unified ? g.centerX - stemSideOffset : g.centerX + stemSideOffset,
        );
        const defaultTips = group.map((_, idx) =>
          unified ? group[idx]!.y + stemLenConst : group[idx]!.y - stemLenConst,
        );
        const pts = group.map((_, idx) => ({ x: stemXs[idx]!, y: defaultTips[idx]! }));
        const { m, b } = linearRegressionSlopeIntercept(pts);
        const pad = stemLengthConst * 0.06;
        const bAdj = unified ? b + pad : b - pad;

        const stemXMin = Math.min(...stemXs);
        const stemXMax = Math.max(...stemXs);
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
        const headMeanX = stemXs.reduce((s, v) => s + v, 0) / stemXs.length;

        const maxFlags = Math.min(3, Math.max(1, ...group.map((g) => flagById.get(g.id)!)));

        beams.push({
          x0,
          y0,
          x1,
          y1,
          parallelLines: maxFlags,
          stemDown: unified,
          headMeanX,
          headMeanY,
        });

        for (let gi = 0; gi < group.length; gi++) {
          const g = group[gi]!;
          const sx = stemXs[gi]!;
          const tipOnBeam = m * sx + bAdj;
          const stemLen = unified ? tipOnBeam - g.y : g.y - tipOnBeam;
          const stemTipY = unified ? g.y + stemLen : g.y - stemLen;
          byId.set(g.id, {
            flagCount: flagById.get(g.id)!,
            stemLen: Math.max(stemLengthConst * 0.35, stemLen),
            stemTipY,
            isBeamed: true,
            beamParallelLines: maxFlags,
            beamOuterY: tipOnBeam,
            beamMinX: x0,
            beamMaxX: x1,
            beamedStemDown: unified,
            beamedStemX: sx,
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
