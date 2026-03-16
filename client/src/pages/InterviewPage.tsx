import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveSession } from "@/hooks/useLiveSession";
import { api } from "@/lib/api";
import type { InterviewSession } from "@/lib/types";
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
        timeWarning,
        dismissWarning,
        timeLoaded,
    } = useLiveSession(id!);

    // Camera preview ref
    const cameraPreviewRef = useRef<HTMLVideoElement>(null);

    const setCameraRef = useCallback((el: HTMLVideoElement | null) => {
        (cameraPreviewRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        if (el && videoStream) {
            el.srcObject = videoStream;
        }
    }, [videoStream]);

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

    // Model is ready once it has spoken at least once
    const modelReady = transcript.some((e) => e.role === "model");

    // Live interview UI
    return (
        <div className="flex h-[calc(100vh-5rem)] flex-col">
            {/* Time Warning Dialog */}
            <Dialog open={!!timeWarning} onOpenChange={dismissWarning}>
                <DialogContent className="max-w-md">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                            <Loader2 className="h-8 w-8 text-amber-500" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="mb-2 text-xl font-semibold text-foreground">
                                Interview Time Ending Soon
                            </DialogTitle>
                            <DialogDescription className="mb-6 text-muted-foreground">
                                Your interview will end in <span className="font-semibold text-amber-500">{timeWarning} seconds</span>.
                                Please wrap up your current answer.
                            </DialogDescription>
                        </DialogHeader>
                        <Button onClick={dismissWarning} className="w-full">
                            Continue Interview
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
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
                        <p className="text-xs text-muted-foreground">
                            {persona?.interviewStyle ?? ""}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {videoStream && (
                        <div className="relative h-[48px] w-[64px] overflow-hidden rounded-md border border-border">
                            <video
                                ref={setCameraRef}
                                autoPlay
                                playsInline
                                muted
                                className="h-full w-full object-cover mirror"
                                style={{ transform: "scaleX(-1)" }}
                            />
                            <Video className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white/70" />
                        </div>
                    )}
                    <span className="font-mono text-lg text-foreground">
                        {timeLoaded ? formatTime(elapsedMs) : "--:--"}
                    </span>
                    {modelReady ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs text-amber-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Setting up
                        </span>
                    )}
                </div>
            </div>

            {/* Transcript feed */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {!modelReady && (
                    <div className="flex flex-col items-center gap-3 py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-quaternary" />
                        <p className="text-sm text-muted-foreground">
                            {persona?.name ?? "AI Interviewer"} is preparing your interview...
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                            Your mic is muted until the interviewer starts
                        </p>
                    </div>
                )}
                {transcript.map((entry, i) => (
                    <div
                        key={i}
                        className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${entry.role === "user"
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
                    variant={isMuted || !modelReady ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleMute}
                    disabled={!modelReady}
                    className="gap-2"
                >
                    {!modelReady ? (
                        <>
                            <MicOff className="h-5 w-5" /> Mic off
                        </>
                    ) : isMuted ? (
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
