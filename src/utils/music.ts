const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const C4_PITCH = 60;

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

export const getNoteName = (pitch: number): string => {
  const noteIndex = pitch % 12;
  const octave = Math.floor(pitch / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
};

export const isBlackKey = (pitch: number): boolean => {
  const noteIndex = pitch % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex);
};

export const getStaffForPitch = (pitch: number): 'treble' | 'bass' => {
  return pitch >= 60 ? 'treble' : 'bass';
};

export const pitchToY = (
  pitch: number,
  config: Partial<StaffConfig> = {}
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
