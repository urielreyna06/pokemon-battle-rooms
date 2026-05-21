/**
 * Import Pokémon data from PokeAPI into MongoDB.
 *
 * Run with: bun run scripts/import-pokemon.ts
 *
 * Idempotent: safe to run multiple times — uses upsert for all writes.
 * Only Pokémon with exactly 4 valid damaging moves (power != null, accuracy != null,
 * damageClass != "status") are included. The rest are logged to excluded_pokemon.
 */

import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017/pokemon_battle";
const POKEAPI = "https://pokeapi.co/api/v2";
const DELAY_MS = 120; // Polite delay between requests to avoid rate limits
const POKEMON_LIMIT = 300;

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 429) {
          console.warn(`  Rate limited, waiting 2s...`);
          await sleep(2000);
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * attempt);
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

// ─── PokeAPI response shapes (only fields we need) ────────────────────────

interface PokeListResult {
  results: Array<{ name: string; url: string }>;
  count: number;
}

interface PokeDetail {
  id: number;
  name: string;
  types: Array<{ type: { name: string } }>;
  stats: Array<{ base_stat: number; stat: { name: string } }>;
  sprites: {
    front_default: string;
    other?: { showdown?: { front_default?: string } };
  };
  moves: Array<{ move: { name: string; url: string } }>;
}

interface MoveDetail {
  id: number;
  name: string;
  type: { name: string };
  power: number | null;
  accuracy: number | null;
  priority: number;
  damage_class: { name: string };
  effect_entries: Array<{ effect: string; language: { name: string } }>;
}

interface TypeDetail {
  name: string;
  damage_relations: {
    double_damage_to: Array<{ name: string }>;
    half_damage_to: Array<{ name: string }>;
    no_damage_to: Array<{ name: string }>;
    double_damage_from: Array<{ name: string }>;
    half_damage_from: Array<{ name: string }>;
    no_damage_from: Array<{ name: string }>;
  };
}

