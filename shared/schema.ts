import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Analysis jobs table
export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(), // UUID
  status: text("status").notNull().default("pending"), // pending | processing | complete | failed | uncertain
  verdict: text("verdict"), // OFFSIDE | ONSIDE | UNCERTAIN | null
  confidence: text("confidence"), // LOW | MEDIUM | HIGH | null
  errorMessage: text("error_message"),
  // Detection data (JSON)
  playersJson: text("players_json"), // serialized player positions
  ballJson: text("ball_json"), // serialized ball position
  offsideLineX: real("offside_line_x"), // x position of offside line in normalized coords
  frameWidth: integer("frame_width"),
  frameHeight: integer("frame_height"),
  passFrame: integer("pass_frame"), // which frame was the pass moment
  totalFrames: integer("total_frames"),
  // Output files
  shareToken: text("share_token"), // short token for share link
  shareExpiresAt: integer("share_expires_at"), // unix timestamp
  pngPath: text("png_path"),
  gifPath: text("gif_path"),
  createdAt: integer("created_at").notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  createdAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

// Player object (used in JSON fields)
export interface PlayerDetection {
  id: number;
  team: "attacking" | "defending" | "unknown"; // jersey colour separation
  x: number; // normalised 0-1
  y: number;
  w: number;
  h: number;
  isAttacking?: boolean; // the offside-candidate
  isSecondLastDefender?: boolean;
  isPasser?: boolean;
}

export interface BallDetection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameData {
  players: PlayerDetection[];
  ball: BallDetection | null;
}
