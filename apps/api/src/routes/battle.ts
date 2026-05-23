import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getDb } from "../db";
import { registerAction, bothPlayersActed, processTurn } from "../engine/battleEngine";
import { emitBattleUpdate, onBattleUpdate } from "../battleEventBus";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import type { BattleDoc, Action, ActionResponse } from "../../../../packages/shared/types";

export const battleRoutes = new Hono<AuthEnv>();
battleRoutes.use("*", requireAuth);

// GET /battle/:roomCode — current battle state
battleRoutes.get("/:roomCode", async (c) => {
  try {
    const db = await getDb();
    const { roomCode } = c.req.param();

    const battle = await db
      .collection<BattleDoc>("battles")
      .findOne({ roomCode }, { projection: { _id: 0 } });

    if (!battle) return c.json({ error: "Battle not found" }, 404);

    return c.json({ battle });
  } catch (err) {
    console.error("GET /battle/:roomCode error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /battle/:roomCode/events — SSE stream of battle state changes
battleRoutes.get("/:roomCode/events", async (c) => {
  const { roomCode } = c.req.param();
  const db = await getDb();
  return streamSSE(c, async (stream) => {
    const sendLatest = async () => {
      const b = await db
        .collection<BattleDoc>("battles")
        .findOne({ roomCode }, { projection: { _id: 0 } });
      if (b) await stream.writeSSE({ data: JSON.stringify(b), event: "battle" }).catch(() => {});
      return b;
    };
    const initial = await sendLatest();
    if (!initial || initial.status === "finished") return;
    let done = false;
    const off = onBattleUpdate(roomCode, async () => {
      if (done) return;
      const b = await db
        .collection<BattleDoc>("battles")
        .findOne({ roomCode }, { projection: { _id: 0 } });
      if (!b) return;
      await stream.writeSSE({ data: JSON.stringify(b), event: "battle" }).catch(() => { done = true; });
      if (b.status === "finished") { done = true; off(); }
    });
    stream.onAbort(() => { done = true; off(); });
    while (!done) {
      await stream.sleep(20_000);
      if (!done) await stream.writeSSE({ data: "", event: "ping" }).catch(() => { done = true; });
    }
    off();
  });
});

// POST /battle/:roomCode/forfeit — player concedes
battleRoutes.post("/:roomCode/forfeit", async (c) => {
  try {
    const db = await getDb();
    const { roomCode } = c.req.param();
    const body = await c.req.json<{ playerId: string }>();

    if (!body.playerId) {
      return c.json({ error: "playerId is required" }, 400);
    }

    const battle = await db
      .collection<BattleDoc>("battles")
      .findOne({ roomCode });

    if (!battle) return c.json({ error: "Battle not found" }, 404);

    if (battle.status !== "active") {
      return c.json({ error: "Battle is already finished" }, 409);
    }

    const player = battle.players.find((p) => p.id === body.playerId);
    if (!player) return c.json({ error: "Player not in this battle" }, 403);

    const opponent = battle.players.find((p) => p.id !== body.playerId);
    const winnerPlayerId = opponent?.id;
    const activeName =
      player.team.find((p) => p.instanceId === player.activePokemonId)?.name ??
      "Player";

    await db.collection<BattleDoc>("battles").updateOne(
      { roomCode },
      {
        $set: { status: "finished" as const, winnerPlayerId },
        $push: { battleLog: `${activeName} forfeited the battle!` },
      }
    );

    emitBattleUpdate(roomCode);

    const updated = await db
      .collection<BattleDoc>("battles")
      .findOne({ roomCode }, { projection: { _id: 0 } });

    return c.json({ battle: updated });
  } catch (err) {
    console.error("POST /battle/:roomCode/forfeit error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /battle/:roomCode/action — submit player action
battleRoutes.post("/:roomCode/action", async (c) => {
  try {
    const db = await getDb();
    const { roomCode } = c.req.param();
    const body = await c.req.json<{ playerId: string; action: Action }>();

    if (!body.playerId || !body.action) {
      return c.json({ error: "playerId and action are required" }, 400);
    }

    const battle = await db
      .collection<BattleDoc>("battles")
      .findOne({ roomCode });

    if (!battle) return c.json({ error: "Battle not found" }, 404);

    if (battle.status !== "active") {
      return c.json({ error: "Battle is already finished" }, 409);
    }

    // Validate and register the action
    const result = await registerAction(db, battle, body.playerId, body.action);
    if (!result.valid) {
      return c.json({ error: result.error }, 400);
    }
    emitBattleUpdate(roomCode);

    // Reload battle after action registration
    const updatedBattle = (await db
      .collection<BattleDoc>("battles")
      .findOne({ roomCode }))!;

    // If both players have acted, resolve the turn
    if (bothPlayersActed(updatedBattle)) {
      const resolvedBattle = await processTurn(db, updatedBattle);
      emitBattleUpdate(roomCode);
      const response: ActionResponse = { battle: resolvedBattle };
      return c.json(response);
    }

    // Return current state (waiting for other player)
    const response: ActionResponse = { battle: updatedBattle };
    return c.json(response);
  } catch (err) {
    console.error("POST /battle/:roomCode/action error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
