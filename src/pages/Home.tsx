import React, { useLayoutEffect, useRef, useCallback, useState } from 'react';
import { Staff } from '../components/Staff';
import { ControlPanel } from '../components/ControlPanel';
import { useMidi } from '../hooks/useMidi';
import { useRealtimeNotes } from '../hooks/useRealtimeNotes';
import { useAppStore } from '../store/useAppStore';
import type { Note } from '../types';

const SCROLL_LEAD_MS = 3000;

export const Home: React.FC = () => {
  const { isSupported, selectedDevice, subscribeToMidi } = useMidi();

  const chordThreshold = useAppStore((s) => s.chordThreshold);
  const showGrid = useAppStore((s) => s.showGrid);
  const bpm = useAppStore((s) => s.bpm);
  const setScrollPosition = useAppStore((s) => s.setScrollPosition);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const pixelsPerSecond = useAppStore((s) => s.pixelsPerSecond);

  const sessionStartRef = useRef(0);
  const canvasNotesRef = useRef<Note[]>([]);
  const [liveNoteCount, setLiveNoteCount] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  const handleLiveMetrics = useCallback((m: { noteCount: number }) => {
    setLiveNoteCount(m.noteCount);
  }, []);

  useLayoutEffect(() => {
    if (sessionStartRef.current === 0) {
      sessionStartRef.current = Date.now();
    }
  }, []);

  const { clearRecording } = useRealtimeNotes({
    subscribeToMidi,
    enabled: !!selectedDevice,
    sessionStartRef,
    canvasNotesRef,
    onLiveMetrics: handleLiveMetrics,
    scrollLeadMs: SCROLL_LEAD_MS,
  });

  const handleReset = useCallback(() => {
    setIsResetting(true);
    setTimeout(() => setIsResetting(false), 300);

    sessionStartRef.current = Date.now();
    clearRecording();
    setScrollPosition(0);
    setCurrentTime(0);
  }, [clearRecording, setCurrentTime, setScrollPosition]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 bg-clip-text text-transparent">
              VisualStave
            </h1>
          </div>
          <p className="text-lg md:text-xl text-gray-600 font-medium">实时 MIDI 钢琴可视化 · 音乐学习好帮手</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/50">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    五线谱
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">跟随你的演奏，实时可视化音符</p>
                  <p className="text-xs text-indigo-600 mt-1">当前音符: {liveNoteCount} · 和弦阈值: {chordThreshold}ms</p>
                </div>
                <button
                  onClick={handleReset}
                  className={`group relative px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 ${isResetting ? 'scale-95' : ''}`}
                >
                  <svg
                    className="w-5 h-5 transition-transform duration-300 group-hover:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  重置
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl">
                <Staff
                  width={1200}
                  height={500}
                  canvasNotesRef={canvasNotesRef}
                  sessionStartRef={sessionStartRef}
                  scrollLeadMs={SCROLL_LEAD_MS}
                  pixelsPerSecond={pixelsPerSecond}
                  showGrid={showGrid}
                  bpm={bpm}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <ControlPanel isMidiSupported={isSupported} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-700 font-medium">连接 MIDI 设备即可开始演奏和可视化</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
