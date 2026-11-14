import { EmergencyEvent, SensorFrame } from '../types/telemetry';
import { RelayEnvelope, relayClient } from './relayClient';

export type CrewMessage =
  | { type: 'EMERGENCY_SOS'; payload: EmergencyEvent }
  | { type: 'ACKNOWLEDGE_EMERGENCY'; payload: { eventId: string; acknowledgedBy: string } }
  | { type: 'CANCEL_EMERGENCY'; payload: { eventId: string; cancelledBy: string } }
  | { type: 'CREW_ANNOUNCE'; payload: { nodeId: string; name: string; label: string } }
  | { type: 'SENSOR_HELLO'; payload: { sensorId: string } }
  | { type: 'SENSOR_PAIR'; payload: { sensorId: string; crewName: string } }
  | { type: 'SENSOR_UNPAIR'; payload: { sensorId: string } }
  | { type: 'SENSOR_FRAME'; payload: SensorFrame };

type MessageListener = (message: CrewMessage) => void;

function isCrewMessage(value: unknown): value is CrewMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === 'EMERGENCY_SOS' ||
    type === 'ACKNOWLEDGE_EMERGENCY' ||
    type === 'CANCEL_EMERGENCY' ||
    type === 'CREW_ANNOUNCE' ||
    type === 'SENSOR_HELLO' ||
    type === 'SENSOR_PAIR' ||
    type === 'SENSOR_UNPAIR' ||
    type === 'SENSOR_FRAME'
  );
}

class CrewLinkService {
  public get nodeId(): string {
    return relayClient.getOriginId();
  }

  public isRelayOnline(): boolean {
    return relayClient.isRelayOnline();
  }

  public hasLocalChannel(): boolean {
    return relayClient.hasLocalChannel();
  }

  public onConnectionChange(callback: (relayOnline: boolean, localChannel: boolean) => void): () => void {
    return relayClient.onConnectionChange(callback);
  }

  public subscribe(listener: MessageListener): () => void {
    return relayClient.subscribe((envelope: RelayEnvelope) => {
      if (isCrewMessage({ type: envelope.type, payload: envelope.payload })) {
        listener({ type: envelope.type, payload: envelope.payload } as CrewMessage);
      }
    });
  }

  public announce(name: string, label: string): void {
    relayClient.send('CREW_ANNOUNCE', { nodeId: this.nodeId, name, label });
  }

  public sendEmergency(event: EmergencyEvent): void {
    relayClient.send('EMERGENCY_SOS', event);
  }

  public acknowledgeEmergency(eventId: string, acknowledgedBy: string): void {
    relayClient.send('ACKNOWLEDGE_EMERGENCY', { eventId, acknowledgedBy });
  }

  public cancelEmergency(eventId: string, cancelledBy: string): void {
    relayClient.send('CANCEL_EMERGENCY', { eventId, cancelledBy });
  }

  public pairSensor(sensorId: string, crewName: string): void {
    relayClient.send('SENSOR_PAIR', { sensorId, crewName });
  }

  public unpairSensor(sensorId: string): void {
    relayClient.send('SENSOR_UNPAIR', { sensorId });
  }

  public hello(sensorId: string): void {
    relayClient.send('SENSOR_HELLO', { sensorId });
  }

  public sendSensorFrame(frame: SensorFrame): void {
    relayClient.send('SENSOR_FRAME', frame);
  }
}

export const crewLink = new CrewLinkService();
