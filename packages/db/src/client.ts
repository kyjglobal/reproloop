import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseConnection {
  database: Database;
  close(): Promise<void>;
}

export interface CreateDatabaseOptions {
  maxConnections?: number;
}

export function createDatabase(
  databaseUrl: string,
  options: CreateDatabaseOptions = {},
): DatabaseConnection {
  if (!databaseUrl.trim()) {
    throw new Error("databaseUrl is required");
  }

  const client = postgres(databaseUrl, {
    max: options.maxConnections ?? 10,
  });

  return {
    database: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
