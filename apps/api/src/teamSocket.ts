import type { ServerWebSocket } from 'bun';

interface RoomClient {
  playerId: string;
  ws: ServerWebSocket<unknown>;
}

// roomCode → array of at most 2 clients
const rooms = new Map<string, RoomClient[]>();

export function registerClient(
  roomCode: string,
  playerId: string,
  ws: ServerWebSocket<unknown>
) {
  const clients = rooms.get(roomCode) ?? [];
  // Remove stale connection from same player if reconnecting
  const filtered = clients.filter((c) => c.playerId !== playerId);
  filtered.push({ playerId, ws });
  rooms.set(roomCode, filtered);
}

export function removeClient(roomCode: string, playerId: string) {
  const clients = rooms.get(roomCode) ?? [];
  rooms.set(
    roomCode,
    clients.filter((c) => c.playerId !== playerId)
  );
}

export function broadcastToOpponent(
  roomCode: string,
  senderId: string,
  message: string
) {
  const clients = rooms.get(roomCode) ?? [];
  for (const client of clients) {
    if (client.playerId !== senderId) {
      try {
        client.ws.send(message);
      } catch {
        // Ignore closed connections
      }
    }
  }
}
