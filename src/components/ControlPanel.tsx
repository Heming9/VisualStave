import React from 'react';
import { useAppStore } from '../store/useAppStore';

interface ControlPanelProps {
  isMidiSupported: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isMidiSupported }) => {
  const {
    selectedDevice,
    devices,
    setSelectedDevice,
    chordThreshold,
    setChordThreshold,
    showGrid,
    setShowGrid,
    bpm,
    setBpm,
    stats,
    resetStats,
  } = useAppStore();

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/60 space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          控制面板
        </h2>
      </div>

      {!isMidiSupported && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 p-5 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-800 font-medium leading-relaxed">
              您的浏览器不支持 Web MIDI API。请使用 Chrome、Edge 或 Firefox 浏览器。
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 11-6 0 3 3 0 016 0zM5 12a3 3 0 116 0 3 3 0 01-6 0z" />
            </svg>
            MIDI 设备
          </label>
          <select
            value={selectedDevice?.id || ''}
            onChange={(e) => {
              const device = devices.find((d) => d.id === e.target.value);
              setSelectedDevice(device || null);
            }}
            className="w-full px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all duration-300 font-medium text-gray-700 cursor-pointer hover:border-indigo-300"
          >
            <option value="">选择设备</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            和弦阈值: <span className="text-indigo-600 font-extrabold">{chordThreshold}ms</span>
          </label>
          <input
            type="range"
            min="20"
            max="200"
            value={chordThreshold}
            onChange={(e) => setChordThreshold(Number(e.target.value))}
            className="w-full h-3 bg-gradient-to-r from-gray-200 via-indigo-100 to-gray-200 rounded-2xl appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all duration-300"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
            <span>20ms</span>
            <span>200ms</span>
          </div>
        </div>

        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            BPM: <span className="text-pink-600 font-extrabold">{bpm}</span>
          </label>
          <input
            type="range"
            min="40"
            max="200"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full h-3 bg-gradient-to-r from-gray-200 via-pink-100 to-gray-200 rounded-2xl appearance-none cursor-pointer accent-pink-600 hover:accent-pink-500 transition-all duration-300"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
            <span>40</span>
            <span>200</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            显示节拍辅助线
          </label>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-500 shadow-lg ${
              showGrid ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gradient-to-r from-gray-300 to-gray-400'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-all duration-500 ${
                showGrid ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="border-t-2 border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            演奏统计
          </h3>
          <button
            onClick={resetStats}
            className="group px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 flex items-center gap-2"
          >
            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重置
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-2xl p-5 shadow-lg transform hover:scale-105 transition-transform duration-300">
            <p className="text-sm text-indigo-100 font-medium mb-1">总音符数</p>
            <p className="text-4xl font-black text-white">{stats.totalNotesPlayed}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-500 via-pink-600 to-purple-600 rounded-2xl p-5 shadow-lg transform hover:scale-105 transition-transform duration-300">
            <p className="text-sm text-pink-100 font-medium mb-1">总和弦数</p>
            <p className="text-4xl font-black text-white">{stats.totalChordsPlayed}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
