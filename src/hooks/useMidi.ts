import { useState, useEffect, useCallback } from 'react';
import type { MidiDevice, MidiMessage } from '../types';
import { useAppStore } from '../store/useAppStore';

function collectInputs(access: MIDIAccess): MidiDevice[] {
  const list: MidiDevice[] = [];
  access.inputs.forEach((input) => {
    list.push({
      id: input.id,
      name: input.name || 'Unknown Device',
      input,
    });
  });
  return list;
}

export const useMidi = () => {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [isSupported, setIsSupported] = useState(
    () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  );

  const devices = useAppStore((s) => s.devices);
  const selectedDevice = useAppStore((s) => s.selectedDevice);
  const setDevices = useAppStore((s) => s.setDevices);
  const setSelectedDevice = useAppStore((s) => s.setSelectedDevice);

  const applyInputList = useCallback(
    (access: MIDIAccess, opts?: { initial?: boolean }) => {
      const next = collectInputs(access);
      setDevices(next);
      const current = useAppStore.getState().selectedDevice;

      if (current && next.some((d) => d.id === current.id)) {
        return;
      }
      if (current && !next.some((d) => d.id === current.id)) {
        setSelectedDevice(next[0] ?? null);
        return;
      }
      if (!current && next.length > 0 && opts?.initial) {
        setSelectedDevice(next[0]);
      }
    },
    [setDevices, setSelectedDevice],
  );

  const handleStateChange = useCallback(() => {
    if (!midiAccess) return;
    applyInputList(midiAccess);
  }, [midiAccess, applyInputList]);

  const connectDevice = useCallback(async () => {
    try {
      const access = await navigator.requestMIDIAccess();
      setMidiAccess(access);
      access.onstatechange = handleStateChange;
      applyInputList(access, { initial: true });
    } catch (error) {
      console.error('Web MIDI API is not supported or access denied:', error);
      setIsSupported(false);
    }
  }, [applyInputList, handleStateChange]);

  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) {
      return;
    }
    queueMicrotask(() => {
      void connectDevice();
    });
  }, [connectDevice]);

  const subscribeToMidi = useCallback(
    (
      onMessage: (message: MidiMessage) => void,
      getElapsedMs: () => number,
    ): (() => void) => {
      if (!selectedDevice) return () => {};

      const handleMidiMessage = (event: MIDIMessageEvent) => {
        const data = event.data;
        if (!data || data.length < 3) return;

        const status = data[0];
        const pitch = data[1];
        const velocity = data[2];
        const command = status & 0xf0;

        let type: MidiMessage['type'];
        if (command === 0x80 || (command === 0x90 && velocity === 0)) {
          type = 'noteOff';
        } else if (command === 0x90) {
          type = 'noteOn';
        } else {
          return;
        }

        onMessage({
          type,
          pitch,
          velocity,
          timestamp: getElapsedMs(),
        });
      };

      const midiInput = selectedDevice.input;
      // Web MIDI：规范使用可写的 onmidimessage 属性挂载回调
      // eslint-disable-next-line react-hooks/immutability -- MIDIInput 仅支持该赋值式 API
      midiInput.onmidimessage = handleMidiMessage;

      return () => {
        midiInput.onmidimessage = null;
      };
    },
    [selectedDevice],
  );

  return {
    isSupported,
    devices,
    selectedDevice,
    subscribeToMidi,
  };
};
