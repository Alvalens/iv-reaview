import { useParams } from "react-router-dom";

export function InterviewPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-16">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card">
        <span className="text-4xl">🎤</span>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Interview Session</h1>
      <p className="text-muted-foreground">Session ID: {id}</p>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Real-time interview UI will be implemented here.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Audio visualizer, persona avatar, live transcript, and session timer.
        </p>
      </div>
    </div>
  );
}
