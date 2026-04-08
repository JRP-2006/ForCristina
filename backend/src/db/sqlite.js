import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/data (ruta fija aunque cambie el cwd)
const defaultDataDir = path.join(__dirname, "..", "..", "data");

const dataDir = process.env.APP_DATA_DIR || defaultDataDir;
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "forcristina.sqlite");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");