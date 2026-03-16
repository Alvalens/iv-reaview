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
    Sparkles,
    CheckCircle2,
    AlertCircle,
    BarChart3,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type {
    InterviewSession,
    ScoringResult,
    TranscriptEntry,
    PersonaConfig,
} from "@/lib/types";

// --- Score Ring Component ---
function ScoreRing({
    score,
    label,
    size = 96,
    isMain = false,
}: {
    score: number;
    label: string;
    size?: number;
    isMain?: boolean;
}) {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 10) * circumference;

    const getScoreColor = (s: number) => {
        if (s >= 7) return { text: "text-[#22C55E]", stroke: "stroke-[#22C55E]" };
        if (s >= 5) return { text: "text-[#F59E0B]", stroke: "stroke-[#F59E0B]" };
        return { text: "text-[#EF4444]", stroke: "stroke-[#EF4444]" };
    };

    const colors = getScoreColor(score);

    return (
        <div className={`flex flex-col items-center gap-3 ${isMain ? "relative" : ""}`}>
            {isMain && (
                <div className="absolute -inset-4 bg-gradient-to-br from-[#1FB6FF]/10 to-transparent rounded-full blur-2xl" />
            )}
            <div className={`relative ${isMain ? "scale-110" : ""}`} style={{ width: size, height: size }}>
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
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="8"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        className={colors.stroke}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - progress}
                        style={{
                            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`${isMain ? "text-3xl" : "text-2xl"} font-bold ${colors.text}`}>
                        {score.toFixed(1)}
                    </span>
                    {isMain && <span className="text-[10px] text-[#64748B] mt-0.5">/ 10</span>}
                </div>
            </div>
            <span className={`${isMain ? "text-sm font-semibold" : "text-xs"} text-[#94A3B8]`}>
                {label}
            </span>
        </div>
    );
}

