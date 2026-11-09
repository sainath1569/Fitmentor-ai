import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { config, dataDir, isProd } from './config.js';

const EMBEDDED_PORT = Number(process.env.EMBEDDED_MONGO_PORT || 27117);
// journal=true: a write is only acknowledged once it is on disk. Windows has no
// graceful signal for child processes, so mongod can die instantly, and without this
// the latest writes would be lost when a terminal is closed.
const EMBEDDED_URI = `mongodb://127.0.0.1:${EMBEDDED_PORT}/fitmentor?w=1&journal=true`;

let embedded = null;

/** A dev restart can leave mongod running. Reusing it avoids a port clash. */
async function reuseRunningMongo() {
  try {
    await mongoose.connect(EMBEDDED_URI, { serverSelectionTimeoutMS: 700 });
    return true;
  } catch {
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

// Uses MONGODB_URI when set. Otherwise runs a local MongoDB whose files live in
// server/.data/mongo, so the app works on a machine with no database installed.
export async function connectDb(uri = config.mongoUri) {
  if (uri) {
    await mongoose.connect(uri);
    return;
  }
  if (isProd) throw new Error('MONGODB_URI must be set in production');

  const dbPath = join(dataDir, 'mongo');
  if (await reuseRunningMongo()) {
    console.log('Using the embedded MongoDB that is already running');
    return;
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mkdirSync(dbPath, { recursive: true });
  embedded = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', dbName: 'fitmentor', port: EMBEDDED_PORT },
  });
  await mongoose.connect(EMBEDDED_URI);
  console.log(`Using embedded MongoDB (data in ${dbPath})`);
}

export async function disconnectDb() {
  if (embedded) {
    // The shutdown command flushes to disk; the connection closing is the expected reply.
    await mongoose.connection.db.admin().command({ shutdown: 1 }).catch(() => {});
  }
  await mongoose.disconnect().catch(() => {});
  if (embedded) await embedded.stop({ doCleanup: false }).catch(() => {});
  embedded = null;
}
