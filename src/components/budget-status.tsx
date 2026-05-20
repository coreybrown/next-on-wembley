import { Warning, CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { BudgetStatus } from "@/lib/llm-budget";

type Props = { status: BudgetStatus };

// Surfaces the running Anthropic spend in /settings so the user knows
// where they sit against the PRD §10 monthly cap. Three visual states:
// ok (green check), warning (yellow at ≥75%), exceeded (red, refresh
// is paused at the action layer).
export function BudgetStatusCard({ status }: Props) {
  const { spentUsd, capUsd, warningFraction, state } = status;
  const pct = Math.min(100, Math.round((spentUsd / capUsd) * 100));
  const Icon =
    state === "ok" ? CheckCircle : state === "warning" ? Warning : XCircle;
  const tone =
    state === "ok"
      ? "text-ink-secondary"
      : state === "warning"
        ? "text-warning"
        : "text-danger";
  const barColor =
    state === "ok"
      ? "bg-accent"
      : state === "warning"
        ? "bg-warning"
        : "bg-danger";

  return (
    <div>
      <h2 className="font-mono text-mono uppercase text-ink-muted mb-3">
        Anthropic spend this month
      </h2>
      <div className="rounded-md border border-border bg-surface-elevated p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <span className="font-display text-2xl font-bold text-ink">
            ${spentUsd.toFixed(2)}{" "}
            <span className="font-mono text-mono uppercase text-ink-muted">
              / ${capUsd.toFixed(2)}
            </span>
          </span>
          <span
            className={`inline-flex items-center gap-1 font-mono text-mono uppercase ${tone}`}
          >
            <Icon size={14} weight="fill" aria-hidden />
            {state === "ok" && <span>On budget</span>}
            {state === "warning" && (
              <span>
                Over {Math.round(warningFraction * 100)}% — slow down
              </span>
            )}
            {state === "exceeded" && <span>Cap reached — refresh paused</span>}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Monthly Anthropic budget"
          className="h-2 w-full overflow-hidden rounded-pill bg-surface-overlay"
        >
          <div
            style={{ width: `${pct}%` }}
            className={`h-full ${barColor} transition-all`}
          />
        </div>
        <p className="font-mono text-mono uppercase text-ink-muted">
          Resets at the start of next month (UTC).
        </p>
      </div>
    </div>
  );
}
