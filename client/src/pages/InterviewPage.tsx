import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveSession } from "@/hooks/useLiveSession";
import { api } from "@/lib/api";
import type { InterviewSession } from "@/lib/types";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);

  const {
    status,
    transcript,
    error,
    isMuted,
    toggleMute,
    endSession,
    elapsedMs,
  } = useLiveSession(id!);

  // Fetch session info for persona display
  useEffect(() => {
    api.getSession(id!).then((s) => setSession(s as InterviewSession));
  }, [id]);

  // Auto-navigate to results on completion
  useEffect(() => {
    if (status === "COMPLETED") {
      const timeout = setTimeout(() => navigate(`/results/${id}`), 2000);
      return () => clearTimeout(timeout);
    }
  }, [status, id, navigate]);

  // Auto-scroll transcript
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Parse persona config for display
  const persona = session
    ? (() => {
        try {
          return JSON.parse(session.personaConfig) as {
            name: string;
            difficulty: string;
            avatar: { emoji: string; gradient: string };
          };
        } catch {
          return null;
        }
      })()
    : null;

  // Connecting state
  if (status === "CREATED") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-24">
        <Loader2 className="h-12 w-12 animate-spin text-quaternary" />
        <h1 className="text-xl font-semibold text-foreground">
          Connecting to your interviewer...
        </h1>
        <p className="text-sm text-muted-foreground">
          Setting up {persona?.name ?? "AI"} — this may take a few seconds
        </p>
      </div>
    );
  }

  // Error state
  if (status === "ERROR") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Connection Error
        </h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "Something went wrong with the interview session."}
        </p>
        <Link to="/">
          <Button variant="outline">Back to Setup</Button>
        </Link>
      </div>
    );
  }

  // Completed state
  if (status === "COMPLETED") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-quaternary/20">
          <span className="text-3xl">✓</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Interview Complete
        </h1>
        <p className="text-sm text-muted-foreground">
          Redirecting to results...
        </p>
      </div>
    );
  }

  // Live interview UI
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          {persona && (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${persona.avatar.gradient}`}
            >
              <span className="text-lg">{persona.avatar.emoji}</span>
            </div>
          )}
          <div>
            <h2 className="font-semibold text-foreground">
              {persona?.name ?? "AI Interviewer"}
            </h2>
            <p className="text-xs text-muted-foreground capitalize">
              {persona?.difficulty ?? ""} difficulty
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-lg text-foreground">
            {formatTime(elapsedMs)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Transcript feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {transcript.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Waiting for the interviewer to begin...
          </p>
        )}
        {transcript.map((entry, i) => (
          <div
            key={i}
            className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                entry.role === "user"
                  ? "bg-quaternary text-primary"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {entry.text}
            </div>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between border-t border-border px-4 py-4">
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="lg"
          onClick={toggleMute}
          className="gap-2"
        >
          {isMuted ? (
            <>
              <MicOff className="h-5 w-5" /> Unmute
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" /> Mute
            </>
          )}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={endSession}
          className="gap-2"
        >
          <PhoneOff className="h-5 w-5" /> End Interview
        </Button>
      </div>
    </div>
  );
}
