import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { initializeSchema } from "./schema";

let singleton: DatabaseSync | undefined;

export function databasePath() {
  return process.env.CIVICLOOP_DB_PATH || path.join(process.cwd(), "data", "civicloop.db");
}

export function getDb(): DatabaseSync {
  if (!singleton) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    singleton = new DatabaseSync(file);
    initializeSchema(singleton);
  }
  return singleton;
}

export function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  initializeSchema(db);
  return db;
}
