import { type ReactNode } from "react";

function isBrowserSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof AudioContext !== "undefined" &&
    typeof AudioWorkletNode !== "undefined"
  );
}

export function BrowserCheck({ children }: { children: ReactNode }) {
  if (!isBrowserSupported()) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="text-4xl">Browser Not Supported</div>
        <p className="max-w-lg text-muted-foreground">
          Intervyou Live requires a modern browser with AudioWorklet and
          microphone support. Please use the latest version of{" "}
          <strong className="text-foreground">Google Chrome</strong> or{" "}
          <strong className="text-foreground">Microsoft Edge</strong>.
        </p>
        <a
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-quaternary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-quaternary/90"
        >
          Download Chrome
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
