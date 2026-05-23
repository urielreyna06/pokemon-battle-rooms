import { Hono } from "hono";
import { getDb } from "../db";
import { initializeBattle } from "../engine/battleEngine";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import type {
  RoomDoc,
  BattleDoc,
  CreateRoomResponse,
  JoinRoomResponse,
  RoomStateResponse,
} from "../../../../packages/shared/types";

export const roomRoutes = new Hono<AuthEnv>();
roomRoutes.use("*", requireAuth);

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars (I, O, 0, 1)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /rooms — create a new room
roomRoutes.post("/", async (c) => {
  try {
    const db = await getDb();

    // Generate unique code
    let code = generateRoomCode();
    let attempts = 0;
    while (await db.collection<RoomDoc>("rooms").findOne({ code })) {
      code = generateRoomCode();
      if (++attempts > 10) throw new Error("Could not generate unique room code");
    }

    const room: RoomDoc = {
      code,
      status: "waiting",
      players: [],
      createdAt: new Date(),
    };

    await db.collection<RoomDoc>("rooms").insertOne(room as any);

    const response: CreateRoomResponse = { code };
    return c.json(response, 201);
  } catch (err) {
    console.error("POST /rooms error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /rooms/:code/join — second player joins
roomRoutes.post("/:code/join", async (c) => {
  try {
    const db = await getDb();
    const { code } = c.req.param();
    const body = await c.req.json<{ playerName: string }>();

    if (!body.playerName?.trim()) {
      return c.json({ error: "playerName is required" }, 400);
    }

    const room = await db.collection<RoomDoc>("rooms").findOne({ code });
    if (!room) return c.json({ error: "Room not found" }, 404);

    if (room.players.length >= 2) {
      return c.json({ error: "Room is full" }, 409);
    }

    if (room.status !== "waiting") {
      return c.json({ error: "Room is not accepting players" }, 409);
    }

    const playerId = c.get("userId");

    if (room.players.some((p) => p.id === playerId)) {
      return c.json({ error: "Already in this room" }, 409);
    }

    const newPlayer = {
      id: playerId,
      name: body.playerName.trim(),
      team: [],
      activePokemonId: "",
      isReady: false,
    };

    await db
      .collection<RoomDoc>("rooms")
      .updateOne({ code }, { $push: { players: newPlayer as any } });

    const updatedRoom = await db.collection<RoomDoc>("rooms").findOne({ code });
    const response: JoinRoomResponse = {
      playerId,
      room: updatedRoom!,
    };
    return c.json(response, 200);
  } catch (err) {
    console.error("POST /rooms/:code/join error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /rooms/:code/team — player submits their team selection
roomRoutes.post("/:code/team", async (c) => {
  try {
    const db = await getDb();
    const { code } = c.req.param();
    const body = await c.req.json<{ playerId: string; team: number[] }>(); // array of pokedexIds

    if (!body.playerId || !Array.isArray(body.team) || body.team.length < 1 || body.team.length > 6) {
      return c.json({ error: "playerId and team (1–6 pokedexIds) are required" }, 400);
    }

    const room = await db.collection<RoomDoc>("rooms").findOne({ code });
    if (!room) return c.json({ error: "Room not found" }, 404);

    const playerIndex = room.players.findIndex((p) => p.id === body.playerId);
    if (playerIndex === -1) return c.json({ error: "Player not in this room" }, 403);

    // Validate all pokedexIds exist in DB
    for (const pokedexId of body.team) {
      const exists = await db.collection("pokemon").findOne({ pokedexId });
      if (!exists) return c.json({ error: `Pokémon ${pokedexId} not found` }, 400);
    }

    await db.collection<RoomDoc>("rooms").updateOne(
      { code },
      { $set: { [`players.${playerIndex}.team`]: body.team } }
    );

    return c.json({ success: true });
  } catch (err) {
    console.error("POST /rooms/:code/team error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /rooms/:code/ready — player marks ready; if both ready, start battle
roomRoutes.post("/:code/ready", async (c) => {
  try {
    const db = await getDb();
    const { code } = c.req.param();
    const body = await c.req.json<{ playerId: string }>();

    if (!body.playerId) {
      return c.json({ error: "playerId is required" }, 400);
    }

    const room = await db.collection<RoomDoc>("rooms").findOne({ code });
    if (!room) return c.json({ error: "Room not found" }, 404);

    const playerIndex = room.players.findIndex((p) => p.id === body.playerId);
    if (playerIndex === -1) return c.json({ error: "Player not in this room" }, 403);

    if (room.players[playerIndex].team.length === 0) {
      return c.json({ error: "You must select a team before marking ready" }, 400);
    }

    // Check for duplicate pokémon with opponent's team (if opponent has already readied)
    const otherPlayerIndex = room.players.findIndex((p, idx) => idx !== playerIndex);
    if (otherPlayerIndex !== -1 && room.players[otherPlayerIndex].isReady) {
      const currentTeam = room.players[playerIndex].team;
      const opponentTeam = room.players[otherPlayerIndex].team;
      const duplicates = currentTeam.filter((pokedexId) => opponentTeam.includes(pokedexId));

      if (duplicates.length > 0) {
        return c.json(
          {
            error: "duplicate_pokemon",
            message: "Some Pokémon are already chosen by your opponent",
            duplicates,
          },
          400
        );
      }
    }

    // Mark this player as ready
    await db.collection<RoomDoc>("rooms").updateOne(
      { code },
      { $set: { [`players.${playerIndex}.isReady`]: true } }
    );

    const updatedRoom = (await db.collection<RoomDoc>("rooms").findOne({ code }))!;

    // If both players are present and ready, start the battle
    const bothReady =
      updatedRoom.players.length === 2 &&
      updatedRoom.players.every((p) => p.isReady && p.team.length > 0);

    if (bothReady && updatedRoom.status !== "battling") {
      await db
        .collection<RoomDoc>("rooms")
        .updateOne({ code }, { $set: { status: "battling" } });

      // Initialize the battle document
      await initializeBattle(
        db,
        code,
        updatedRoom.players.map((p) => ({
          id: p.id,
          selectedPokedexIds: p.team,
        }))
      );
    }

    const finalRoom = (await db.collection<RoomDoc>("rooms").findOne({ code }))!;
    return c.json({ room: finalRoom });
  } catch (err) {
    console.error("POST /rooms/:code/ready error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /rooms/:code — current room + battle state (used for polling)
roomRoutes.get("/:code", async (c) => {
  try {
    const db = await getDb();
    const { code } = c.req.param();

    const room = await db
      .collection<RoomDoc>("rooms")
      .findOne({ code }, { projection: { _id: 0 } });

    if (!room) return c.json({ error: "Room not found" }, 404);

    let battle: BattleDoc | null = null;
    if (room.status === "battling" || room.status === "finished") {
      battle = await db
        .collection<BattleDoc>("battles")
        .findOne({ roomCode: code }, { projection: { _id: 0 } });
    }

    const response: RoomStateResponse = { room, battle: battle ?? undefined };
    return c.json(response);
  } catch (err) {
    console.error("GET /rooms/:code error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
