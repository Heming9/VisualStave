export interface BeamableNote {
  id: string;
  anchorMs: number;
  staff: 'treble' | 'bass';
  stemDown: boolean;
  y: number;
  /** 和弦共用一根符干时的竖线 X；符杠水平范围用 headSpan */
  stemX: number;
  /** 同簇符头左右范围，用于符杠宽度（单音时与符头宽度一致即可） */
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

export interface BeamStroke {
  beamMinX: number;
  beamMaxX: number;
  beamOuterY: number;
  parallelLines: number;
  stemDown: boolean;
}

const MIN_BPM = 40;
const MAX_BPM = 220;

export function classifyFlagCount(durationMs: number, bpm: number): number {
  const q = 60000 / Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
  if (durationMs >= q * 0.9) return 0;
  if (durationMs >= q * 0.42) return 1;
  if (durationMs >= q * 0.22) return 2;
  return 3;
}

function defaultStemLenPx(stemLengthConst: number): number {
  return stemLengthConst;
}

export function layoutBeamAndStems(
  notes: BeamableNote[],
  bpm: number,
  stemLengthConst: number,
): { byId: Map<string, BeamLayoutResult>; beams: BeamStroke[] } {
  const quarterMs = 60000 / Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
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
        const beamPad = stemLengthConst * 0.06;
        const beamOuterY = stemDown ? Math.max(...defaultTips) + beamPad : Math.min(...defaultTips) - beamPad;
        const minX = Math.min(...group.map((g) => g.headSpanMinX));
        const maxX = Math.max(...group.map((g) => g.headSpanMaxX));

        beams.push({
          beamMinX: minX,
          beamMaxX: maxX,
          beamOuterY,
          parallelLines: maxFlags,
          stemDown,
        });

        for (const g of group) {
          const stemLen = stemDown ? beamOuterY - g.y : g.y - beamOuterY;
          const stemTipY = stemDown ? g.y + stemLen : g.y - stemLen;
          byId.set(g.id, {
            flagCount: flagById.get(g.id)!,
            stemLen: Math.max(stemLengthConst * 0.35, stemLen),
            stemTipY,
            isBeamed: true,
            beamParallelLines: maxFlags,
            beamOuterY,
            beamMinX: minX,
            beamMaxX: maxX,
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
