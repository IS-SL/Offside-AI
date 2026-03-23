import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(path.join(dbDir, "offside.db"));
export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    verdict TEXT,
    confidence TEXT,
    error_message TEXT,
    players_json TEXT,
    ball_json TEXT,
    offside_line_x REAL,
    frame_width INTEGER,
    frame_height INTEGER,
    pass_frame INTEGER,
    total_frames INTEGER,
    share_token TEXT,
    share_expires_at INTEGER,
    png_path TEXT,
    gif_path TEXT,
    created_at INTEGER NOT NULL
  )
`);
