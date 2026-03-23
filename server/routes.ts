import { Server } from "http";
import { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import { processVideo } from "./processor";
import { generateSharePNG, generateShareGIF } from "./imageGen";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "data", "outputs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Rate limiting: 5 uploads per IP per hour
const uploadCount: Record<string, { count: number; resetAt: number }> = {};
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = uploadCount[ip];
  if (!entry || entry.resetAt < now) {
    uploadCount[ip] = { count: 1, resetAt: now + RATE_WINDOW_MS };
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/quicktime", "video/x-m4v", "video/avi", "video/webm"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only MP4, MOV, AVI, WebM allowed.`));
    }
  },
});

export async function registerRoutes(httpServer: Server, app: Express) {
  // GET /api/health — Railway health check
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // POST /api/upload — upload and start analysis
  app.post("/api/upload", (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "Rate limit reached. Max 5 uploads per hour." });
    }

    upload.single("video")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded." });
      }

      const jobId = uuidv4();
      const jobOutputDir = path.join(OUTPUT_DIR, jobId);
      fs.mkdirSync(jobOutputDir, { recursive: true });

      // Create job record
      const analysis = storage.createAnalysis({
        id: jobId,
        status: "processing",
        verdict: null,
        confidence: null,
        errorMessage: null,
        playersJson: null,
        ballJson: null,
        offsideLineX: null,
        frameWidth: null,
        frameHeight: null,
        passFrame: null,
        totalFrames: null,
        shareToken: null,
        shareExpiresAt: null,
        pngPath: null,
        gifPath: null,
      });

      // Process async
      processJobAsync(jobId, req.file!.path, jobOutputDir);

      return res.json({ jobId });
    });
  });

  // GET /api/status/:jobId — poll for result
  app.get("/api/status/:jobId", (req: Request, res: Response) => {
    const { jobId } = req.params;
    const analysis = storage.getAnalysis(jobId);
    if (!analysis) {
      return res.status(404).json({ error: "Job not found." });
    }
    return res.json(analysis);
  });

  // GET /api/share/:token — resolve share link
  app.get("/api/share/:token", (req: Request, res: Response) => {
    const { token } = req.params;
    const analysis = storage.getAnalysisByShareToken(token);
    if (!analysis) {
      return res.status(404).json({ error: "Share link not found or expired." });
    }
    // Check expiry
    if (analysis.shareExpiresAt && analysis.shareExpiresAt < Math.floor(Date.now() / 1000)) {
      return res.status(410).json({ error: "This share link has expired." });
    }
    return res.json(analysis);
  });

  // GET /api/output/:jobId/png — serve the PNG
  app.get("/api/output/:jobId/png", (req: Request, res: Response) => {
    const analysis = storage.getAnalysis(req.params.jobId);
    if (!analysis?.pngPath || !fs.existsSync(analysis.pngPath)) {
      return res.status(404).json({ error: "PNG not ready." });
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="offside_verdict_${req.params.jobId.slice(0, 8)}.png"`);
    fs.createReadStream(analysis.pngPath).pipe(res);
  });

  // GET /api/output/:jobId/gif — serve the GIF
  app.get("/api/output/:jobId/gif", (req: Request, res: Response) => {
    const analysis = storage.getAnalysis(req.params.jobId);
    if (!analysis?.gifPath || !fs.existsSync(analysis.gifPath)) {
      return res.status(404).json({ error: "GIF not ready." });
    }
    const isGif = analysis.gifPath.endsWith(".gif");
    res.setHeader("Content-Type", isGif ? "image/gif" : "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="offside_animation_${req.params.jobId.slice(0, 8)}.${isGif ? "gif" : "png"}"`);
    fs.createReadStream(analysis.gifPath).pipe(res);
  });

  // GET /api/output/:jobId/png-inline — serve PNG inline (for display)
  app.get("/api/output/:jobId/png-inline", (req: Request, res: Response) => {
    const analysis = storage.getAnalysis(req.params.jobId);
    if (!analysis?.pngPath || !fs.existsSync(analysis.pngPath)) {
      return res.status(404).json({ error: "PNG not ready." });
    }
    res.setHeader("Content-Type", "image/png");
    fs.createReadStream(analysis.pngPath).pipe(res);
  });

  // GET /api/output/:jobId/gif-inline — serve GIF inline
  app.get("/api/output/:jobId/gif-inline", (req: Request, res: Response) => {
    const analysis = storage.getAnalysis(req.params.jobId);
    if (!analysis?.gifPath || !fs.existsSync(analysis.gifPath)) {
      return res.status(404).json({ error: "GIF not ready." });
    }
    const isGif = analysis.gifPath.endsWith(".gif");
    res.setHeader("Content-Type", isGif ? "image/gif" : "image/png");
    fs.createReadStream(analysis.gifPath).pipe(res);
  });
}

async function processJobAsync(jobId: string, videoPath: string, jobOutputDir: string) {
  try {
    const result = await processVideo(videoPath, jobId);

    if (result.error) {
      storage.updateAnalysis(jobId, {
        status: "uncertain",
        verdict: "UNCERTAIN",
        confidence: "LOW",
        errorMessage: result.error,
      });
      return;
    }

    // Generate PNG + GIF
    let pngPath: string | null = null;
    let gifPath: string | null = null;

    try {
      pngPath = await generateSharePNG(
        jobId,
        result.verdict,
        result.confidence,
        result.players,
        result.ball,
        result.offsideLineX,
        jobOutputDir
      );
    } catch (e) {
      console.error("PNG generation failed:", e);
    }

    try {
      gifPath = await generateShareGIF(
        jobId,
        result.verdict,
        result.confidence,
        result.players,
        result.ball,
        result.offsideLineX,
        result.passFrame,
        result.totalFrames,
        jobOutputDir
      );
    } catch (e) {
      console.error("GIF generation failed:", e);
    }

    // Generate share token
    const shareToken = uuidv4().replace(/-/g, "").slice(0, 12);
    const shareExpiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours

    storage.updateAnalysis(jobId, {
      status: "complete",
      verdict: result.verdict,
      confidence: result.confidence,
      playersJson: JSON.stringify(result.players),
      ballJson: result.ball ? JSON.stringify(result.ball) : null,
      offsideLineX: result.offsideLineX,
      frameWidth: result.frameWidth,
      frameHeight: result.frameHeight,
      passFrame: result.passFrame,
      totalFrames: result.totalFrames,
      shareToken,
      shareExpiresAt,
      pngPath,
      gifPath,
    });

    // Clean up uploaded file
    try { fs.unlinkSync(videoPath); } catch (_e) {}
  } catch (error) {
    console.error("Processing failed:", error);
    storage.updateAnalysis(jobId, {
      status: "failed",
      errorMessage: "Processing failed. Please try again with a different clip.",
    });
  }
}
