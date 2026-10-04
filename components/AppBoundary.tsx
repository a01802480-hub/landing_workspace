"use client";

/**
 * AppBoundary — the root error boundary around the entire application.
 *
 * Dev-mode React/HMR can occasionally throw a DOM-level error ("Failed to
 * execute 'removeChild'…") that no panel boundary can catch because it
 * happens inside React's own commit phase. Without a root boundary that
 * error unmounts the whole tree — the "buttons disappear" symptom. With
 * it, the worst case is this designed fallback with a one-click reload;
 * panels additionally have their own PanelBoundary so ordinary crashes
 * never even get this far.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Dna } from "lucide-react";

interface AppBoundaryState {
  error: Error | null;
}

export class AppBoundary extends Component<{ children: ReactNode }, AppBoundaryState> {
  state: AppBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Attribution only — never log data payloads.
    console.error("[Protheon] root boundary caught:", error.message, info.componentStack ?? "");
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="glass-card max-w-md p-8 text-center">
            <span aria-hidden className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-glow-violet/40 bg-glow-violet/10 text-glow-violet">
              <Dna className="h-6 w-6" />
            </span>
            <h1 className="text-lg font-semibold text-frost">The workspace lost its footing</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">
              A rendering hiccup occurred — your loaded models and view preferences are safe.
              Reload to continue where you left off.
            </p>
            <button type="button" onClick={this.reload} className="btn-primary mt-5">
              Reload workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
