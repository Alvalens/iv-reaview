import { useParams } from "react-router-dom";

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Interview Results</h1>
      <p className="text-muted-foreground">Session ID: {id}</p>
      <div className="rounded-xl border border-border bg-card p-8">
        <p className="text-muted-foreground">
          Score dashboard, per-question feedback, strengths/weaknesses, and
          transcript review will be implemented here.
        </p>
      </div>
    </div>
  );
}
