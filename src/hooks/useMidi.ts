import { useState, useEffect, useCallback } from 'react';
import { MidiDevice, MidiMessage } from '../types';

export const useMidi = () => {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MidiDevice | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const handleStateChange = useCallback(() => {
    if (!midiAccess) return;

    const newDevices: MidiDevice[] = [];
    midiAccess.inputs.forEach((input) => {
      newDevices.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        input,
      });
    });

    setDevices(newDevices);

    if (selectedDevice && !newDevices.find(d => d.id === selectedDevice.id)) {
      setSelectedDevice(null);
    }
  }, [midiAccess, selectedDevice]);

  const connectDevice = useCallback(async () => {
    try {
      const access = await navigator.requestMIDIAccess();
      setMidiAccess(access);
      access.onstatechange = handleStateChange;

      const initialDevices: MidiDevice[] = [];
      access.inputs.forEach((input) => {
        initialDevices.push({
          id: input.id,
          name: input.name || 'Unknown Device',
          input,
        });
      });

      setDevices(initialDevices);

      if (initialDevices.length > 0) {
        setSelectedDevice(initialDevices[0]);
      }
    } catch (error) {
      console.error('Web MIDI API is not supported or access denied:', error);
      setIsSupported(false);
    }
  }, [handleStateChange]);

  useEffect(() => {
    if ('requestMIDIAccess' in navigator) {
      connectDevice();
    } else {
      setIsSupported(false);
    }
  }, [connectDevice]);

  const subscribeToMidi = useCallback(
    (onMessage: (message: MidiMessage) => void) => {
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
          timestamp: event.timeStamp,
        });
      };

      selectedDevice.input.onmidimessage = handleMidiMessage;

      return () => {
        selectedDevice.input.onmidimessage = null;
      };
    },
    [selectedDevice]
  );

  return {
    isSupported,
    devices,
    selectedDevice,
    setSelectedDevice,
    subscribeToMidi,
  };
};
