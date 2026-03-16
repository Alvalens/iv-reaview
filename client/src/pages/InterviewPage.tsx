import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveSession } from "@/hooks/useLiveSession";
import { api } from "@/lib/api";
import type { InterviewSession } from "@/lib/types";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { CameraPreview } from "@/components/CameraPreview";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
        videoStream,
        audioLevel,
        timeWarning,
        dismissWarning,
        timeLoaded,
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
                    interviewStyle: string;
                    avatar: { emoji: string; gradient: string };
                };
            } catch {
                return null;
            }
        })()
        : null;

    // Model is ready once it has spoken at least once
    const modelReady = transcript.some((e) => e.role === "model");
    // Visualizer is active when we're in LIVE status (regardless of transcript)
    const isActive = status === "LIVE";

    // Get the current question from the latest AI transcript
    const currentQuestion = transcript
        .filter((e) => e.role === "model")
        .pop()?.text ?? null;

    // Connecting state
    if (status === "CREATED") {
        return (
            <div className="relative flex h-[calc(100vh-5rem)] flex-col items-center justify-center">
                {/* Full screen dark background */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary" />

                <div className="relative z-10 flex flex-col items-center space-y-6">
                    <div className="relative">
                        <AudioVisualizer audioLevel={0.3} isActive={true} size={160} />
                    </div>
                    <Loader2 className="h-8 w-8 animate-spin text-quaternary" />
                    <h1 className="text-xl font-semibold text-foreground">
                        Connecting to {persona?.name ?? "your interviewer"}...
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Setting up — this may take a few seconds
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (status === "ERROR") {
        return (
            <div className="relative flex h-[calc(100vh-8rem)] flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary" />
                <div className="relative z-10 flex flex-col items-center space-y-6">
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
            </div>
        );
    }

    // Completed state
    if (status === "COMPLETED") {
        return (
            <div className="relative flex h-[calc(100vh-8rem)] flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary" />
                <div className="relative z-10 flex flex-col items-center space-y-6">
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
            </div>
        );
    }

    // Live interview UI - Google Meet style
    return (
        <div className="relative flex h-[calc(100vh-8rem)] flex-col overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/40" />
            {/* Time Warning Dialog */}
            <Dialog open={!!timeWarning} onOpenChange={dismissWarning}>
                <DialogContent className="max-w-md bg-slate-900 text-white border-none">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                            <Loader2 className="h-8 w-8 text-amber-500" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="mb-2 text-xl font-semibold text-white">
                                Interview Time Ending Soon
                            </DialogTitle>
                            <DialogDescription className="mb-6 text-amber-100">
                                Your interview will end in <span className="font-semibold text-amber-500">{timeWarning} seconds</span>.
                                Please wrap up your current answer.
                            </DialogDescription>
                        </DialogHeader>
                        <Button onClick={dismissWarning} className="w-full bg-amber-500 text-white hover:bg-amber-600">
                            Continue Interview
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-black/40 via-black/20 to-black/40 px-6 py-3 backdrop-blur-xl">
                {/* Left: Interview info */}
                <div className="flex items-center gap-4">
                    {persona && (
                        <div
                            className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br shadow-lg ring-2 ring-white/10 ${persona.avatar.gradient}`}
                        >
                            <span className="text-xl">{persona.avatar.emoji}</span>
                        </div>
                    )}
                    <div>
                        <h2 className="text-base font-semibold text-white">
                            {persona?.name ?? "AI Interviewer"}
                        </h2>
                        {/* <p className="text-xs font-medium text-white/50">
              {session?.jobTitle ?? ""} {session?.companyName ? `at ${session.companyName}` : ""}
            </p> */}
                    </div>
                </div>

                {/* Right: Timer + Status */}
                <div className="flex items-center gap-4">
                    {/* Duration pill */}
                    <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
                        <span className="font-mono text-sm font-medium text-white/80">
                            {timeLoaded ? formatTime(elapsedMs) : "--:--"}
                        </span>
                    </div>

                    {/* Live/Setting up indicator */}
                    {modelReady ? (
                        <span className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 ring-1 ring-red-500/20">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                            </span>
                            LIVE
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/20">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            SETTING UP
                        </span>
                    )}
                </div>
            </div>

            {/* Main content area - Interviewer View */}
            <div className="relative z-0 flex flex-1 items-center justify-center p-4 md:p-8">
                {/* Interviewer card */}
                <div className="relative flex flex-col items-center">
                    {/* Avatar container with visualizer */}
                    <div className="relative flex items-center justify-center">
                        {/* Audio visualizer - positioned around avatar */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <AudioVisualizer
                                audioLevel={audioLevel}
                                isActive={isActive}
                                size={280}
                            />
                        </div>

                        {/* Persona avatar - smaller to show visualizer around */}
                        {persona && (
                            <div
                                className={`relative z-10 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br shadow-2xl ${persona.avatar.gradient} md:h-40 md:w-40`}
                            >
                                <span className="text-5xl md:text-6xl">
                                    {persona.avatar.emoji}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Persona name below - without description */}
                    <div className="mt-4 text-center">
                        <h3 className="text-xl font-semibold text-white">
                            {persona?.name ?? "AI Interviewer"}
                        </h3>

                        {/* Current question displayed below avatar */}
                        {currentQuestion && (
                            <div className="mt-4 max-w-3xl rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
                                <p className="text-sm text-white/90">{currentQuestion}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Self-view camera preview (PiP) */}
                <CameraPreview
                    stream={videoStream}
                    isMuted={isMuted}
                    position="bottom-right"
                />
            </div>

            {/* Controls bar */}
            <div className="relative z-10 flex items-center justify-center gap-4 border-t border-white/5 bg-gradient-to-t from-black/60 via-black/40 to-transparent px-6 py-5 backdrop-blur-xl">
                {/* Mute button */}
                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={toggleMute}
                        disabled={!modelReady}
                        className={`group flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isMuted || !modelReady
                            ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25"
                            : "bg-white/10 hover:bg-white/20 shadow-lg shadow-black/20"
                            }`}
                        aria-label={!modelReady ? "Microphone off - waiting for interviewer" : isMuted ? "Unmute microphone" : "Mute microphone"}
                    >
                        {!modelReady ? (
                            <MicOff className="h-7 w-7 text-white" />
                        ) : isMuted ? (
                            <MicOff className="h-7 w-7 text-white" />
                        ) : (
                            <Mic className="h-7 w-7 text-white" />
                        )}
                    </button>
                    <span className="text-xs font-medium text-white/60">
                        {!modelReady ? "Mic off" : isMuted ? "Unmute" : "Mute"}
                    </span>
                </div>

                {/* End call button */}
                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={endSession}
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/25 transition-all duration-200 hover:scale-105 hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="End interview"
                    >
                        <PhoneOff className="h-7 w-7 text-white" />
                    </button>
                    <span className="text-xs font-medium text-white/60">
                        End
                    </span>
                </div>
            </div>
        </div>
    );
}