// ─── Main import logic ────────────────────────────────────────────────────

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();

  const pokemonCol = db.collection("pokemon");
  const movesCol = db.collection("moves");
  const typeRelCol = db.collection("type_relations");
  const excludedCol = db.collection("excluded_pokemon");

  // Create indexes for idempotency
  await pokemonCol.createIndex({ pokedexId: 1 }, { unique: true });
  await movesCol.createIndex({ id: 1 }, { unique: true });
  await typeRelCol.createIndex({ type: 1 }, { unique: true });

  // ── Step 1: Import type relations (types 1–18) ─────────────────────────
  console.log("\n📊 Importing type relations (types 1–18)...");
  for (let typeId = 1; typeId <= 18; typeId++) {
    try {
      const typeData = await fetchJSON<TypeDetail>(`${POKEAPI}/type/${typeId}/`);
      const dr = typeData.damage_relations;

      await typeRelCol.updateOne(
        { type: typeData.name },
        {
          $set: {
            type: typeData.name,
            doubleDamageTo: dr.double_damage_to.map((t) => t.name),
            halfDamageTo: dr.half_damage_to.map((t) => t.name),
            noDamageTo: dr.no_damage_to.map((t) => t.name),
            doubleDamageFrom: dr.double_damage_from.map((t) => t.name),
            halfDamageFrom: dr.half_damage_from.map((t) => t.name),
            noDamageFrom: dr.no_damage_from.map((t) => t.name),
          },
        },
        { upsert: true }
      );
      console.log(`  ✓ Type: ${typeData.name}`);
    } catch (err) {
      console.error(`  ✗ Failed type ${typeId}:`, err);
    }
    await sleep(DELAY_MS);
  }

  // ── Step 2: Fetch first 300 Pokémon list ──────────────────────────────
  console.log(`\n🦊 Fetching list of ${POKEMON_LIMIT} Pokémon...`);
  const list = await fetchJSON<PokeListResult>(
    `${POKEAPI}/pokemon?limit=${POKEMON_LIMIT}&offset=0`
  );
  const pokemonEntries = list.results;
  console.log(`  Found ${pokemonEntries.length} Pokémon to process.`);

  let imported = 0;
  let excluded = 0;
  const moveCache = new Map<string, MoveDetail>(); // Avoid re-fetching same move

  // ── Step 3: Process each Pokémon ──────────────────────────────────────
  for (let i = 0; i < pokemonEntries.length; i++) {
    const entry = pokemonEntries[i];
    console.log(`\n[${i + 1}/${pokemonEntries.length}] Processing: ${entry.name}`);

    try {
      const detail = await fetchJSON<PokeDetail>(entry.url);
      await sleep(DELAY_MS);

      // Extract stat map
      const statMap: Record<string, number> = {};
      for (const s of detail.stats) {
        statMap[s.stat.name] = s.base_stat;
      }

      const baseStats = {
        hp: statMap["hp"] ?? 1,
        attack: statMap["attack"] ?? 1,
        defense: statMap["defense"] ?? 1,
        specialAttack: statMap["special-attack"] ?? 1,
        specialDefense: statMap["special-defense"] ?? 1,
        speed: statMap["speed"] ?? 1,
      };

      // Sprite: use front_default consistently
      const spriteUrl =
        detail.sprites.other?.showdown?.front_default ??
        detail.sprites.front_default ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${detail.id}.png`;

      const types = detail.types.map((t) => t.type.name);

      // ── Find exactly 4 valid moves ─────────────────────────────────
      // "Valid" = has power AND accuracy AND damageClass != "status"
      const validMoveIds: string[] = [];

      for (const moveRef of detail.moves) {
        if (validMoveIds.length >= 4) break;

        const moveName = moveRef.move.name;
        let moveData: MoveDetail;

        if (moveCache.has(moveName)) {
          moveData = moveCache.get(moveName)!;
        } else {
          try {
            moveData = await fetchJSON<MoveDetail>(moveRef.move.url);
            moveCache.set(moveName, moveData);
            await sleep(DELAY_MS);
          } catch {
            console.warn(`    ⚠ Skipping move ${moveName} (fetch failed)`);
            continue;
          }
        }

        const isValid =
          moveData.power !== null &&
          moveData.accuracy !== null &&
          moveData.damage_class.name !== "status";

        if (!isValid) continue;

        validMoveIds.push(moveData.name);

        // Upsert move into MongoDB
        const effect =
          moveData.effect_entries.find((e) => e.language.name === "en")?.effect ?? "";

        await movesCol.updateOne(
          { id: moveData.name },
          {
            $set: {
              id: moveData.name,
              name: moveData.name,
              type: moveData.type.name,
              power: moveData.power,
              accuracy: moveData.accuracy,
              priority: moveData.priority,
              damageClass: moveData.damage_class.name as "physical" | "special",
              effect,
            },
          },
          { upsert: true }
        );
      }

      // ── Exclude if fewer than 4 valid moves ───────────────────────
      if (validMoveIds.length < 4) {
        console.warn(
          `  ✗ Excluded ${detail.name} (only ${validMoveIds.length} valid moves)`
        );
        await excludedCol.updateOne(
          { pokedexId: detail.id },
          {
            $set: {
              pokedexId: detail.id,
              name: detail.name,
              reason: `Only ${validMoveIds.length} valid moves found (need 4)`,
            },
          },
          { upsert: true }
        );
        excluded++;
        continue;
      }

      // ── Upsert Pokémon document ────────────────────────────────────
      await pokemonCol.updateOne(
        { pokedexId: detail.id },
        {
          $set: {
            pokedexId: detail.id,
            name: detail.name,
            types,
            baseStats,
            spriteUrl,
            moveIds: validMoveIds.slice(0, 4),
          },
        },
        { upsert: true }
      );

      imported++;
      console.log(
        `  ✓ Imported ${detail.name} [${types.join("/")}] moves: ${validMoveIds.slice(0, 4).join(", ")}`
      );
    } catch (err) {
      console.error(`  ✗ Error processing ${entry.name}:`, err);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const totalInDB = await pokemonCol.countDocuments();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Import complete!`);
  console.log(`   Imported this run : ${imported}`);
  console.log(`   Excluded this run : ${excluded}`);
  console.log(`   Total in MongoDB  : ${totalInDB}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
