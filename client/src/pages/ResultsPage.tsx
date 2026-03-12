import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Target,
  Mic,
  Eye,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type {
  InterviewSession,
  ScoringResult,
  TranscriptEntry,
  PersonaConfig,
} from "@/lib/types";

// --- Score Ring ---
function ScoreRing({
  score,
  label,
  size = 96,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color =
    score >= 7
      ? "text-emerald-400"
      : score >= 5
        ? "text-amber-400"
        : "text-rose-400";
  const strokeColor =
    score >= 7
      ? "stroke-emerald-400"
      : score >= 5
        ? "stroke-amber-400"
        : "stroke-rose-400";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{
              transition: "stroke-dashoffset 1s ease-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// --- Score Bar ---
function ScoreBar({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const percentage = (score / 10) * 100;
  const color =
    score >= 7
      ? "bg-emerald-400"
      : score >= 5
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {score.toFixed(1)}/10
        </span>
      </div>
      <div className="h-2 rounded-full bg-border">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${percentage}%`,
            transition: "width 1s ease-out",
          }}
        />
      </div>
    </div>
  );
}

// --- Question Accordion ---
function QuestionCard({
  q,
  index,
}: {
  q: ScoringResult["questions"][number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-medium text-foreground">
            {index + 1}
          </span>
          <span className="text-sm text-foreground truncate">
            {q.question}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-sm font-medium text-quaternary">
            {q.contentScore.toFixed(1)}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Your Answer
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {q.answer}
            </p>
          </div>

          <div className={`grid gap-3 ${q.nonVerbalScore !== null ? "grid-cols-3" : "grid-cols-2"}`}>
            <ScoreBar score={q.contentScore} label="Content" />
            <ScoreBar score={q.deliveryScore} label="Delivery" />
            {q.nonVerbalScore !== null && (
              <ScoreBar score={q.nonVerbalScore} label="Non-Verbal" />
            )}
          </div>

          {q.feedback && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Feedback
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {q.feedback}
              </p>
            </div>
          )}

          {q.deliveryFeedback && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Mic className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Delivery Feedback
                </p>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {q.deliveryFeedback}
              </p>
            </div>
          )}

          {q.nonVerbalFeedback && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Non-Verbal Feedback
                </p>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {q.nonVerbalFeedback}
              </p>
            </div>
          )}

          {q.speechMetrics && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Speech Metrics
                </p>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="rounded-md bg-secondary px-2.5 py-1.5 text-foreground/80">
                  {q.speechMetrics.wordsPerMinute} wpm
                </span>
                <span className="rounded-md bg-secondary px-2.5 py-1.5 text-foreground/80">
                  {q.speechMetrics.fillerCount} fillers
                </span>
                <span className="rounded-md bg-secondary px-2.5 py-1.5 text-foreground/80">
                  {q.speechMetrics.pauseCount} pauses
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Results Page ---
export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [scores, setScores] = useState<ScoringResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAndScore() {
      try {
        const s = (await api.getSession(id!)) as InterviewSession;
        if (cancelled) return;
        setSession(s);

        // scoreSession handles all states: SCORED (cached), COMPLETED/SCORING (trigger + poll 202)
        if (s.status === "SCORED" || s.status === "COMPLETED" || s.status === "SCORING") {
          const result = await api.scoreSession(id!);
          if (cancelled) return;
          setScores(result);
          setLoading(false);
          return;
        }

        // Other states
        setError(`Session is in ${s.status} state`);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load results"
          );
          setLoading(false);
        }
      }
    }

    loadAndScore();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Parse persona from session
  const persona: PersonaConfig | null = session
    ? (() => {
        try {
          return JSON.parse(session.personaConfig);
        } catch {
          return null;
        }
      })()
    : null;

  // Parse transcript
  const transcript: TranscriptEntry[] = session?.transcript
    ? (() => {
        try {
          return JSON.parse(session.transcript);
        } catch {
          return [];
        }
      })()
    : [];

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-24">
        <Loader2 className="h-12 w-12 animate-spin text-quaternary" />
        <h1 className="text-xl font-semibold text-foreground">
          Analyzing your interview...
        </h1>
        <p className="text-sm text-muted-foreground">
          AI is evaluating your responses — this may take 10-20 seconds
        </p>
      </div>
    );
  }

  // Error state
  if (error || !scores) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Scoring Error
        </h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "Failed to generate scores"}
        </p>
        <Link to="/">
          <Button variant="outline">Back to Setup</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {persona && (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${persona.avatar.gradient}`}
            >
              <span className="text-lg">{persona.avatar.emoji}</span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Interview Results
            </h1>
            <p className="text-sm text-muted-foreground">
              {session?.jobTitle} at {session?.companyName}
              {persona && (
                <span>
                  {" "}
                  — interviewed by {persona.name}
                </span>
              )}
            </p>
          </div>
        </div>
        <Link to="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> New Interview
          </Button>
        </Link>
      </div>

      {/* Overall Scores */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center gap-8 sm:gap-12">
          <ScoreRing
            score={scores.overallScore}
            label="Overall"
            size={112}
          />
          <ScoreRing score={scores.contentScore} label="Content" />
          <ScoreRing score={scores.deliveryScore} label="Delivery" />
          {scores.nonVerbalScore !== null && (
            <ScoreRing score={scores.nonVerbalScore} label="Non-Verbal" />
          )}
        </div>
      </div>

      {/* Narrative */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-quaternary" />
          <h2 className="font-semibold text-foreground">Summary</h2>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
          {scores.narrative}
        </p>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-foreground">Strengths</h2>
          </div>
          <ul className="space-y-2">
            {scores.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-emerald-400 shrink-0 mt-0.5">+</span>
                <div>
                  <span className="text-foreground">{s.description}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">
                    ({s.category})
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-foreground">
              Areas to Improve
            </h2>
          </div>
          <ul className="space-y-2">
            {scores.weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-amber-400 shrink-0 mt-0.5">-</span>
                <div>
                  <span className="text-foreground">{w.description}</span>
                  <span
                    className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      w.priority === "high"
                        ? "bg-rose-400/20 text-rose-400"
                        : w.priority === "medium"
                          ? "bg-amber-400/20 text-amber-400"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {w.priority}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Per-Question Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-quaternary" />
          <h2 className="font-semibold text-foreground">
            Question-by-Question ({scores.questions.length})
          </h2>
        </div>
        {scores.questions.map((q, i) => (
          <QuestionCard key={i} q={q} index={i} />
        ))}
      </div>

      {/* Transcript Toggle */}
      {transcript.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-sm text-quaternary hover:text-quaternary/80 transition-colors"
          >
            {showTranscript ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showTranscript ? "Hide" : "Show"} Full Transcript (
            {transcript.length} messages)
          </button>

          {showTranscript && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 max-h-96 overflow-y-auto">
              {transcript.map((entry, i) => (
                <div
                  key={i}
                  className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                      entry.role === "user"
                        ? "bg-quaternary/20 text-foreground"
                        : "bg-secondary text-foreground/80"
                    }`}
                  >
                    {entry.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className="flex justify-center pt-4">
        <Link to="/">
          <Button size="lg" className="gap-2 bg-quaternary text-primary hover:bg-quaternary/90">
            Practice Another Interview
          </Button>
        </Link>
      </div>
    </div>
  );
}
