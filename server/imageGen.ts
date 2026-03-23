/**
 * Generates shareable PNG freeze frame with verdict badge overlay
 * Uses canvas to draw a synthetic top-down pitch view + verdict
 */

import { createCanvas } from "canvas";
import path from "path";
import fs from "fs";
import type { PlayerDetection, BallDetection } from "@shared/schema";

const PITCH_COLOR = "#1a4a2e";
const PITCH_LINE_COLOR = "rgba(255,255,255,0.7)";
const TEAM_A_COLOR = "#60cfed"; // attacking
const TEAM_B_COLOR = "#f97316"; // defending
const BALL_COLOR = "#f5f5f5";
const OFFSIDE_LINE_COLOR = "#ef4444";

export async function generateSharePNG(
  jobId: string,
  verdict: "OFFSIDE" | "ONSIDE" | "UNCERTAIN",
  confidence: "LOW" | "MEDIUM" | "HIGH",
  players: PlayerDetection[],
  ball: BallDetection | null,
  offsideLineX: number,
  outputDir: string
): Promise<string> {
  const W = 800;
  const H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0f1a14");
  bg.addColorStop(1, "#071010");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Pitch area (top-down view)
  const pitchX = 40;
  const pitchY = 60;
  const pitchW = W - 80;
  const pitchH = H - 160;

  // Pitch field
  ctx.fillStyle = PITCH_COLOR;
  ctx.roundRect(pitchX, pitchY, pitchW, pitchH, 6);
  ctx.fill();

  // Pitch stripes
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pitchX, pitchY, pitchW, pitchH, 6);
  ctx.clip();
  const stripeWidth = pitchW / 8;
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(pitchX + i * stripeWidth, pitchY, stripeWidth, pitchH);
    }
  }
  ctx.restore();

  // Pitch lines
  ctx.strokeStyle = PITCH_LINE_COLOR;
  ctx.lineWidth = 1.5;

  // Border
  ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);

  // Centre line
  ctx.beginPath();
  ctx.moveTo(pitchX + pitchW / 2, pitchY);
  ctx.lineTo(pitchX + pitchW / 2, pitchY + pitchH);
  ctx.stroke();

  // Centre circle
  ctx.beginPath();
  ctx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, pitchH * 0.15, 0, Math.PI * 2);
  ctx.stroke();

  // Penalty boxes
  const boxW = pitchW * 0.12;
  const boxH = pitchH * 0.55;
  const boxY = pitchY + (pitchH - boxH) / 2;
  ctx.strokeRect(pitchX, boxY, boxW, boxH); // left box
  ctx.strokeRect(pitchX + pitchW - boxW, boxY, boxW, boxH); // right box

  // Goal areas
  const goalW = pitchW * 0.04;
  const goalH = pitchH * 0.3;
  const goalY = pitchY + (pitchH - goalH) / 2;
  ctx.strokeRect(pitchX, goalY, goalW, goalH);
  ctx.strokeRect(pitchX + pitchW - goalW, goalY, goalW, goalH);

  // Offside line
  const olX = pitchX + offsideLineX * pitchW;
  ctx.strokeStyle = OFFSIDE_LINE_COLOR;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(olX, pitchY);
  ctx.lineTo(olX, pitchY + pitchH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Offside line label
  ctx.fillStyle = OFFSIDE_LINE_COLOR;
  ctx.font = "bold 11px 'Arial'";
  ctx.textAlign = "center";
  ctx.fillText("OFFSIDE LINE", olX, pitchY - 8);

  // Draw players
  const pRadius = 8;
  for (const p of players) {
    const px = pitchX + p.x * pitchW;
    const py = pitchY + p.y * pitchH;

    // Glow for key players
    if (p.isAttacking || p.isSecondLastDefender) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = p.team === "attacking" ? TEAM_A_COLOR : TEAM_B_COLOR;
    }

    ctx.beginPath();
    ctx.arc(px, py, pRadius, 0, Math.PI * 2);
    ctx.fillStyle = p.team === "attacking" ? TEAM_A_COLOR : TEAM_B_COLOR;
    ctx.fill();
    ctx.strokeStyle = p.isAttacking || p.isSecondLastDefender ? "#ffffff" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = p.isAttacking || p.isSecondLastDefender ? 2 : 1;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Direction arrow hint for key players
    if (p.isAttacking) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px Arial";
      ctx.textAlign = "center";
      ctx.fillText("A", px, py + 3);
    } else if (p.isSecondLastDefender) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px Arial";
      ctx.textAlign = "center";
      ctx.fillText("D", px, py + 3);
    }
  }

  // Draw ball
  if (ball) {
    const bx = pitchX + ball.x * pitchW;
    const by = pitchY + ball.y * pitchH;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLOR;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Legend
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  const legendY = pitchY + pitchH + 18;
  
  // Attacking
  ctx.beginPath();
  ctx.arc(pitchX + 10, legendY, 6, 0, Math.PI * 2);
  ctx.fillStyle = TEAM_A_COLOR;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Attacking", pitchX + 22, legendY + 4);

  // Defending
  ctx.beginPath();
  ctx.arc(pitchX + 100, legendY, 6, 0, Math.PI * 2);
  ctx.fillStyle = TEAM_B_COLOR;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Defending", pitchX + 112, legendY + 4);

  // Ball
  ctx.beginPath();
  ctx.arc(pitchX + 200, legendY, 4, 0, Math.PI * 2);
  ctx.fillStyle = BALL_COLOR;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Ball", pitchX + 210, legendY + 4);

  // Offside line label
  ctx.strokeStyle = OFFSIDE_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pitchX + 270, legendY);
  ctx.lineTo(pitchX + 290, legendY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = OFFSIDE_LINE_COLOR;
  ctx.fillText("Offside Line", pitchX + 296, legendY + 4);

  // Verdict badge
  const verdictColors: Record<string, string[]> = {
    OFFSIDE: ["#ef4444", "#7f1d1d"],
    ONSIDE: ["#22c55e", "#14532d"],
    UNCERTAIN: ["#f59e0b", "#78350f"],
  };
  const [verdictColor, verdictDark] = verdictColors[verdict];

  const badgeX = W - 180;
  const badgeY = 30;
  const badgeW = 150;
  const badgeH = 50;

  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  badgeGrad.addColorStop(0, verdictColor);
  badgeGrad.addColorStop(1, verdictDark);
  ctx.fillStyle = badgeGrad;
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.fillText(verdict, badgeX + badgeW / 2, badgeY + 26);
  ctx.font = "11px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(`Confidence: ${confidence}`, badgeX + badgeW / 2, badgeY + 42);

  // Brand watermark
  ctx.font = "11px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "left";
  ctx.fillText("offside.ai", pitchX, H - 14);
  ctx.textAlign = "right";
  ctx.fillText("Created with Perplexity Computer", W - pitchX, H - 14);

  // Save PNG
  const pngPath = path.join(outputDir, "verdict.png");
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(pngPath, buffer);
  return pngPath;
}

