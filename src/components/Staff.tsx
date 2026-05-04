import React, { useRef, useEffect, useCallback } from 'react';
import { Note } from '../types';

interface StaffProps {
  width?: number;
  height?: number;
  notes?: Note[];
  scrollPosition?: number;
  currentTime?: number;
  pixelsPerSecond?: number;
  showGrid?: boolean;
  bpm?: number;
}

const LINE_SPACING = 12;
const TREBLE_BOTTOM_Y = 220;
const BASS_TOP_Y = 280;
const LEFT_MARGIN = 100;

const NOTE_INDICES = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

export const Staff: React.FC<StaffProps> = ({
  width = 1200,
  height = 500,
  notes = [],
  scrollPosition = 0,
  currentTime = 0,
  pixelsPerSecond = 100,
  showGrid = true,
  bpm = 60,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef<Note[]>(notes);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
        
        const x = LEFT_MARGIN + (beatTime / 1000) * pixelsPerSecond - scrollPosition * (pixelsPerSecond / 1000);
        
        if (x < LEFT_MARGIN - 20 || x > width + 20) continue;
        
        ctx.strokeStyle = i % 4 === 0 ? 'rgba(99, 102, 241, 0.6)' : 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = i % 4 === 0 ? 2 : 1;
        
        ctx.beginPath();
        ctx.moveTo(x, TREBLE_BOTTOM_Y - 4 * LINE_SPACING - 30);
        ctx.lineTo(x, BASS_TOP_Y + 4 * LINE_SPACING + 30);
        ctx.stroke();
      }
    }

    const allNotes = notesRef.current;
    const visibleStartTime = scrollPosition - 500;
    const visibleEndTime = scrollPosition + (width / pixelsPerSecond) * 1000 + 500;
    
    for (let i = 0; i < allNotes.length; i++) {
      const note = allNotes[i];
      if (note.startTime < visibleStartTime || note.startTime > visibleEndTime) continue;

      const x = LEFT_MARGIN + (note.startTime / 1000) * pixelsPerSecond - scrollPosition * (pixelsPerSecond / 1000);
      if (x < LEFT_MARGIN - 50 || x > width + 50) continue;

      const getDiatonicIndex = (p: number): number => {
        const octave = Math.floor(p / 12) - 1;
        const pitchClass = p % 12;
        return octave * 7 + NOTE_INDICES[pitchClass];
      };

      const E4_PITCH = 64;
      const diatonicDiff = getDiatonicIndex(note.pitch) - getDiatonicIndex(E4_PITCH);
      const y = TREBLE_BOTTOM_Y - diatonicDiff * (LINE_SPACING / 2);
      const staff = note.pitch >= 60 ? 'treble' : 'bass';

      const pitchInOctave = note.pitch % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(pitchInOctave);
      
      const NOTE_COLOR = 'rgba(79, 70, 229, 0.9)';
      ctx.fillStyle = NOTE_COLOR;
      ctx.strokeStyle = NOTE_COLOR;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(x, y, 11, 8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isBlackKey) {
        ctx.fillStyle = '#1a202c';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('#', x - 3, y - 2);
      }

      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 1.5;
      
      const TREBLE_TOP = TREBLE_BOTTOM_Y - 4 * LINE_SPACING;
      const TREBLE_BOTTOM = TREBLE_BOTTOM_Y;
      const BASS_BOTTOM = BASS_TOP_Y + 4 * LINE_SPACING;
      
      let ledgerStartY = 0, ledgerEndY = 0, drawLedger = false;
      
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
        const step = (ledgerEndY > ledgerStartY) ? LINE_SPACING : -LINE_SPACING;
        for (let ly = ledgerStartY; (step > 0) ? (ly <= ledgerEndY) : (ly >= ledgerEndY); ly += step) {
          ctx.beginPath();
          ctx.moveTo(x - 16, ly);
          ctx.lineTo(x + 16, ly);
          ctx.stroke();
        }
      }
    }

    const playheadX = LEFT_MARGIN + (currentTime / 1000) * pixelsPerSecond - scrollPosition * (pixelsPerSecond / 1000);
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
  }, [width, height, scrollPosition, currentTime, pixelsPerSecond, showGrid, bpm]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded-xl bg-white shadow-xl"
    />
  );
};

export default Staff;
