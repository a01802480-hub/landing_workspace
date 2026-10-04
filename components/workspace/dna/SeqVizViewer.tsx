"use client";

/**
 * SeqVizViewer — the seqviz canvas wrapper.
 *
 * seqviz renders the actual plasmid/linear maps (annotation rails, enzyme
 * ticks, index rulers, circular view) from the workspace store's viewer
 * state. Loaded client-side only (browser bundle); if the library fails to
 * load, the panel degrades into a designed fallback instead of crashing
 * the workspace.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SeqVizProps } from "seqviz";
import type { SequenceSelection, ViewerAnnotation } from "@/lib/sequences";
import { PanelSkeleton } from "@/components/workspace/panels/PanelSkeleton";

type ViewerMode = "linear" | "circular" | "both";

interface SeqVizComponentProps {
  name: string;
  seq: string;
  annotations: ViewerAnnotation[];
  enzymes?: { name: string; ranges: { start: number; end: number }[] }[];
  viewer: ViewerMode;
  showIndex?: boolean;
  selection?: { start: number; end: number; name?: string; color?: string };
  onSelection?: (sel: { start: number; end: number }) => void;
  style?: { height: string; width: string };
}

const SeqViz = dynamic(
  () =>
    import("seqviz").then((mod) => {
      // seqviz exposes a named SeqViz component; some builds default-export it.
      const Comp = (mod as { SeqViz?: ComponentType<SeqVizProps>; default?: ComponentType<SeqVizProps> })
        .SeqViz ?? (mod as { default?: ComponentType<SeqVizProps> }).default;
      if (!Comp) throw new Error("seqviz did not export a component.");
      return Comp;
    }),
  { ssr: false, loading: () => <PanelSkeleton variant="viewer" caption="Rendering the sequence map…" /> },
);

interface SeqVizViewerProps {
  name: string;
  seq: string;
  annotations: ViewerAnnotation[];
  enzymes: { name: string; ranges: { start: number; end: number }[] }[];
  viewer: ViewerMode;
  selection: SequenceSelection | null;
  onSelection: (sel: SequenceSelection | null) => void;
}

export function SeqVizViewer({ name, seq, annotations, enzymes, viewer, selection, onSelection }: SeqVizViewerProps) {
  return (
    <div className="h-full w-full">
      {/* The canvas sits inside a PanelBoundary at the call site; a thrown
          seqviz error becomes that fallback. */}
      <SeqViz
        name={name}
        seq={seq}
        annotations={annotations}
        // Enzyme names as strings — seqviz digests them with its built-in
        // enzyme database (our registry enzymes are all standard ones; the
        // classic maps keep the backend-computed, junction-aware ranges).
        enzymes={enzymes.length ? enzymes.map((e) => e.name) : undefined}
        viewer={viewer}
        showIndex
        // seqviz 3.x types mark primers required; empty list = none rendered.
        primers={[]}
        selection={
          selection
            ? { start: selection.start, end: selection.end }
            : undefined
        }
        onSelection={({ start, end }: { start?: number; end?: number }) => {
          if (!start || !end || end < start) {
            onSelection(null);
            return;
          }
          onSelection({ start, end });
        }}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