// --- Score Bar Component ---
function ScoreBar({ score, label }: { score: number; label: string }) {
    const percentage = (score / 10) * 100;
    const getBarColor = (s: number) => {
        if (s >= 7) return "bg-[#22C55E]";
        if (s >= 5) return "bg-[#F59E0B]";
        return "bg-[#EF4444]";
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">{label}</span>
                <span className="text-sm font-semibold text-[#F1F5F9]">{score.toFixed(1)} / 10</span>
            </div>
            <div className="h-2 rounded-full bg-[#0A1F33] overflow-hidden">
                <div
                    className={`h-full rounded-full ${getBarColor(score)}`}
                    style={{
                        width: `${percentage}%`,
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                />
            </div>
        </div>
    );
}

// --- Question Card Component ---
function SectionDivider() {
    return (
        <div className="my-5">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1FB6FF]/30 to-transparent" />
        </div>
    );
}


function QuestionCard({
    q,
    index,
}: {
    q: ScoringResult["questions"][number];
    index: number;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-[#1E3A5F] bg-[#0F2A44] overflow-hidden transition-all duration-300 hover:border-[#1FB6FF]/30">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#0A1F33]/50 transition-colors"
            >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1FB6FF]/10 border border-[#1FB6FF]/20">
                        <span className="text-sm font-semibold text-[#1FB6FF]">{index + 1}</span>
                    </div>
                    <span className="text-sm font-medium text-[#F1F5F9] truncate">{q.question}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="flex items-center gap-2 bg-[#0A1F33] px-3 py-1.5 rounded-lg">
                        <BarChart3 className="h-3.5 w-3.5 text-[#1FB6FF]" />
                        <span className="text-sm font-semibold text-[#1FB6FF]">{q.contentScore.toFixed(1)}</span>
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-5 w-5 text-[#64748B]" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-[#64748B]" />
                    )}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-[#1E3A5F] bg-[#0A1F33]/30">
                    <div className="px-5 py-5 space-y-5">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-[#94A3B8]" />
                                <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Your Answer</p>
                            </div>
                            <p className="text-sm text-[#F1F5F9]/80 leading-relaxed pl-5 border-l-2 border-[#1FB6FF]/20">{q.answer}</p>
                        </div>

                        <SectionDivider />

                        <div className="rounded-lg bg-[#0F2A44] p-4 space-y-3">
                            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Score Breakdown</p>
                            <div className={`grid gap-4 ${q.nonVerbalScore !== null ? "grid-cols-3" : "grid-cols-2"}`}>
                                <ScoreBar score={q.contentScore} label="Content" />
                                <ScoreBar score={q.deliveryScore} label="Delivery" />
                                {q.nonVerbalScore !== null && <ScoreBar score={q.nonVerbalScore} label="Non-Verbal" />}
                            </div>
                        </div>

                        {(q.feedback || q.deliveryFeedback || q.nonVerbalFeedback || q.speechMetrics) && <SectionDivider />}

                        {q.feedback && (
                            <>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-[#1FB6FF]" />
                                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">AI Feedback</p>
                                    </div>
                                    <p className="text-sm text-[#F1F5F9]/80 leading-relaxed pl-5">{q.feedback}</p>
                                </div>
                                {(q.deliveryFeedback || q.nonVerbalFeedback || q.speechMetrics) && <SectionDivider />}
                            </>
                        )}

                        {q.deliveryFeedback && (
                            <>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Mic className="h-3.5 w-3.5 text-[#94A3B8]" />
                                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Delivery Analysis</p>
                                    </div>
                                    <p className="text-sm text-[#F1F5F9]/80 leading-relaxed pl-5">{q.deliveryFeedback}</p>
                                </div>
                                {(q.nonVerbalFeedback || q.speechMetrics) && <SectionDivider />}
                            </>
                        )}

                        {q.nonVerbalFeedback && (
                            <>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Eye className="h-3.5 w-3.5 text-[#94A3B8]" />
                                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Body Language</p>
                                    </div>
                                    <p className="text-sm text-[#F1F5F9]/80 leading-relaxed pl-5">{q.nonVerbalFeedback}</p>
                                </div>
                                {q.speechMetrics && <SectionDivider />}
                            </>
                        )}

                        {q.speechMetrics && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5 text-[#94A3B8]" />
                                    <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Speech Metrics</p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex items-center gap-2 bg-[#0F2A44] border border-[#1E3A5F] rounded-lg px-3 py-2">
                                        <span className="text-xs text-[#94A3B8]">Speed:</span>
                                        <span className="text-sm font-semibold text-[#F1F5F9]">{q.speechMetrics.wordsPerMinute} wpm</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-[#0F2A44] border border-[#1E3A5F] rounded-lg px-3 py-2">
                                        <span className="text-xs text-[#94A3B8]">Fillers:</span>
                                        <span className="text-sm font-semibold text-[#F1F5F9]">{q.speechMetrics.fillerCount}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-[#0F2A44] border border-[#1E3A5F] rounded-lg px-3 py-2">
                                        <span className="text-xs text-[#94A3B8]">Pauses:</span>
                                        <span className="text-sm font-semibold text-[#F1F5F9]">{q.speechMetrics.pauseCount}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
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

                if (s.status === "SCORED" || s.status === "COMPLETED" || s.status === "SCORING") {
                    const result = await api.scoreSession(id!);
                    if (cancelled) return;
                    setScores(result);
                    setLoading(false);
                    return;
                }

                setError(`Session is in ${s.status} state`);
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load results");
                    setLoading(false);
                }
            }
        }

        loadAndScore();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const persona: PersonaConfig | null = session
        ? (() => {
            try {
                return JSON.parse(session.personaConfig);
            } catch {
                return null;
            }
        })()
        : null;

    const transcript: TranscriptEntry[] = session?.transcript
        ? (() => {
            try {
                return JSON.parse(session.transcript);
            } catch {
                return [];
            }
        })()
        : [];

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-[#001427] flex flex-col items-center justify-center space-y-6 px-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#1FB6FF]/20 to-[#22C55E]/20 rounded-full blur-2xl" />
                    <Loader2 className="h-16 w-16 animate-spin text-[#1FB6FF] relative" />
                </div>
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-[#F1F5F9]">
                        Analyzing Your Interview
                    </h1>
                    <p className="text-sm text-[#94A3B8] max-w-md">
                        Our AI is carefully evaluating your responses, delivery, and body language. This usually takes 10-20 seconds.
                    </p>
                </div>
            </div>
        );
    }

    // Error State
    if (error || !scores) {
        return (
            <div className="min-h-screen bg-[#001427] flex flex-col items-center justify-center space-y-6 px-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EF4444]/10 border-2 border-[#EF4444]/20">
                    <AlertCircle className="h-10 w-10 text-[#EF4444]" />
                </div>
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-[#F1F5F9]">
                        Unable to Load Results
                    </h1>
                    <p className="text-sm text-[#94A3B8] max-w-md">
                        {error ?? "We couldn't generate your interview scores. Please try again."}
                    </p>
                </div>
                <Link to="/">
                    <Button
                        variant="outline"
                        className="bg-transparent border-[#1E3A5F] text-[#F1F5F9] hover:bg-[#0F2A44] hover:border-[#1FB6FF]/50"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Setup
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#001427] py-8 px-4">
            <div className="mx-auto max-w-4xl space-y-8">
                {/* Premium Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        {persona && (
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-br from-[#1FB6FF]/30 to-[#22C55E]/30 rounded-full blur-md group-hover:blur-lg transition-all" />
                                <div
                                    className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${persona.avatar.gradient} shadow-lg`}
                                >
                                    {persona.avatar?.icon ? (
                                        (() => {
                                            const Icon = persona.avatar.icon as React.ComponentType<{ className?: string }>;
                                            return Icon ? <Icon className="h-10 w-10 text-white" /> : null;
                                        })()
                                    ) : (
                                        <User className="h-7 w-7 text-white" />
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-[#F1F5F9]">
                                    Interview Results
                                </h1>
                                <div className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
                            </div>
                            <p className="text-sm text-[#94A3B8]">
                                <span className="font-medium text-[#F1F5F9]">{session?.jobTitle}</span>
                                {" at "}
                                <span className="font-medium text-[#F1F5F9]">{session?.companyName}</span>
                            </p>
                            {persona && (
                                <p className="text-xs text-[#64748B]">
                                    Interviewed by {persona.name}
                                </p>
                            )}
                        </div>
                    </div>
                    <Link to="/">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-[#1E3A5F] text-[#94A3B8] hover:bg-[#0F2A44] hover:border-[#1FB6FF]/50 hover:text-[#F1F5F9] transition-all"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            New Interview
                        </Button>
                    </Link>
                </div>

                {/* Overall Performance Card */}
                <div className="rounded-2xl border border-[#1E3A5F] bg-gradient-to-b from-[#0F2A44] to-[#0A1F33] p-8 shadow-2xl">
                    <div className="text-center mb-6">
                        <h2 className="text-lg font-semibold text-[#F1F5F9] mb-1">Overall Performance</h2>
                        <p className="text-sm text-[#94A3B8]">AI-powered analysis across all dimensions</p>
                    </div>
                    <div className="flex items-center justify-center gap-12 flex-wrap">
                        <ScoreRing score={scores.overallScore} label="Overall Score" size={128} isMain />
                        <div className="flex gap-8">
                            <ScoreRing score={scores.contentScore} label="Content" />
                            <ScoreRing score={scores.deliveryScore} label="Delivery" />
                            {scores.nonVerbalScore !== null && (
                                <ScoreRing score={scores.nonVerbalScore} label="Non-Verbal" />
                            )}
                        </div>
                    </div>
                </div>

                {/* AI Summary Card */}
                <div className="rounded-2xl border border-[#1E3A5F] bg-[#0F2A44] p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1FB6FF] to-[#0EA5E9]">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <h2 className="text-lg font-semibold text-[#F1F5F9]">AI Summary</h2>
                    </div>
                    <p className="text-sm text-[#F1F5F9]/90 leading-relaxed whitespace-pre-line">
                        {scores.narrative}
                    </p>
                </div>

                {/* Strengths & Improvements Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div className="rounded-2xl border border-[#1E3A5F] bg-[#0F2A44] p-6 shadow-xl">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22C55E]/10">
                                <TrendingUp className="h-4 w-4 text-[#22C55E]" />
                            </div>
                            <h2 className="text-lg font-semibold text-[#F1F5F9]">Strengths</h2>
                        </div>
                        <ul className="space-y-3">
                            {scores.strengths.map((s, i) => (
                                <li key={i} className="flex gap-3 group">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/10 mt-0.5">
                                        <CheckCircle2 className="h-3 w-3 text-[#22C55E]" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-[#F1F5F9]">{s.description}</p>
                                        <span className="inline-block mt-1 text-[10px] font-medium text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                            {s.category}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Areas to Improve */}
                    <div className="rounded-2xl border border-[#1E3A5F] bg-[#0F2A44] p-6 shadow-xl">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B]/10">
                                <TrendingDown className="h-4 w-4 text-[#F59E0B]" />
                            </div>
                            <h2 className="text-lg font-semibold text-[#F1F5F9]">Areas to Improve</h2>
                        </div>
                        <ul className="space-y-3">
                            {scores.weaknesses.map((w, i) => (
                                <li key={i} className="flex gap-3 group">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F59E0B]/10 mt-0.5">
                                        <AlertCircle className="h-3 w-3 text-[#F59E0B]" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-[#F1F5F9]">{w.description}</p>
                                        <span
                                            className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${w.priority === "high"
                                                ? "bg-[#EF4444]/20 text-[#EF4444]"
                                                : w.priority === "medium"
                                                    ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                                                    : "bg-[#64748B]/20 text-[#64748B]"
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

                {/* Question-by-Question Analysis */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1FB6FF]/10">
                            <Target className="h-4 w-4 text-[#1FB6FF]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[#F1F5F9]">
                                Question-by-Question Analysis
                            </h2>
                            <p className="text-xs text-[#64748B]">{scores.questions.length} questions analyzed</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {scores.questions.map((q, i) => (
                            <QuestionCard key={i} q={q} index={i} />
                        ))}
                    </div>
                </div>

                {/* Full Transcript */}
                {transcript.length > 0 && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowTranscript(!showTranscript)}
                            className="flex items-center gap-2 text-sm text-[#1FB6FF] hover:text-[#1FB6FF]/80 transition-colors group"
                        >
                            {showTranscript ? (
                                <ChevronUp className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                            ) : (
                                <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                            )}
                            <span className="font-medium">
                                {showTranscript ? "Hide" : "View"} Full Transcript
                            </span>
                            <span className="text-[#64748B]">({transcript.length} messages)</span>
                        </button>

                        {showTranscript && (
                            <div className="rounded-2xl border border-[#1E3A5F] bg-[#0F2A44] p-5 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {transcript.map((entry, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[75%] rounded-xl px-4 py-2.5 ${entry.role === "user"
                                                ? "bg-[#1FB6FF]/10 border border-[#1FB6FF]/20 text-[#F1F5F9]"
                                                : "bg-[#0A1F33] border border-[#1E3A5F] text-[#F1F5F9]/90"
                                                }`}
                                        >
                                            <p className="text-sm leading-relaxed">{entry.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* CTA Section */}
                <div className="flex justify-center pt-6">
                    <Link to="/">
                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-[#1FB6FF] to-[#0EA5E9] hover:from-[#0EA5E9] hover:to-[#1FB6FF] text-white font-semibold px-8 py-6 rounded-xl shadow-lg shadow-[#1FB6FF]/30 transition-all duration-300 hover:shadow-[#1FB6FF]/50 hover:scale-105"
                        >
                            <ArrowLeft className="h-5 w-5 mr-2" />
                            Practice Another Interview
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}