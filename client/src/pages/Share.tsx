import { lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Analysis, PlayerDetection, BallDetection } from "@shared/schema";

const PitchAnimation = lazy(() => import("@/components/PitchAnimation"));

export default function Share() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [, setLocation] = useLocation();

  const { data: analysis, isLoading, error } = useQuery<Analysis>({
    queryKey: ["/api/share", token],
    queryFn: async () => {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Share link not found.");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  let players: PlayerDetection[] = [];
  let ball: BallDetection | null = null;
  if (analysis?.playersJson) { try { players = JSON.parse(analysis.playersJson); } catch (_e) {} }
  if (analysis?.ballJson) { try { ball = JSON.parse(analysis.ballJson); } catch (_e) {} }

  const isExpired = analysis && analysis.shareExpiresAt && analysis.shareExpiresAt < Math.floor(Date.now() / 1000);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !analysis || isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted border border-border flex items-center justify-center">
          <Clock className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">Link expired or not found</h2>
        <p className="text-muted-foreground text-sm mb-6">Share links expire after 24 hours.</p>
        <Button onClick={() => setLocation("/")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Analyse a new clip
        </Button>
      </div>
    );
  }

  const verdict = analysis.verdict as "OFFSIDE" | "ONSIDE" | "UNCERTAIN";
  const verdictColorClass = verdict === "OFFSIDE" ? "text-red-500" : verdict === "ONSIDE" ? "text-green-500" : "text-yellow-500";

  return (
    <div className="min-h-screen flex flex-col" data-testid="share-page">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Offside AI logo">
            <rect width="32" height="32" rx="8" fill="hsl(183 90% 42%)"/>
            <rect x="6" y="14" width="20" height="4" rx="1" fill="hsl(155 30% 5%)" opacity="0.9"/>
            <circle cx="10" cy="16" r="3.5" fill="hsl(155 30% 5%)"/>
            <circle cx="22" cy="16" r="3.5" fill="hsl(155 30% 5%)"/>
            <rect x="14" y="6" width="2" height="20" rx="1" fill="hsl(155 30% 5%)" opacity="0.6"/>
          </svg>
          <span className="font-bold text-base" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Offside <span className="text-primary">AI</span>
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="gap-2 text-muted-foreground">
          Analyse your own clip
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <h1 className={`text-4xl font-extrabold mb-1 ${verdictColorClass}`} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {verdict}
          </h1>
          <p className="text-muted-foreground text-sm">
            Confidence: <span className="text-foreground font-medium">{analysis.confidence}</span>
          </p>
        </div>

        <div className="rounded-xl overflow-hidden border border-border/50 mb-6">
          <Suspense fallback={
            <div className="w-full h-80 flex items-center justify-center animate-shimmer">
              <span className="text-sm text-muted-foreground">Loading 3D scene…</span>
            </div>
          }>
            <PitchAnimation
              players={players}
              ball={ball}
              offsideLineX={analysis.offsideLineX ?? 0.65}
              verdict={verdict}
              isAnimating={true}
            />
          </Suspense>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Shared via <span className="text-primary font-medium">Offside AI</span> · Synthetic reconstruction — no original footage
        </p>
      </main>

      <footer className="py-4 px-6 border-t border-border/30 text-center text-xs text-muted-foreground">
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}
