import { useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Upload, Film, Zap, Share2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const MAX_SIZE_MB = 50;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v", "video/avi", "video/webm"];
const ALLOWED_EXTS = [".mp4", ".mov", ".m4v", ".avi", ".webm"];

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return "Only MP4, MOV, AVI and WebM files are supported.";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Max ${MAX_SIZE_MB}MB allowed.`;
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", selectedFile);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setLocation(`/result/${data.jobId}`);
    } catch (e: any) {
      setError(e.message || "Upload failed. Please try again.");
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="home-page">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          {/* SVG Logo */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Offside AI logo" className="flex-shrink-0">
            <rect width="32" height="32" rx="8" fill="hsl(183 90% 42%)"/>
            <rect x="6" y="14" width="20" height="4" rx="1" fill="hsl(155 30% 5%)" opacity="0.9"/>
            <circle cx="10" cy="16" r="3.5" fill="hsl(155 30% 5%)"/>
            <circle cx="22" cy="16" r="3.5" fill="hsl(155 30% 5%)"/>
            <rect x="14" y="6" width="2" height="20" rx="1" fill="hsl(155 30% 5%)" opacity="0.6"/>
          </svg>
          <span className="font-bold text-lg tracking-tight text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Offside <span className="text-primary">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Beta
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          {/* Hero copy */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight mb-3 text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Was it offside?
            </h1>
            <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
              Upload a 3–10 second football clip. Get an instant AI verdict with a shareable 3D animation.
            </p>
          </div>

          {/* Upload Zone */}
          <div
            className={`drop-zone rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer mb-6 min-h-52 ${dragOver ? "drag-over" : ""} ${selectedFile ? "border-primary/50" : ""}`}
            style={{ background: "hsl(155 25% 7%)" }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            data-testid="drop-zone"
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/avi,video/webm,.mp4,.mov,.avi,.webm"
              className="hidden"
              onChange={handleInputChange}
              data-testid="file-input"
            />

            {selectedFile ? (
              <>
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Film className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground text-sm truncate max-w-xs">{selectedFile.name}</p>
                  <p className="text-muted-foreground text-xs mt-1">{formatSize(selectedFile.size)}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Ready to analyse
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-xl bg-border/50 border border-border flex items-center justify-center">
                  <Upload className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground text-sm">Drop your clip here</p>
                  <p className="text-muted-foreground text-xs mt-1">or click to browse</p>
                </div>
                <p className="text-muted-foreground text-xs">MP4 / MOV · Max 50MB · 3–10 seconds</p>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4" data-testid="error-message">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Upload Button */}
          <Button
            size="lg"
            className="w-full font-bold text-sm h-12 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
            data-testid="analyse-button"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Uploading…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Analyse Clip
              </span>
            )}
          </Button>

          {/* How it works */}
          <div className="mt-12 grid grid-cols-3 gap-4" data-testid="how-it-works">
            {[
              { icon: Upload, label: "Upload", desc: "Drop any 3–10s football clip" },
              { icon: Zap, label: "Analyse", desc: "AI detects players, pitch, and pass moment" },
              { icon: Share2, label: "Share", desc: "Get a verdict + 3D animation to post" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2 p-4 rounded-lg" style={{ background: "hsl(155 25% 7%)" }}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-1">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>No original footage stored. Synthetic reconstruction only.</span>
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}
