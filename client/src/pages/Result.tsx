import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2, Download, Twitter, MessageCircle, Copy, RefreshCw, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Analysis, PlayerDetection, BallDetection } from "@shared/schema";

const PitchAnimation = lazy(() => import("@/components/PitchAnimation"));

const PROCESSING_STEPS = [
  { id: "frames", label: "Extracting frames", desc: "Breaking clip into frame sequence" },
  { id: "detection", label: "Detecting players & ball", desc: "Running object detection" },
  { id: "pitch", label: "Mapping pitch geometry", desc: "Computing top-down projection" },
  { id: "pass", label: "Finding pass moment", desc: "Detecting ball velocity spike" },
  { id: "offside", label: "Applying offside rule", desc: "Comparing player positions" },
  { id: "render", label: "Generating animation", desc: "Rendering 3D reconstruction" },
];

function ProcessingView({ jobId }: { jobId: string }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx(prev => Math.min(prev + 1, PROCESSING_STEPS.length - 1));
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" data-testid="processing-view">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Analysing clip…
          </h2>
          <p className="text-sm text-muted-foreground">Usually takes under 10 seconds</p>
        </div>

        <div className="space-y-2">
          {PROCESSING_STEPS.map((step, i) => {
            const isDone = i < stepIdx;
            const isActive = i === stepIdx;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isActive ? "bg-primary/10 border border-primary/20" :
                  isDone ? "opacity-60" : "opacity-30"
                }`}
                data-testid={`step-${step.id}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isDone ? "bg-primary/20 text-primary" :
                  isActive ? "border-2 border-primary" : "border border-border"
                }`}>
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-primary" />
                  ) : isActive ? (
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {step.label}
                  </p>
                  {isActive && <p className="text-xs text-muted-foreground">{step.desc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "OFFSIDE") return <AlertCircle className="w-8 h-8" />;
  if (verdict === "ONSIDE") return <CheckCircle className="w-8 h-8" />;
  return <HelpCircle className="w-8 h-8" />;
}

function VerdictColor(verdict: string): string {
  if (verdict === "OFFSIDE") return "text-red-500";
  if (verdict === "ONSIDE") return "text-green-500";
  return "text-yellow-500";
}

function VerdictBgColor(verdict: string): string {
  if (verdict === "OFFSIDE") return "bg-red-500/10 border-red-500/30";
  if (verdict === "ONSIDE") return "bg-green-500/10 border-green-500/30";
  return "bg-yellow-500/10 border-yellow-500/30";
}

function ConfidencePips({ confidence }: { confidence: string }) {
  const levels = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  const count = levels[confidence as keyof typeof levels] || 1;
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map(n => (
        <div key={n} className={`w-2 h-2 rounded-full ${n <= count ? "bg-primary" : "bg-border"}`} />
      ))}
    </div>
  );
}

export default function Result() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"animation" | "snapshot">("animation");

  const { data: analysis, isLoading } = useQuery<Analysis>({
    queryKey: ["/api/status", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/status/${jobId}`);
      if (!res.ok) throw new Error("Job not found");
      return res.json();
    },
    refetchInterval: (data: Analysis | undefined) => {
      if (!data) return 2000;
      if (data.status === "processing" || data.status === "pending") return 2000;
      return false;
    },
    enabled: !!jobId,
  });

  const isProcessing = !analysis || analysis.status === "processing" || analysis.status === "pending";
  const isFailed = analysis?.status === "failed";
  const isComplete = analysis?.status === "complete";

  let players: PlayerDetection[] = [];
  let ball: BallDetection | null = null;
  if (analysis?.playersJson) {
    try { players = JSON.parse(analysis.playersJson); } catch (_e) {}
  }
  if (analysis?.ballJson) {
    try { ball = JSON.parse(analysis.ballJson); } catch (_e) {}
  }

  const shareUrl = analysis?.shareToken ? `${window.location.origin}/#/share/${analysis.shareToken}` : null;

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share link copied to clipboard." });
    } catch (_e) {
      toast({ title: "Copy failed", description: shareUrl });
    }
  };

  const shareToTwitter = () => {
    const text = `${analysis?.verdict === "OFFSIDE" ? "🚩 OFFSIDE!" : analysis?.verdict === "ONSIDE" ? "✅ ONSIDE!" : "⚠️ UNCERTAIN"} — Checked with Offside AI`;
    const url = shareUrl || window.location.href;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
  };

  const shareToWhatsApp = () => {
    const text = `${analysis?.verdict} — ${shareUrl || window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const downloadPNG = () => {
    const a = document.createElement("a");
    a.href = `/api/output/${jobId}/png`;
    a.download = `offside_verdict.png`;
    a.click();
  };

  const downloadGIF = () => {
    const a = document.createElement("a");
    a.href = `/api/output/${jobId}/gif`;
    a.download = `offside_animation.gif`;
    a.click();
  };

  if (isProcessing) return <ProcessingView jobId={jobId} />;

  if (isFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Processing failed</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {analysis?.errorMessage || "We couldn't process this clip. Try a shorter, clearer recording."}
          </p>
          <Button onClick={() => setLocation("/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Try Another Clip
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis || !isComplete) return <ProcessingView jobId={jobId} />;

  const verdict = analysis.verdict as "OFFSIDE" | "ONSIDE" | "UNCERTAIN";
  const confidence = analysis.confidence as "LOW" | "MEDIUM" | "HIGH";

  return (
    <div className="min-h-screen flex flex-col" data-testid="result-page">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          New clip
        </Button>
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
        <div className="w-20" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        {/* Verdict Card */}
        <div className={`flex flex-col items-center text-center p-6 rounded-xl border mb-8 animate-fade-up ${VerdictBgColor(verdict)}`} data-testid="verdict-card">
          <div className={`${VerdictColor(verdict)} mb-2`}>
            <VerdictIcon verdict={verdict} />
          </div>
          <h1 className={`text-4xl font-extrabold tracking-tight mb-2 ${VerdictColor(verdict)}`} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="verdict-text">
            {verdict}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <ConfidencePips confidence={confidence} />
            <span className="text-sm font-medium text-foreground">{confidence}</span>
          </div>
          {analysis.passFrame && analysis.totalFrames && (
            <p className="text-xs text-muted-foreground mt-2">
              Pass moment detected at frame {analysis.passFrame} of {analysis.totalFrames}
            </p>
          )}
        </div>

        {/* Tabs: 3D Animation vs Snapshot */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "hsl(155 25% 8%)" }}>
          {(["animation", "snapshot"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab === "animation" ? "3D Animation" : "Snapshot"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-xl overflow-hidden border border-border/50 mb-8" data-testid="visualisation">
          {activeTab === "animation" ? (
            <Suspense fallback={
              <div className="w-full h-96 flex items-center justify-center animate-shimmer">
                <span className="text-muted-foreground text-sm">Loading 3D scene…</span>
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
          ) : (
            <div className="w-full">
              <img
                src={`/api/output/${jobId}/png-inline`}
                alt={`Offside verdict: ${verdict}`}
                className="w-full"
                crossOrigin="anonymous"
                data-testid="verdict-png"
              />
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-8 justify-center">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-400" /> Attacking</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500" /> Defending</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white/80" /> Ball</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0 border-t-2 border-dashed" style={{ borderColor: verdict === "OFFSIDE" ? "#ef4444" : verdict === "ONSIDE" ? "#22c55e" : "#f59e0b" }} />
            Offside line
          </div>
        </div>

        {/* Share Section */}
        <div className="p-5 rounded-xl border border-border/50" style={{ background: "hsl(155 25% 7%)" }} data-testid="share-section">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Share the verdict
          </h3>

          {/* Share link */}
          {shareUrl && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground truncate">
                {shareUrl}
              </div>
              <Button size="sm" variant="secondary" onClick={copyShareLink} className="gap-1.5 flex-shrink-0" data-testid="copy-link-btn">
                <Copy className="w-3.5 h-3.5" />
                Copy
              </Button>
            </div>
          )}

          {shareUrl && analysis.shareExpiresAt && (
            <p className="text-xs text-muted-foreground mb-4">
              Link expires in 24 hours
            </p>
          )}

          {/* Social share buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button
              variant="secondary"
              size="sm"
              className="share-btn gap-2"
              onClick={shareToTwitter}
              data-testid="share-twitter"
            >
              <Twitter className="w-4 h-4" />
              Post to X
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="share-btn gap-2"
              onClick={shareToWhatsApp}
              data-testid="share-whatsapp"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
          </div>

          {/* Download buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={downloadPNG}
              data-testid="download-png"
            >
              <Download className="w-3.5 h-3.5" />
              PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={downloadGIF}
              data-testid="download-gif"
            >
              <Download className="w-3.5 h-3.5" />
              GIF / Animation
            </Button>
          </div>
        </div>
      </main>

      <footer className="py-4 px-6 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>No original footage displayed. Synthetic reconstruction only.</span>
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}
