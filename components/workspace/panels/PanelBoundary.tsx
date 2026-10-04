"use client";

/**
 * PanelBoundary — React error boundary for every major workspace module
 * (3D canvas, sequence viewer, chart renderers, PAE heatmap…).
 *
 * "Zero unhandled errors" client policy, layer 1: one panel crashing
 * degrades into a designed fallback instead of taking the workspace down.
 * The fallback shows a fixed message plus a truncated error text (React
 * text node — never markup, so even a hostile error string is inert) and
 * a retry that remounts the panel.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface PanelBoundaryProps {
  /** Panel name — used in the fallback and the console attribution. */
  title: string;
  children: ReactNode;
  /** Called with the retry; pages typically clear bad data here. */
  onReset?: () => void;
  className?: string;
}

interface PanelBoundaryState {
  error: Error | null;
}

export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  state: PanelBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Attribution only — never log data payloads.
    console.error(`[Protheon panel offline] ${this.props.title}:`, error.message, info.componentStack ?? "");
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className={`panel-fallback ${this.props.className ?? ""}`} role="alert">
          <span className="panel-fallback-icon" aria-hidden>
            <TriangleAlert className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm font-medium text-frost">{this.props.title} went offline</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-mist/80">
            This panel crashed, but the rest of the workspace is intact.
            {error.message ? ` Detail: ${error.message.slice(0, 160)}` : ""}
          </p>
          <button type="button" onClick={this.reset} className="btn-ghost mt-4 !px-4 !py-1.5 text-xs">
            Retry panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
