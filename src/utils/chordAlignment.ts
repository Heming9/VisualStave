import type { Note } from '../types';

export interface ChordClusterAlignResult {
  /** 新音符及需拉回的同簇音符共用的起始时刻 */
  clusterAnchorMs: number;
  /** 已在演奏且应把 startTime 改成 clusterAnchorMs 的音符 id（与新键同属一连通块） */
  playingIdsToSnap: Set<string>;
}

/**
 * 将本次 note-on 并入「阈值内相连」的演奏中音符簇，并取簇内最早 onset 为锚点。
 * 解决三连音里相邻键依次略超阈值、却无法与最先按下的一键对齐的问题。
 */
export function alignNoteOnToChordCluster(
  eventTime: number,
  notes: readonly Note[],
  chordThreshold: number,
): ChordClusterAlignResult {
  const playing = notes.filter((n) => n.isPlaying);
  const seeds = playing.filter(
    (n) => eventTime >= n.startTime && eventTime - n.startTime <= chordThreshold,
  );

  if (seeds.length === 0) {
    return { clusterAnchorMs: eventTime, playingIdsToSnap: new Set() };
  }

  const visited = new Set<string>();
  const stack = [...seeds];
  for (const s of seeds) visited.add(s.id);

  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const other of playing) {
      if (visited.has(other.id)) continue;
      if (Math.abs(other.startTime - cur.startTime) <= chordThreshold) {
        visited.add(other.id);
        stack.push(other);
      }
    }
  }

  let anchor = eventTime;
  const byId = new Map(playing.map((n) => [n.id, n]));
  for (const id of visited) {
    anchor = Math.min(anchor, byId.get(id)!.startTime);
  }

  return { clusterAnchorMs: anchor, playingIdsToSnap: visited };
}
