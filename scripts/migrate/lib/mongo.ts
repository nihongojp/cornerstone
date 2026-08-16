import { MongoClient, type Db } from "mongodb";

/**
 * Raw MongoDB driver rather than Mongoose on purpose: the `newlessons`
 * collection is schemaless, and Mongoose would coerce or drop fields the
 * schema doesn't know about. The migration must copy documents verbatim.
 */
export async function connectMongo(): Promise<{ db: Db; close: () => Promise<void> }> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set — see .env.example (local only, never on Vercel)");
  }

  const client = new MongoClient(uri);
  await client.connect();
  return { db: client.db(), close: () => client.close() };
}
