import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createBunWebSocket } from "hono/bun";
import { verifyToken } from "@clerk/backend";
import { getDb } from "./db";
import { roomRoutes } from "./routes/rooms";
import { battleRoutes } from "./routes/battle";
import { pokemonRoutes } from "./routes/pokemon";
import { userRoutes } from "./routes/users";
import { stripeRoutes } from "./routes/stripe";
import { clerkWebhookRoutes } from "./webhooks/clerkWebhook";
import { stripeWebhookRoutes } from "./webhooks/stripeWebhook";
import {
  registerClient,
  removeClient,
  broadcastToOpponent,
} from "./teamSocket";

const app = new Hono();
const { upgradeWebSocket, websocket } = createBunWebSocket();

// ─── Middleware ────────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Routes ────────────────────────────────────────────────────────────────
// Webhooks must be mounted before any body-parsing middleware (raw body needed)
app.route("/webhooks/clerk", clerkWebhookRoutes);
app.route("/webhooks/stripe", stripeWebhookRoutes);

app.route("/rooms", roomRoutes);
app.route("/battle", battleRoutes);
app.route("/pokemon", pokemonRoutes);
app.route("/users", userRoutes);
app.route("/stripe", stripeRoutes);

// ─── WebSocket: Real-time team selection sync ──────────────────────────────
app.get(
  "/ws/team/:roomCode",
  upgradeWebSocket(async (c) => {
    const roomCode = c.req.param("roomCode");
    const token = c.req.query("token");

    // Verify JWT using Clerk
    let playerId: string;
    try {
      const payload = await verifyToken(token ?? "", {
        secretKey: process.env.CLERK_SECRET_KEY ?? "",
      });
      playerId = payload.sub;
    } catch {
      // Return a handler that immediately closes on invalid auth
      return {
        onOpen(_, ws) {
          ws.close(4001, "Unauthorized");
        },
      };
    }

    return {
      onOpen(_, ws) {
        registerClient(roomCode, playerId, ws as ServerWebSocket<unknown>);
      },
      onMessage(event) {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            pokemonIds: string[];
          };
          if (msg.type === "update_selection") {
            broadcastToOpponent(
              roomCode,
              playerId,
              JSON.stringify({
                type: "selection_update",
                playerId,
                pokemonIds: msg.pokemonIds,
              })
            );
          }
        } catch {
          // Ignore malformed messages
        }
      },
      onClose() {
        removeClient(roomCode, playerId);
      },
    };
  })
);

// ─── Health check ─────────────────────────────────────────────────────────
app.get("/health", async (c) => {
  try {
    const db = await getDb();
    const pokemonCount = await db.collection("pokemon").countDocuments();
    return c.json({
      status: "ok",
      pokemon_in_db: pokemonCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ status: "error", message: String(err) }, 500);
  }
});

// ─── Start server ──────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);

// Connect DB on startup
getDb()
  .then(() => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

export default {
  port: PORT,
  fetch: app.fetch,
  websocket,
};
