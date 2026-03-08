import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PERSONAS, RANDOM_PERSONA } from "@/lib/personas";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Upload, FileText, X, Loader2 } from "lucide-react";

export function SetupPage() {
  const navigate = useNavigate();
  const allPersonas = [...PERSONAS, RANDOM_PERSONA];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState<"HR" | "TECHNICAL">("HR");
  const [cvContent, setCvContent] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvExtracting, setCvExtracting] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const canSubmit =
    selectedPersona &&
    jobTitle.trim() &&
    companyName.trim() &&
    jobDescription.trim() &&
    !loading &&
    !cvExtracting;

  const handleCVFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setCvError("Only PDF files are accepted");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCvError("File too large (max 5MB)");
      return;
    }

    setCvError(null);
    setCvExtracting(true);
    setCvFileName(file.name);

    try {
      const result = await api.extractCV(file);
      setCvContent(result.content);
    } catch (err) {
      setCvError(err instanceof Error ? err.message : "Extraction failed");
      setCvFileName(null);
    } finally {
      setCvExtracting(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCVFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleCVFile(file);
  }

  function clearCV() {
    setCvContent("");
    setCvFileName(null);
    setCvError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
                <p className="mt-1 text-xs text-quaternary">
                  {persona.interviewStyle}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* CV Upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              CV / Resume{" "}
              <span className="text-muted-foreground font-normal">
                (optional — PDF upload or paste text)
              </span>
            </label>

            {!cvContent && !cvExtracting ? (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    dragOver
                      ? "border-quaternary bg-quaternary/5"
                      : "border-border hover:border-quaternary/50"
                  }`}
                >
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Drag & drop your CV (PDF) or{" "}
                    <span className="text-quaternary underline">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Max 5MB. Text will be extracted automatically.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  or paste your CV text below
                </p>
                <textarea
                  value={cvContent}
                  onChange={(e) => setCvContent(e.target.value)}
                  placeholder="Paste your CV or resume content..."
                  rows={3}
                  className={inputClass + " mt-1 resize-none"}
                />
              </>
            ) : cvExtracting ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-primary p-4">
                <Loader2 className="h-5 w-5 animate-spin text-quaternary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Extracting text from {cvFileName}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Using AI to parse your CV
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-primary p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-quaternary" />
                    <span className="text-sm font-medium text-foreground">
                      {cvFileName ?? "CV text"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({cvContent.length} chars extracted)
                    </span>
                  </div>
                  <button
                    onClick={clearCV}
                    className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 max-h-32 overflow-y-auto rounded bg-secondary p-3">
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {cvContent.substring(0, 500)}
                    {cvContent.length > 500 ? "..." : ""}
                  </pre>
                </div>
              </div>
            )}

            {cvError && (
              <p className="mt-1 text-sm text-destructive">{cvError}</p>
            )}
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
