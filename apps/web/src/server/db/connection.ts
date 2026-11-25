import { createDatabase, type DatabaseConnection } from "@reproloop/db/client";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL is missing or empty.");
    this.name = "DatabaseConfigurationError";
  }
}

const databaseGlobal = globalThis as typeof globalThis & {
  reproloopDatabaseConnection?: DatabaseConnection;
};

function readDatabaseUrl(): string {
  if (process.env.REPROLOOP_MODE === "broker") throw new DatabaseConfigurationError();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new DatabaseConfigurationError();
  }

  return databaseUrl;
}

export function getDatabaseConnection(): DatabaseConnection {
  databaseGlobal.reproloopDatabaseConnection ??= createDatabase(readDatabaseUrl());
  return databaseGlobal.reproloopDatabaseConnection;
}

export function getDatabase() {
  return getDatabaseConnection().database;
}
