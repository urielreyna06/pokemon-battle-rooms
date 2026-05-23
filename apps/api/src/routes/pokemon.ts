import { Hono } from "hono";
import { getDb } from "../db";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import type { PokemonDoc, PokemonListResponse, UserDoc } from "../../../../packages/shared/types";

const SHINY_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny';

const withShiny = (p: PokemonDoc, shinyUnlocked: boolean): PokemonDoc => {
  if (!shinyUnlocked) return p;
  return { ...p, shinySpriteUrl: `${SHINY_BASE}/${p.pokedexId}.png` };
};

async function getShinyUnlocked(db: Awaited<ReturnType<typeof getDb>>, userId: string): Promise<boolean> {
  const user = await db.collection<UserDoc>('users').findOne({ clerkId: userId });
  return user?.shinyUnlocked ?? false;
}

export const pokemonRoutes = new Hono<AuthEnv>();
pokemonRoutes.use("*", requireAuth);

// GET /pokemon?limit=20&offset=0&name=bulba&type=fire
pokemonRoutes.get("/", async (c) => {
  try {
    const db = await getDb();
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 1000);
    const offset = Number(c.req.query("offset") ?? 0);
    const nameQuery = c.req.query("name")?.trim().toLowerCase();
    const typeQuery = c.req.query("type")?.trim().toLowerCase();

    const filter: Record<string, unknown> = {};
    if (nameQuery) filter["name"] = { $regex: nameQuery, $options: "i" };
    if (typeQuery) {
      const types = typeQuery.split(',').map(t => t.trim()).filter(Boolean);
      filter["types"] = types.length === 1 ? types[0] : { $in: types };
    }

    const [pokemon, total, shinyUnlocked] = await Promise.all([
      db
        .collection<PokemonDoc>("pokemon")
        .find(filter)
        .skip(offset)
        .limit(limit)
        .project({ _id: 0 })
        .toArray(),
      db.collection<PokemonDoc>("pokemon").countDocuments(filter),
      getShinyUnlocked(db, c.get("userId")),
    ]);

    const response: PokemonListResponse = {
      pokemon: pokemon.map((p) => withShiny(p, shinyUnlocked)),
      total,
    };
    return c.json(response);
  } catch (err) {
    console.error("GET /pokemon error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /pokemon/:id  (by pokedexId)
pokemonRoutes.get("/:id", async (c) => {
  try {
    const db = await getDb();
    const pokedexId = Number(c.req.param("id"));

    if (isNaN(pokedexId)) {
      return c.json({ error: "Invalid pokedexId" }, 400);
    }

    const [pokemon, shinyUnlocked] = await Promise.all([
      db.collection<PokemonDoc>("pokemon").findOne({ pokedexId }, { projection: { _id: 0 } }),
      getShinyUnlocked(db, c.get("userId")),
    ]);

    if (!pokemon) {
      return c.json({ error: "Pokémon not found" }, 404);
    }

    return c.json(withShiny(pokemon, shinyUnlocked));
  } catch (err) {
    console.error("GET /pokemon/:id error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
