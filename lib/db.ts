import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  db?: PostgresJsDatabase<typeof schema>;
};

/** Connects on first use, so builds don't need DATABASE_URL. The connection is reused across dev hot reloads. */
export function getDb() {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing DATABASE_URL");
    // prepare: false keeps this working through a transaction-mode pooler.
    globalForDb.db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return globalForDb.db;
}
