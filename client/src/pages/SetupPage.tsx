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

    const selectedPersonaData = allPersonas.find(p => p.id === selectedPersona);

    return (
        <div className="min-h-screen bg-[#001427] px-4 py-8">
            <div className="mx-auto max-w-5xl">
                {/* Header with AI Badge */}
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold text-[#F1F5F9] mb-3 bg-linear-to-r from-[#F1F5F9] to-[#94A3B8] bg-clip-text text-transparent">
                        Start Your Interview
                    </h1>
                    <p className="text-[#94A3B8] text-lg">
                        Practice with AI interviewers tailored to your target role
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

                                    {/* Interview Type Toggle */}
                                    <div className="group">
                                        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
                                            <Brain className="h-4 w-4 text-[#1FB6FF]" />
                                            Interview Type
                                        </label>
                                        <div className="flex gap-3">
                                            {(["HR", "TECHNICAL"] as const).map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => setInterviewType(type)}
                                                    className={`flex-1 rounded-xl px-6 py-4 text-sm font-semibold transition-all duration-300 ${interviewType === type
                                                        ? "bg-linear-to-r from-[#1FB6FF] to-[#0EA5E9] text-white shadow-lg shadow-[#1FB6FF]/30"
                                                        : "bg-[#0A1F33] border-2 border-[#1E3A5F] text-[#94A3B8] hover:border-[#1FB6FF]/50"
                                                        }`}
                                                >
                                                    {type === "HR" ? "HR / Behavioral" : "Technical"}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-1.5 text-xs text-[#64748B]">Choose the focus of your interview</p>
                                    </div>

                                    {/* Job Description */}
                                    <div className="group">
                                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
                                            <FileText className="h-4 w-4 text-[#1FB6FF]" />
                                            Job Description
                                            <span className="text-[#EF4444]">*</span>
                                        </label>
                                        <textarea
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                            placeholder="Paste the full job description or key responsibilities here..."
                                            rows={5}
                                            className="w-full rounded-xl bg-[#0A1F33] border-2 border-[#1E3A5F] px-5 py-4 text-[#F1F5F9] placeholder:text-[#64748B] focus:border-[#1FB6FF] focus:outline-none focus:ring-4 focus:ring-[#1FB6FF]/20 transition-all duration-300 resize-none"
                                        />
                                        <p className="mt-1.5 text-xs text-[#64748B]">
                                            <Zap className="inline h-3 w-3 mr-1" />
                                            AI will use this to generate relevant questions
                                        </p>
                                    </div>

                                    {/* CV Upload Section */}
                                    <div className="group rounded-xl bg-[#001427]/50 border border-[#1E3A5F]/30 p-6">
                                        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F1F5F9]">
                                            <File className="h-4 w-4 text-[#94A3B8]" />
                                            CV / Resume
                                            <span className="ml-auto text-xs font-normal text-[#64748B]">(Optional)</span>
                                        </label>

                                        {!cvContent && !cvExtracting ? (
                                            <div className="space-y-4">
                                                {/* Drag & Drop Upload Area */}
                                                <div
                                                    onDrop={handleDrop}
                                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                                    onDragLeave={() => setDragOver(false)}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${dragOver
                                                        ? "border-[#1FB6FF] bg-[#1FB6FF]/5 scale-[1.02]"
                                                        : "border-[#1E3A5F] hover:border-[#1FB6FF]/50 hover:bg-[#0A1F33]/50"
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="rounded-full bg-[#1FB6FF]/10 p-4">
                                                            <Upload className="h-8 w-8 text-[#1FB6FF]" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-[#F1F5F9]">
                                                                Drag & drop your CV (PDF)
                                                            </p>
                                                            <p className="text-xs text-[#94A3B8] mt-1">
                                                                or <span className="text-[#1FB6FF] underline">browse files</span>
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-[#64748B]">
                                                            <span className="flex items-center gap-1">
                                                                PDF only
                                                            </span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                Max 5MB
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="application/pdf"
                                                    onChange={handleFileInput}
                                                    className="hidden"
                                                />

                                                {/* Or Divider */}
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-px bg-[#1E3A5F]"></div>
                                                    <span className="text-xs text-[#64748B]">or paste text</span>
                                                    <div className="flex-1 h-px bg-[#1E3A5F]"></div>
                                                </div>

                                                {/* Text Area */}
                                                <textarea
                                                    value={cvContent}
                                                    onChange={(e) => setCvContent(e.target.value)}
                                                    placeholder="Paste your resume content for personalized questions..."
                                                    rows={4}
                                                    className="w-full rounded-xl bg-[#0A1F33] border-2 border-[#1E3A5F] px-5 py-4 text-[#F1F5F9] placeholder:text-[#64748B] focus:border-[#1FB6FF] focus:outline-none focus:ring-4 focus:ring-[#1FB6FF]/20 transition-all duration-300 resize-none"
                                                />
                                            </div>
                                        ) : cvExtracting ? (
                                            <div className="rounded-xl bg-[#0A1F33] border border-[#1FB6FF]/30 p-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="rounded-full bg-[#1FB6FF]/10 p-3">
                                                        <Loader2 className="h-6 w-6 animate-spin text-[#1FB6FF]" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-[#F1F5F9] mb-1">
                                                            Extracting text from {cvFileName}
                                                        </p>
                                                        <p className="text-xs text-[#94A3B8] mb-3">
                                                            Our AI is parsing your CV to extract relevant information
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-[#64748B]">
                                                            <Clock className="h-3 w-3" />
                                                            <span>This usually takes 5-10 seconds</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl bg-[#0A1F33] border border-[#22C55E]/30 p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-lg bg-[#22C55E]/10 p-2">
                                                            <FileText className="h-5 w-5 text-[#22C55E]" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-[#F1F5F9]">
                                                                {cvFileName ?? "CV text"}
                                                            </p>
                                                            <p className="text-xs text-[#94A3B8]">
                                                                {cvContent.length.toLocaleString()} characters extracted
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={clearCV}
                                                        className="rounded-lg p-2 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E3A5F] transition-all duration-200"
                                                        aria-label="Remove CV"
                                                    >
                                                        <X className="h-5 w-5" />
                                                    </button>
                                                </div>
                                                <div className="rounded-lg bg-[#001427] p-4 max-h-40 overflow-y-auto border border-[#1E3A5F]">
                                                    <pre className="whitespace-pre-wrap text-xs text-[#94A3B8] font-mono">
                                                        {cvContent.substring(0, 500)}
                                                        {cvContent.length > 500 ? "\n\n..." : ""}
                                                    </pre>
                                                </div>
                                                <div className="mt-3 flex items-center gap-2 text-xs text-[#22C55E]">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    <span>CV successfully processed - AI will personalize your interview</span>
                                                </div>
                                            </div>
                                        )}

                                        {cvError && (
                                            <div className="mt-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 p-3 flex items-start gap-2">
                                                <AlertCircle className="h-4 w-4 text-[#EF4444] shrink-0 mt-0.5" />
                                                <p className="text-sm text-[#EF4444]">{cvError}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <Button
                                    onClick={() => setCurrentStep(1)}
                                    variant="outline"
                                    className="bg-transparent border-2 border-[#1E3A5F] text-[#94A3B8] hover:border-[#1FB6FF]/50 hover:text-[#F1F5F9] px-6 py-6 rounded-xl transition-all duration-300"
                                >
                                    <ArrowLeft className="mr-2 h-5 w-5" />
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setCurrentStep(3)}
                                    disabled={!canProceedStep2}
                                    className="bg-linear-to-r from-[#1FB6FF] to-[#0EA5E9] hover:from-[#0EA5E9] hover:to-[#1FB6FF] text-white font-semibold px-8 py-6 rounded-xl shadow-lg shadow-[#1FB6FF]/30 transition-all duration-300 hover:shadow-[#1FB6FF]/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review & Launch */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="rounded-2xl bg-linear-to-b from-[#0F2A44] to-[#0A1F33] p-8 border border-[#1E3A5F]/50 shadow-2xl">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-[#F1F5F9] mb-2 flex items-center gap-2">
                                        <CheckCircle2 className="h-6 w-6 text-[#22C55E]" />
                                        Review Configuration
                                    </h2>
                                    <p className="text-[#94A3B8]">
                                        Verify your interview setup before starting
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    {/* Interviewer Summary */}
                                    {selectedPersonaData && (
                                        <div className="rounded-xl bg-linear-to-br from-[#1FB6FF]/10 to-[#0EA5E9]/5 border border-[#1FB6FF]/30 p-6">
                                            <div className="flex items-start gap-4">
                                                <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${selectedPersonaData.avatar.gradient} shadow-lg`}>
                                                    <span className="text-3xl">{selectedPersonaData.avatar.emoji}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-bold text-[#F1F5F9] mb-1">
                                                        {selectedPersonaData.name}
                                                    </h3>
                                                    <p className="text-sm text-[#94A3B8] mb-2">
                                                        {selectedPersonaData.title}
                                                    </p>
                                                    <span className="inline-block text-xs font-semibold text-[#1FB6FF] bg-[#1FB6FF]/10 px-3 py-1 rounded-full">
                                                        {selectedPersonaData.interviewStyle}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Job Details Summary */}
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-xl bg-[#0A1F33] border border-[#1E3A5F] p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Briefcase className="h-4 w-4 text-[#1FB6FF]" />
                                                <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Position</span>
                                            </div>
                                            <p className="text-[#F1F5F9] font-semibold">{jobTitle}</p>
                                        </div>

                                        <div className="rounded-xl bg-[#0A1F33] border border-[#1E3A5F] p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Building2 className="h-4 w-4 text-[#1FB6FF]" />
                                                <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Company</span>
                                            </div>
                                            <p className="text-[#F1F5F9] font-semibold">{companyName}</p>
                                        </div>

                                        <div className="rounded-xl bg-[#0A1F33] border border-[#1E3A5F] p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Brain className="h-4 w-4 text-[#1FB6FF]" />
                                                <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Type</span>
                                            </div>
                                            <p className="text-[#F1F5F9] font-semibold">
                                                {interviewType === "HR" ? "HR / Behavioral" : "Technical"}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-[#0A1F33] border border-[#1E3A5F] p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileText className="h-4 w-4 text-[#1FB6FF]" />
                                                <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Resume</span>
                                            </div>
                                            <p className="text-[#F1F5F9] font-semibold">
                                                {cvContent.trim() ? (
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                                                        Provided
                                                    </span>
                                                ) : (
                                                    "Not provided"
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* AI Insight Banner */}
                                    <div className="rounded-xl bg-linear-to-r from-[#22C55E]/10 to-[#16A34A]/5 border border-[#22C55E]/30 p-5">
                                        <div className="flex gap-3">
                                            <Sparkles className="h-5 w-5 text-[#22C55E] shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-semibold text-[#F1F5F9] mb-1">AI Ready to Interview</h4>
                                                <p className="text-xs text-[#94A3B8]">
                                                    Your interview is configured and ready to start. The AI will generate questions tailored to your role
                                                    {cvContent.trim() && " and experience from your CV"}.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-4">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-5 w-5 text-[#EF4444] shrink-0" />
                                        <p className="text-sm text-[#EF4444]">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <Button
                                    onClick={() => setCurrentStep(2)}
                                    variant="outline"
                                    disabled={loading}
                                    className="bg-transparent border-2 border-[#1E3A5F] text-[#94A3B8] hover:border-[#1FB6FF]/50 hover:text-[#F1F5F9] px-6 py-6 rounded-xl transition-all duration-300"
                                >
                                    <ArrowLeft className="mr-2 h-5 w-5" />
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                    className="bg-linear-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16A34A] hover:to-[#22C55E] text-white font-bold px-10 py-6 rounded-xl shadow-lg shadow-[#22C55E]/30 transition-all duration-300 hover:shadow-[#22C55E]/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Launching...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="mr-2 h-5 w-5" />
                                            Start Interview
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}