export async function generateShareGIF(
  jobId: string,
  verdict: "OFFSIDE" | "ONSIDE" | "UNCERTAIN",
  confidence: "LOW" | "MEDIUM" | "HIGH",
  players: PlayerDetection[],
  ball: BallDetection | null,
  offsideLineX: number,
  passFrame: number,
  totalFrames: number,
  outputDir: string
): Promise<string> {
  // Generate a WebM/GIF by creating multiple PNG frames and concatenating
  // For simplicity + performance, we generate a series of canvas frames and save as animated sequence
  // Return path to animated PNG sequence packaged as a GIF placeholder
  
  // Generate 15 frames of animation
  const gifPath = path.join(outputDir, "animation.gif");
  
  // For the deployed demo, we create a multi-frame animation using canvas
  // In production with full YOLOv8, this would use real frame data
  const GIF_FRAMES = 20;
  const W = 600;
  const H = 380;
  
  // We'll use node-canvas to generate frames and then use ffmpeg to stitch them
  const framesDir = path.join(outputDir, "gif_frames");
  fs.mkdirSync(framesDir, { recursive: true });

  for (let f = 0; f < GIF_FRAMES; f++) {
    const t = f / (GIF_FRAMES - 1);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Dark bg
    ctx.fillStyle = "#0f1a14";
    ctx.fillRect(0, 0, W, H);

    // Pitch
    const px = 30;
    const py = 40;
    const pw = W - 60;
    const ph = H - 110;

    ctx.fillStyle = "#1a4a2e";
    ctx.roundRect(px, py, pw, ph, 4);
    ctx.fill();

    // Stripes
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 4);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.fillRect(px + (i * pw) / 8, py, pw / 8, ph);
      }
    }
    ctx.restore();

    // Pitch border and lines
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    ctx.beginPath();
    ctx.moveTo(px + pw / 2, py);
    ctx.lineTo(px + pw / 2, py + ph);
    ctx.stroke();

    // Offside line (appears at t = 0.5)
    const olOpacity = Math.min(1, Math.max(0, (t - 0.3) * 3));
    if (olOpacity > 0) {
      const olX = px + offsideLineX * pw;
      ctx.strokeStyle = `rgba(239,68,68,${olOpacity})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(olX, py);
      ctx.lineTo(olX, py + ph);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Animate players — move from initial to pass moment positions
    const animT = Math.min(t * 1.5, 1);
    for (const p of players) {
      const ppx = px + (p.x - (p.isPasser ? 0.02 * (1 - animT) : 0)) * pw;
      const ppy = py + p.y * ph;

      if (p.isAttacking || p.isSecondLastDefender) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.team === "attacking" ? TEAM_A_COLOR : TEAM_B_COLOR;
      }

      ctx.beginPath();
      ctx.arc(ppx, ppy, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.team === "attacking" ? TEAM_A_COLOR : TEAM_B_COLOR;
      ctx.fill();
      ctx.strokeStyle = p.isAttacking || p.isSecondLastDefender ? "#fff" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = p.isAttacking || p.isSecondLastDefender ? 1.5 : 0.8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Ball
    if (ball) {
      const bAllT = Math.min(t * 2, 1);
      const bx = px + (ball.x - 0.15 * (1 - bAllT)) * pw;
      const by = py + (ball.y + Math.sin(bAllT * Math.PI) * 0.04) * ph;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#fff";
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fillStyle = BALL_COLOR;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Verdict flash at end
    if (t > 0.75) {
      const vAlpha = Math.min(1, (t - 0.75) * 4);
      const verdictColors: Record<string, string> = { OFFSIDE: "#ef4444", ONSIDE: "#22c55e", UNCERTAIN: "#f59e0b" };
      const vc = verdictColors[verdict];
      ctx.fillStyle = `rgba(0,0,0,${vAlpha * 0.5})`;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = vc;
      ctx.font = `bold ${Math.floor(28 + vAlpha * 8)}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowBlur = 20;
      ctx.shadowColor = vc;
      ctx.fillText(verdict, W / 2, H / 2 + 10);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "13px Arial";
      ctx.fillText(`Confidence: ${confidence}`, W / 2, H / 2 + 32);
    }

    // Brand
    ctx.font = "10px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "left";
    ctx.fillText("offside.ai", px, H - 10);

    const framePath = path.join(framesDir, `frame_${String(f).padStart(3, "0")}.png`);
    fs.writeFileSync(framePath, canvas.toBuffer("image/png"));
  }

  // Use FFmpeg to create GIF from frames
  try {
    execSync(
      `ffmpeg -framerate 10 -i "${framesDir}/frame_%03d.png" -vf "split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gifPath}" -y 2>&1`,
      { timeout: 30000 }
    );
  } catch (_e) {
    // Fallback: try simpler gif generation
    try {
      execSync(
        `ffmpeg -framerate 8 -i "${framesDir}/frame_%03d.png" "${gifPath}" -y 2>&1`,
        { timeout: 20000 }
      );
    } catch (_e2) {
      // If GIF fails, just use first PNG as fallback
      fs.copyFileSync(path.join(framesDir, "frame_000.png"), gifPath);
    }
  }

  return gifPath;
}
