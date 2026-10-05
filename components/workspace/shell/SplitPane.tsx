"use client";

/**
 * SplitPane — Benchling-style resizable split between two workspace panes.
 *
 * - Pointer-drag with pointer capture; the ratio is clamped so neither pane
 *   can collapse by accident.
 * - Keyboard accessible: the separator is a focusable `role="separator"`
 *   that moves with the arrow keys.
 * - The ratio persists to localStorage (best-effort, validated on read).
 * - `collapsed` hides the second pane + separator without remounting the
 *   first (no viewer reset when toggling the right column).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { storageRead, storageWrite } from "@/lib/persistence";

const CLAMP = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface SplitPaneProps {
  direction?: "row" | "column";
  /** localStorage key (namespaced "protheon:" automatically). */
  storageKey: string;
  /** Initial first-pane size in percent. */
  initial?: number;
  minFirst?: number;
  minSecond?: number;
  first: ReactNode;
  second: ReactNode;
  collapsed?: boolean;
  className?: string;
}

export function SplitPane({
  direction = "row",
  storageKey,
  initial = 62,
  minFirst = 30,
  minSecond = 20,
  first,
  second,
  collapsed = false,
  className = "",
}: SplitPaneProps) {
  // Hydration-safe: the server renders `initial`; the persisted ratio is
  // adopted in an effect after hydration (reading storage in the useState
  // initializer would diverge the server/client trees).
  const [ratio, setRatio] = useState<number>(initial);
  const adopted = useRef(false);
  const skipNextWrite = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const stored = storageRead<number>(storageKey);
    if (typeof stored === "number" && Number.isFinite(stored)) {
      skipNextWrite.current = true;
      setRatio(CLAMP(stored, minFirst, 100 - minSecond));
    }
    adopted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    if (adopted.current) storageWrite(storageKey, ratio);
  }, [storageKey, ratio]);

  // While dragging: capture the pointer, freeze text selection.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add("splitter-dragging");
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct =
      direction === "row"
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100;
    setRatio(CLAMP(pct, minFirst, 100 - minSecond));
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.classList.remove("splitter-dragging");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setRatio((r) => CLAMP(r - step, minFirst, 100 - minSecond));
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setRatio((r) => CLAMP(r + step, minFirst, 100 - minSecond));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 ${direction === "row" ? "flex-row" : "flex-col"} ${className}`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: `${ratio}%`, flexGrow: 0, flexShrink: 0 }}
      >
        {first}
      </div>
      {!collapsed && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation={direction === "row" ? "vertical" : "horizontal"}
          aria-label="Resize panels"
          aria-valuenow={Math.round(ratio)}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          className={`splitter ${direction === "row" ? "splitter-col" : "splitter-row"}`}
        />
      )}
      <div className={`min-h-0 min-w-0 flex-1 overflow-hidden ${collapsed ? "hidden" : ""}`}>{second}</div>
    </div>
  );
}
