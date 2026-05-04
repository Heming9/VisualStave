const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const C4_PITCH = 60;

/** 与 `Staff` 画布一致的大谱表布局（高音谱表下加一线 = E4 附近锚点） */
export const GRAND_STAFF_LAYOUT = {
  lineSpacing: 12,
  trebleBottomY: 220,
  bassTopY: 280,
  leftMargin: 100,
  referencePitch: 64,
};

export type GrandStaffLayout = typeof GRAND_STAFF_LAYOUT;

export interface StaffConfig {
  lineSpacing: number;
  topMargin: number;
  trebleBottomY: number;
  bassTopY: number;
  grandStaffGap: number;
}

const DEFAULT_STAFF_CONFIG: StaffConfig = {
  lineSpacing: 12,
  topMargin: 40,
  trebleBottomY: 200,
  bassTopY: 240,
  grandStaffGap: 40,
};

const NOTE_CLASS_TO_DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

export function getDiatonicIndex(pitch: number): number {
  const octave = Math.floor(pitch / 12) - 1;
  const pitchClass = pitch % 12;
  return octave * 7 + NOTE_CLASS_TO_DIATONIC[pitchClass];
}

export const getNoteName = (pitch: number): string => {
  const noteIndex = pitch % 12;
  const octave = Math.floor(pitch / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
};

export const isBlackKey = (pitch: number): boolean => {
  const noteIndex = pitch % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex);
};

/** Unicode 变音记号（U+266F / U+266D）；黑键交替用升号与降号拼写以便两种符号都会出现 */
export function getAccidentalUnicode(pitch: number): '\u266F' | '\u266D' | null {
  const pc = pitch % 12;
  switch (pc) {
    case 1:
      return '\u266F';
    case 3:
      return '\u266D';
    case 6:
      return '\u266F';
    case 8:
      return '\u266D';
    case 10:
      return '\u266F';
    default:
      return null;
  }
}

export const getStaffForPitch = (pitch: number): 'treble' | 'bass' => {
  return pitch >= 60 ? 'treble' : 'bass';
};

/**
 * 大谱表纵向位置（与主界面 Staff 使用同一套线间映射）。
 */
export function pitchToGrandStaffY(
  pitch: number,
  layout: Pick<GrandStaffLayout, 'lineSpacing' | 'trebleBottomY' | 'referencePitch'> = GRAND_STAFF_LAYOUT,
): { y: number; staff: 'treble' | 'bass' } {
  const { lineSpacing, trebleBottomY, referencePitch } = layout;
  const diatonicDiff = getDiatonicIndex(pitch) - getDiatonicIndex(referencePitch);
  const y = trebleBottomY - diatonicDiff * (lineSpacing / 2);
  return { y, staff: getStaffForPitch(pitch) };
}

export type LedgerLayout = Pick<GrandStaffLayout, 'lineSpacing' | 'trebleBottomY' | 'bassTopY'>;

/**
 * 符头超出对应谱表五线范围时，返回应绘制的加线 Y（与线距对齐的辅助线）。
 * 用符头竖向半高判断「碰到」上下界，避免贴边音漏画。
 */
export function getLedgerLineYs(
  y: number,
  staff: 'treble' | 'bass',
  layout: LedgerLayout,
  noteHeadHalfHeight = 0,
): number[] {
  const s = layout.lineSpacing;
  const trebleTop = layout.trebleBottomY - 4 * s;
  const trebleBot = layout.trebleBottomY;
  const bassTop = layout.bassTopY;
  const bassBot = layout.bassTopY + 4 * s;

  const headTop = y - noteHeadHalfHeight;
  const headBot = y + noteHeadHalfHeight;
  const eps = 1e-6;

  const lines: number[] = [];

  if (staff === 'treble') {
    if (headTop < trebleTop - eps) {
      for (let ly = trebleTop - s; ly > headTop - eps; ly -= s) {
        lines.push(ly);
      }
    }
    if (headBot > trebleBot + eps) {
      for (let ly = trebleBot + s; ly < headBot + eps; ly += s) {
        lines.push(ly);
      }
    }
  } else {
    if (headTop < bassTop - eps) {
      for (let ly = bassTop - s; ly > headTop - eps; ly -= s) {
        lines.push(ly);
      }
    }
    if (headBot > bassBot + eps) {
      for (let ly = bassBot + s; ly < headBot + eps; ly += s) {
        lines.push(ly);
      }
    }
  }

  return lines;
}

export const pitchToY = (
  pitch: number,
  config: Partial<StaffConfig> = {},
): { y: number; staff: 'treble' | 'bass'; ledgerLines: number } => {
  const { lineSpacing, trebleBottomY, bassTopY } = {
    ...DEFAULT_STAFF_CONFIG,
    ...config,
  };

  const c4Y = trebleBottomY + lineSpacing;
  const pitchDiffFromC4 = pitch - C4_PITCH;
  const halfSteps = pitchDiffFromC4;
  const staffLines = halfSteps / 2;

  const y = c4Y - staffLines * lineSpacing;
  const staff = getStaffForPitch(pitch);

  let ledgerLines = 0;
  if (staff === 'treble') {
    const trebleTopY = trebleBottomY - lineSpacing * 4;
    if (y < trebleTopY - lineSpacing) {
      ledgerLines = Math.ceil((trebleTopY - y) / lineSpacing);
    } else if (y > trebleBottomY + lineSpacing) {
      ledgerLines = Math.ceil((y - trebleBottomY) / lineSpacing);
    }
  } else {
    const bassBottomY = bassTopY + lineSpacing * 4;
    if (y > bassBottomY + lineSpacing) {
      ledgerLines = Math.ceil((y - bassBottomY) / lineSpacing);
    } else if (y < bassTopY - lineSpacing) {
      ledgerLines = Math.ceil((bassTopY - y) / lineSpacing);
    }
  }

  return { y, staff, ledgerLines: Math.abs(ledgerLines) };
};

export const getTrebleClefY = (config: Partial<StaffConfig> = {}): number => {
  const { lineSpacing, trebleBottomY } = {
    ...DEFAULT_STAFF_CONFIG,
    ...config,
  };
  return trebleBottomY - lineSpacing * 2;
};

export const getBassClefY = (config: Partial<StaffConfig> = {}): number => {
  const { lineSpacing, bassTopY } = {
    ...DEFAULT_STAFF_CONFIG,
    ...config,
  };
  return bassTopY + lineSpacing;
};
