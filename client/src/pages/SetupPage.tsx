import { PERSONAS, RANDOM_PERSONA } from "@/lib/personas";
import { Button } from "@/components/ui/button";

export function SetupPage() {
  const allPersonas = [...PERSONAS, RANDOM_PERSONA];

  return (
    <div className="space-y-8">
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
          {allPersonas.map((persona) => (
            <div
              key={persona.id}
              className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-quaternary"
            >
              <div
                className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${persona.avatar.gradient}`}
              >
                <span className="text-2xl">{persona.avatar.emoji}</span>
              </div>
              <h3 className="font-semibold text-foreground">{persona.name}</h3>
              <p className="text-sm text-muted-foreground">{persona.title}</p>
              <p className="mt-1 text-xs text-quaternary capitalize">
                {persona.difficulty} difficulty
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder form fields */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Job Details</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-muted-foreground">
            Job title, company, description, and CV upload form will go here.
          </p>
        </div>
      </div>

      <Button size="lg" disabled>
        Start Interview
      </Button>
    </div>
  );
}
