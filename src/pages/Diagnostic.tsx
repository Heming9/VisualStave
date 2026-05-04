import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Note } from '../types';

export const DiagnosticPage: React.FC = () => {
  const [midiStatus, setMidiStatus] = useState<string>('检查中...');
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  
  const deviceRef = useRef<MIDIInput | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const addLog = useCallback((msg: string) => {
    setConsoleLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log(msg);
  }, []);

  useEffect(() => {
    addLog('页面加载完成');
    
    if (!navigator.requestMIDIAccess) {
      setMidiStatus('❌ 浏览器不支持 Web MIDI API');
      addLog('错误: 浏览器不支持 Web MIDI API');
      return;
    }

    setMidiStatus('✅ 浏览器支持 Web MIDI API');
    addLog('浏览器支持 Web MIDI API');

    navigator.requestMIDIAccess()
      .then((access) => {
        addLog('✅ MIDI访问权限已获取');
        
        const deviceList: string[] = [];
        access.inputs.forEach((input) => {
          deviceList.push(input.name || 'Unknown Device');
          addLog(`发现设备: ${input.name}`);
        });
        
        setDevices(deviceList);
        
        if (deviceList.length > 0) {
          setSelectedDevice(deviceList[0]);
        }

        access.onstatechange = () => {
          const newDeviceList: string[] = [];
          access.inputs.forEach((input) => {
            newDeviceList.push(input.name || 'Unknown Device');
          });
          setDevices(newDeviceList);
          addLog('设备列表已更新');
        };
      })
      .catch((err) => {
        setMidiStatus('❌ MIDI访问被拒绝');
        addLog(`错误: ${err}`);
      });
  }, [addLog]);

  useEffect(() => {
    if (!selectedDevice) return;

    navigator.requestMIDIAccess()
      .then((access) => {
        access.inputs.forEach((input) => {
          if (input.name === selectedDevice) {
            deviceRef.current = input;
            addLog(`已选择设备: ${selectedDevice}`);
            
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
                
                setNotes(prev => {
                  const updated = prev.map(n =>
                    n.pitch === pitch ? { ...n, isPlaying: false, endTime: timestamp } : n
                  );
                  return [...updated, newNote];
                });
              } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
                addLog(`🔇 Note OFF: Pitch=${pitch}`);
                
                setNotes(prev =>
                  prev.map(n =>
                    n.pitch === pitch && n.isPlaying
                      ? { ...n, isPlaying: false, endTime: timestamp }
                      : n
                  )
                );
              }
            };
          }
        });
      })
      .catch((err) => {
        addLog(`选择设备失败: ${err}`);
      });

    return () => {
      if (deviceRef.current) {
        deviceRef.current.onmidimessage = null;
      }
    };
  }, [selectedDevice, addLog]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const lineSpacing = 15;
    const trebleBottomY = 180;
    const bassTopY = 250;
    const leftMargin = 80;

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

    const pixelsPerSecond = 100;
    notes.forEach((note) => {
      const x = leftMargin + (note.startTime / 1000) * pixelsPerSecond;
      const pitch = note.pitch;
      
      let y: number;
      
      if (pitch >= 60 && pitch <= 90) {
        y = trebleBottomY - (72 - pitch) * (lineSpacing / 2);
      } else {
        y = bassTopY + 4 * lineSpacing - (60 - pitch) * (lineSpacing / 2);
      }

      const alpha = 0.3 + (note.velocity / 127) * 0.7;
      ctx.fillStyle = `rgba(79, 70, 229, ${alpha})`;
      
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 8, -0.3, 0, Math.PI * 2);
      ctx.fill();

      if (note.endTime) {
        const endX = leftMargin + (note.endTime / 1000) * pixelsPerSecond;
        const duration = endX - x;
        if (duration > 0) {
          ctx.fillStyle = `rgba(79, 70, 229, ${alpha * 0.3})`;
          ctx.fillRect(x, y - 4, duration, 8);
        }
      }

      ctx.fillStyle = '#4f46e5';
      ctx.font = '10px Arial';
      ctx.fillText(`${pitch}`, x + 15, y + 4);
    });

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('🎹 演奏区域', 20, 30);
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  MIDI设备:
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500"
                >
                  <option value="">选择设备</option>
                  {devices.map((device, index) => (
                    <option key={index} value={device}>
                      {device}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  控制台日志:
                </label>
                <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs h-64 overflow-y-auto">
                  {consoleLogs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">五线谱预览</h2>
            <div className="bg-white border-2 border-gray-300 rounded-xl overflow-hidden">
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="w-full"
              />
            </div>
            <p className="text-sm text-gray-600 mt-4 text-center">
              👆 演奏时音符应该显示在这里
            </p>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-xl">
          <h3 className="font-bold text-yellow-800 mb-2">🔧 调试步骤:</h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-700">
            <li>确认"MIDI状态"显示为 ✅</li>
            <li>在"MIDI设备"下拉菜单中选择你的设备</li>
            <li>演奏几个音符</li>
            <li>查看"控制台日志"是否有 🎵 或 🔇 消息</li>
            <li>查看"五线谱预览"是否有音符显示</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
