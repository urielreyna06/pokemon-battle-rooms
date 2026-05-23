import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateIndex = vi.fn().mockResolvedValue('ok');
const mockCollection = vi.fn().mockReturnValue({ createIndex: mockCreateIndex });
const mockDb = { collection: mockCollection };

vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    db: vi.fn().mockReturnValue(mockDb),
  })),
  Db: class {},
}));

// db.ts caches the connection; reset modules each test to get a fresh module instance
beforeEach(() => {
  vi.resetModules();
  mockCreateIndex.mockClear();
  mockCollection.mockClear();
});

describe('MongoDB TTL indexes', () => {
  it('creates exactly two TTL indexes on connect', async () => {
    const { getDb } = await import('../src/db');
    await getDb();
    expect(mockCreateIndex).toHaveBeenCalledTimes(2);
  });

  it('creates a 24h TTL index on rooms.createdAt named rooms_ttl_24h', async () => {
    const { getDb } = await import('../src/db');
    await getDb();

    // rooms is always the first collection accessed in ensureTTLIndexes
    const collectionNames = mockCollection.mock.calls.map((c) => c[0]);
    const idx = collectionNames.indexOf('rooms');
    expect(idx).toBeGreaterThanOrEqual(0);

    const [keySpec, options] = mockCreateIndex.mock.calls[idx];
    expect(keySpec).toEqual({ createdAt: 1 });
    expect(options).toMatchObject({ expireAfterSeconds: 86400, name: 'rooms_ttl_24h' });
  });

  it('creates a 24h TTL index on battles.turnStartedAt named battles_ttl_24h', async () => {
    const { getDb } = await import('../src/db');
    await getDb();

    const collectionNames = mockCollection.mock.calls.map((c) => c[0]);
    const idx = collectionNames.indexOf('battles');
    expect(idx).toBeGreaterThanOrEqual(0);

    const [keySpec, options] = mockCreateIndex.mock.calls[idx];
    expect(keySpec).toEqual({ turnStartedAt: 1 });
    expect(options).toMatchObject({ expireAfterSeconds: 86400, name: 'battles_ttl_24h' });
  });

  it('does not recreate TTL indexes on subsequent getDb() calls', async () => {
    const { getDb } = await import('../src/db');
    await getDb();
    await getDb(); // second call hits the cached db — should not call createIndex again
    expect(mockCreateIndex).toHaveBeenCalledTimes(2);
  });
});
