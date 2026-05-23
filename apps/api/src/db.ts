import { MongoClient, Db } from "mongodb";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017/pokemon_battle";

let client: MongoClient | null = null;
let db: Db | null = null;

async function ensureTTLIndexes(database: Db): Promise<void> {
  // rooms: expire waiting rooms after 6h, finished rooms after 24h
  await database.collection("rooms").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 86400, name: "rooms_ttl_24h", background: true }
  );
  // battles: expire finished battles after 24h
  await database.collection("battles").createIndex(
    { turnStartedAt: 1 },
    { expireAfterSeconds: 86400, name: "battles_ttl_24h", background: true }
  );
}

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db();
  console.log("✅ MongoDB connected");
  await ensureTTLIndexes(db).catch((err) =>
    console.warn("⚠️  TTL index setup warning:", err?.message)
  );
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
