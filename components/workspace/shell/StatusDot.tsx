/**
 * StatusDot — the one correct way to render a status dot.
 *
 * `.status-dot` is `position: absolute; inset: 0` — it fills its nearest
 * positioned ancestor. It MUST live inside a sized relative wrapper, or
 * it balloons into a giant oval covering its whole container (a
 * `glass-card` sidebar, a node card, the run monitor…). Every dot goes
 * through this component.
 */
export function StatusDot({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className="relative h-1.5 w-1.5 shrink-0">
      <span className={`status-dot ${className}`} />
    </span>
  );
}
