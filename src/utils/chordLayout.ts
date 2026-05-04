import type { Note } from '../types';

/** 和弦各键 onset 对齐窗口（ms）：簇内最大跨度不超过该值，避免 MIDI 先后到达被画成琶音 */
export const CHORD_ONSET_CLUSTER_MS = 80;

export interface NoteLayoutItem {
  id: string;
  pitch: number;
  /** 与横坐标一致的 onset 锚点（同区和弦相同），用于错位时判断是否同一簇 */
  anchorOnsetMs: number;
  /** 未错位前的符头中心 X（由 anchorOnsetMs 映射） */
  xBase: number;
  /** 符头中心 Y */
  y: number;
}

/**
 * 将几乎同时弹下的音归到同一纵向切片：横坐标用簇内最早的 startTime。
 * 使用贪心按时间排序：仅当 note.t - clusterMin <= windowMs 时归入当前簇（整体跨度不超过 window，不会像并查集那样把琶音串成一串）。
 */
export function anchorChordOnsetTimes(
  notes: readonly { id: string; startTime: number }[],
  windowMs: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (notes.length === 0) return out;

  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  let clusterMin = sorted[0].startTime;
  const clusterIds: string[] = [];

  const flush = () => {
    for (const id of clusterIds) out.set(id, clusterMin);
    clusterIds.length = 0;
  };

  for (const note of sorted) {
    if (clusterIds.length === 0) {
      clusterMin = note.startTime;
      clusterIds.push(note.id);
      continue;
    }
    if (note.startTime - clusterMin <= windowMs) {
      clusterIds.push(note.id);
    } else {
      flush();
      clusterMin = note.startTime;
      clusterIds.push(note.id);
    }
  }
  flush();

  return out;
}

/**
 * 乐谱式错位：横向相距较近且纵向会叠在一起的符头，按音高从低到高左右均匀摊开
 *（低音偏左、高音偏右，多层和弦用并查集连成簇再分摊）。
 */
export function buildNoteHeadStaggerOffsets(
  items: NoteLayoutItem[],
  options: {
    noteHeadRx: number;
    noteHeadRy: number;
    lineSpacing: number;
    /** 单音之间的水平错位步长，略小于「间」宽 */
    staggerUnit?: number;
  },
): Map<string, number> {
  const { noteHeadRx, noteHeadRy, lineSpacing } = options;
  const staggerUnit = options.staggerUnit ?? lineSpacing * 0.46;
  /** 纵向：仅当真会叠住符头时才错位（≈两椭圆竖直径）；略放宽一度以免锯齿像素漏判 */
  const collisionVert = noteHeadRy * 2 + lineSpacing * 0.06;
  const collisionHorz = noteHeadRx * 2 + lineSpacing * 0.35;
  const anchorEps = 0.5;

  const dxById = new Map<string, number>();
  for (const it of items) dxById.set(it.id, 0);

  const n = items.length;
  if (n < 2) return dxById;

  const order = [...items].sort((a, b) => a.xBase - b.xBase || a.pitch - b.pitch);

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (order[j].xBase - order[i].xBase > collisionHorz) break;
      if (Math.abs(order[j].anchorOnsetMs - order[i].anchorOnsetMs) > anchorEps) continue;
      const vGap = Math.abs(order[i].y - order[j].y);
      if (vGap < collisionVert) unite(i, j);
    }
  }

  const comps = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r)!.push(i);
  }

  for (const idxs of comps.values()) {
    if (idxs.length < 2) continue;
    idxs.sort((a, b) => order[a].pitch - order[b].pitch);
    const len = idxs.length;
    for (let k = 0; k < len; k++) {
      const id = order[idxs[k]].id;
      const spread = (k - (len - 1) / 2) * staggerUnit;
      dxById.set(id, spread);
    }
  }

  return dxById;
}

/** 绘制顺序：按对齐后的 onset，再按错位从左到右叠画 */
export function compareNotesDrawOrder(
  a: Note,
  b: Note,
  dx: Map<string, number>,
  anchorById: Map<string, number>,
): number {
  const aa = anchorById.get(a.id) ?? a.startTime;
  const ab = anchorById.get(b.id) ?? b.startTime;
  if (Math.abs(aa - ab) > 1e-6) return aa - ab;
  const dxa = dx.get(a.id) ?? 0;
  const dxb = dx.get(b.id) ?? 0;
  if (Math.abs(dxa - dxb) > 1e-6) return dxa - dxb;
  return a.pitch - b.pitch;
}
