import { EventEmitter } from 'events';

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function emitBattleUpdate(roomCode: string): void {
  bus.emit(`battle:${roomCode}`);
}

export function onBattleUpdate(roomCode: string, handler: () => void): () => void {
  bus.on(`battle:${roomCode}`, handler);
  return () => bus.off(`battle:${roomCode}`, handler);
}
