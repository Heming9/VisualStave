import { useState, useEffect, useCallback, useRef } from 'react';
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
  const midiAccessRef = useRef<MIDIAccess | null>(null);
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

  const connectDevice = useCallback(async () => {
    try {
      const access = await navigator.requestMIDIAccess();
      midiAccessRef.current = access;
      access.onstatechange = () => {
        const a = midiAccessRef.current;
        if (a) applyInputList(a);
      };
      applyInputList(access, { initial: true });
    } catch (error) {
      console.error('Web MIDI API is not supported or access denied:', error);
      setIsSupported(false);
    }
  }, [applyInputList]);

  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) {
      return;
    }
    queueMicrotask(() => {
      void connectDevice();
    });
  }, [connectDevice]);

  useEffect(() => {
    return () => {
      const a = midiAccessRef.current;
      if (a) {
        a.onstatechange = null;
      }
      midiAccessRef.current = null;
    };
  }, []);

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
