import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { pinSslMode } from "./connection";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — see .env.example");
}

/*
 * Neon's HTTP driver is the right choice on Vercel: it issues one stateless
 * request per query, so serverless invocations never hold a pooled TCP
 * connection open. It only speaks to Neon endpoints, though, so local
 * development against a plain Postgres falls back to node-postgres. Both
 * expose the same Drizzle query API, so nothing downstream changes.
 */
const isNeon = /\.neon\.tech|neon\.build/.test(connectionString);

export const db = isNeon
  ? drizzleNeon(neon(connectionString), { schema })
  : drizzleNode(new Pool({ connectionString: pinSslMode(connectionString) }), { schema });

export { schema };
