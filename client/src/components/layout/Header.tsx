import { Mic } from "lucide-react";
import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="border-b border-border bg-secondary/50 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-quaternary">
            <Mic className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground">
            Intervyou <span className="text-quaternary">Live</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
