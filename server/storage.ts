import { db } from "./db";
import { analyses } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Analysis, InsertAnalysis } from "@shared/schema";

export interface IStorage {
  createAnalysis(data: Omit<InsertAnalysis, "id"> & { id: string }): Analysis;
  getAnalysis(id: string): Analysis | undefined;
  getAnalysisByShareToken(token: string): Analysis | undefined;
  updateAnalysis(id: string, data: Partial<InsertAnalysis>): Analysis | undefined;
}

export class Storage implements IStorage {
  createAnalysis(data: Omit<InsertAnalysis, "id"> & { id: string }): Analysis {
    return db
      .insert(analyses)
      .values({ ...data, createdAt: Math.floor(Date.now() / 1000) })
      .returning()
      .get();
  }

  getAnalysis(id: string): Analysis | undefined {
    return db.select().from(analyses).where(eq(analyses.id, id)).get();
  }

  getAnalysisByShareToken(token: string): Analysis | undefined {
    return db.select().from(analyses).where(eq(analyses.shareToken, token)).get();
  }

  updateAnalysis(id: string, data: Partial<InsertAnalysis>): Analysis | undefined {
    return db
      .update(analyses)
      .set(data)
      .where(eq(analyses.id, id))
      .returning()
      .get();
  }
}

export const storage = new Storage();
