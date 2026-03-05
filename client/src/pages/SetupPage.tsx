import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PERSONAS, RANDOM_PERSONA } from "@/lib/personas";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function SetupPage() {
  const navigate = useNavigate();
  const allPersonas = [...PERSONAS, RANDOM_PERSONA];

  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState<"HR" | "TECHNICAL">("HR");
  const [cvContent, setCvContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    selectedPersona &&
    jobTitle.trim() &&
    companyName.trim() &&
    jobDescription.trim() &&
    !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const session = await api.createSession({
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        jobDescription: jobDescription.trim(),
        interviewType,
        personaId: selectedPersona,
        cvContent: cvContent.trim() || undefined,
      });
      navigate(`/interview/${(session as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-primary px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-quaternary focus:outline-none focus:ring-1 focus:ring-quaternary";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Start an Interview
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set up your mock interview session with an AI interviewer.
        </p>
      </div>

      {/* Persona selection */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Choose your interviewer
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {allPersonas.map((persona) => {
            const isSelected = selectedPersona === persona.id;
            return (
              <div
                key={persona.id}
                onClick={() => setSelectedPersona(persona.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-quaternary ring-2 ring-quaternary bg-secondary"
                    : "border-border bg-card hover:border-quaternary/50"
                }`}
              >
                <div
                  className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${persona.avatar.gradient}`}
                >
                  <span className="text-2xl">{persona.avatar.emoji}</span>
                </div>
                <h3 className="font-semibold text-foreground">
                  {persona.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {persona.title}
                </p>
                <p className="mt-1 text-xs text-quaternary capitalize">
                  {persona.difficulty} difficulty
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job Details form */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Job Details</h2>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Job Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Software Engineer"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Company Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Job Description <span className="text-destructive">*</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description or key responsibilities..."
              rows={4}
              className={inputClass + " resize-none"}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              CV / Resume Text{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={cvContent}
              onChange={(e) => setCvContent(e.target.value)}
              placeholder="Paste your CV or resume content to personalize questions..."
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>
        </div>
      </div>

      {/* Interview Type */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Interview Type
        </h2>
        <div className="flex gap-3">
          {(["HR", "TECHNICAL"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setInterviewType(type)}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                interviewType === type
                  ? "bg-quaternary text-primary"
                  : "border border-border bg-card text-foreground hover:border-quaternary/50"
              }`}
            >
              {type === "HR" ? "HR / Behavioral" : "Technical"}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <Button
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {loading ? "Starting..." : "Start Interview"}
        </Button>
      </div>
    </div>
  );
}
