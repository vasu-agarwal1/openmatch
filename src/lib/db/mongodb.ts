/**
 * MongoDB client singleton.
 *
 * We export a `clientPromise` so both the NextAuth MongoDB adapter
 * (which needs a raw MongoClient) and any direct collection access can
 * share the same connection pool across the entire application lifecycle.
 *
 * In development the promise is cached on the global object to survive
 * hot-module-replacement; in production a single module-level promise is used.
 */

import { MongoClient, MongoClientOptions } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {};

declare global {
  // Prevent TypeScript errors on the global cache
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development, cache the promise on the Node.js global so it survives HMR
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, create a new promise per module instance (one per worker)
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
