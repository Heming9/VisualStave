import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Note } from '../types';
import {
  GRAND_STAFF_LAYOUT,
  pitchToGrandStaffY,
  getAccidentalUnicode,
  getLedgerLineYs,
  getStaffForPitch,
} from '../utils/music';

const DIAG_STAFF = {
  ...GRAND_STAFF_LAYOUT,
  lineSpacing: 15,
  trebleBottomY: 180,
  bassTopY: 250,
  leftMargin: 80,
};

export const DiagnosticPage: React.FC = () => {
  const [midiStatus, setMidiStatus] = useState<string>('检查中...');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const accessRef = useRef<MIDIAccess | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    setConsoleLogs((prev) => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log(msg);
  }, []);

  const refreshDevices = useCallback((access: MIDIAccess) => {
    const ids: string[] = [];
    const names: Record<string, string> = {};
    access.inputs.forEach((input) => {
      ids.push(input.id);
      names[input.id] = input.name || 'Unknown Device';
    });
    setDeviceIds(ids);
    setDeviceNames(names);
    setSelectedId((prev) => {
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? '';
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      addLog('页面加载完成');

      if (!navigator.requestMIDIAccess) {
        setMidiStatus('❌ 浏览器不支持 Web MIDI API');
        addLog('错误: 浏览器不支持 Web MIDI API');
        return;
      }

      setMidiStatus('✅ 浏览器支持 Web MIDI API');
      addLog('浏览器支持 Web MIDI API');

      navigator
        .requestMIDIAccess()
        .then((access) => {
          accessRef.current = access;
          startTimeRef.current = Date.now();
          addLog('✅ MIDI访问权限已获取');
          refreshDevices(access);

          access.onstatechange = () => {
            refreshDevices(access);
            addLog('设备列表已更新');
          };
        })
        .catch((err: unknown) => {
          setMidiStatus('❌ MIDI访问被拒绝');
          addLog(`错误: ${String(err)}`);
        });
    });
  }, [addLog, refreshDevices]);

  useEffect(() => {
    const access = accessRef.current;
    if (!access || !selectedId) return;

    const input = [...access.inputs.values()].find((i) => i.id === selectedId);
    if (!input) {
      addLog(`未找到 id 为 ${selectedId} 的输入设备`);
      return () => {};
    }

    addLog(`已绑定设备: ${input.name} (${input.id})`);

    input.onmidimessage = (event) => {
      const data = event.data;
      if (!data || data.length < 3) return;

      const status = data[0];
      const pitch = data[1];
      const velocity = data[2];
      const command = status & 0xf0;

      const timestamp = Date.now() - startTimeRef.current;

      if (command === 0x90 && velocity > 0) {
        addLog(`🎵 Note ON: Pitch=${pitch}, Velocity=${velocity}`);

        const newNote: Note = {
          id: `${Date.now()}-${pitch}`,
          pitch,
          velocity,
          startTime: timestamp,
          isPlaying: true,
        };

        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.pitch === pitch ? { ...n, isPlaying: false, endTime: timestamp } : n,
          );
          return [...updated, newNote];
        });
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        addLog(`🔇 Note OFF: Pitch=${pitch}`);

        setNotes((prev) =>
          prev.map((n) =>
            n.pitch === pitch && n.isPlaying ? { ...n, isPlaying: false, endTime: timestamp } : n,
          ),
        );
      }
    };

    return () => {
      input.onmidimessage = null;
    };
  }, [selectedId, addLog]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { lineSpacing, trebleBottomY, bassTopY, leftMargin } = DIAG_STAFF;
    const pixelsPerSecond = 100;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = trebleBottomY - i * lineSpacing;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    for (let i = 0; i < 5; i++) {
      const y = bassTopY + i * lineSpacing;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      const x = leftMargin + i * 80;
      if (x > width) break;
      ctx.beginPath();
      ctx.moveTo(x, trebleBottomY - 4 * lineSpacing);
      ctx.lineTo(x, bassTopY + 4 * lineSpacing);
      ctx.globalAlpha = 0.2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    notes.forEach((note) => {
      const x = leftMargin + (note.startTime / 1000) * pixelsPerSecond;
      const { y } = pitchToGrandStaffY(note.pitch, DIAG_STAFF);

      const alpha = 0.82 + (note.velocity / 127) * 0.18;
      const headRy = lineSpacing * 0.42;
      const headRx = lineSpacing * 0.48;
      const staff = getStaffForPitch(note.pitch);

      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 1.5;
      for (const ly of getLedgerLineYs(y, staff, DIAG_STAFF, headRy)) {
        ctx.beginPath();
        ctx.moveTo(x - 14, ly);
        ctx.lineTo(x + 14, ly);
        ctx.stroke();
      }

      const accidental = getAccidentalUnicode(note.pitch);
      if (accidental) {
        const accRightX = x - headRx - lineSpacing * 0.42;
        ctx.save();
        ctx.fillStyle = '#050505';
        ctx.font =
          '600 16px "Segoe UI Symbol", "Apple Symbols", "Noto Music", "Arial Unicode MS", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillText(accidental, accRightX, y);
        ctx.restore();
      }

      ctx.fillStyle = `rgba(12, 12, 14, ${alpha})`;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(x, y, headRx, headRy, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#525252';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${note.pitch}`, x + 15, y + 4);
    });

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('演奏区域', 20, 30);
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial';
    ctx.fillText(`当前音符数: ${notes.length}`, 20, 50);
  }, [notes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-8 bg-gradient-to-r from-indigo-700 to-pink-700 bg-clip-text text-transparent">
          MIDI 诊断工具
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">诊断信息</h2>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-semibold text-gray-700">MIDI状态: {midiStatus}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">MIDI设备:</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500"
                >
                  <option value="">选择设备</option>
                  {deviceIds.map((id) => (
                    <option key={id} value={id}>
                      {deviceNames[id] ?? id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">控制台日志:</label>
                <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs h-64 overflow-y-auto">
                  {consoleLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">五线谱预览</h2>
            <div className="bg-white border-2 border-gray-300 rounded-xl overflow-hidden">
              <canvas ref={canvasRef} width={600} height={400} className="w-full" />
            </div>
            <p className="text-sm text-gray-600 mt-4 text-center">演奏时音符应显示在此处（与主页相同的音高映射）</p>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-xl">
          <h3 className="font-bold text-yellow-800 mb-2">调试步骤:</h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-700">
            <li>确认“MIDI状态”显示为 ✅</li>
            <li>在“MIDI设备”中选择你的设备（按稳定 id 绑定）</li>
            <li>演奏几个音符</li>
            <li>查看“控制台日志”是否有 Note ON / OFF</li>
            <li>查看“五线谱预览”是否出现音符</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
