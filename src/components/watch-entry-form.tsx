"use client";

import { useId, useState, type ChangeEvent } from "react";
import type { WatchStatus, UserRating } from "@prisma/client";
import {
  WATCH_STATUSES,
  USER_RATINGS,
  STATUS_LABELS,
  RATING_LABELS,
  RATING_GLYPHS,
  shouldClearSeason,
} from "@/lib/watch-entries";

export type WatchEntryFormValues = {
  status: WatchStatus;
  currentSeason: number | null;
  userRating: UserRating | null;
};

type Props = {
  initial?: Partial<WatchEntryFormValues>;
  isPending: boolean;
  errorMessage: string | null;
  submitLabel: string;
  // Optional upper bound on currentSeason input. Caller computes this
  // from the show's released seasons; null means unbounded (ongoing
  // show or no per-season data).
  maxSeason?: number | null;
  onSubmit: (values: WatchEntryFormValues) => void;
  onCancel: () => void;
};

export function WatchEntryForm({
  initial,
  isPending,
  errorMessage,
  submitLabel,
  maxSeason,
  onSubmit,
  onCancel,
}: Props) {
  const statusGroupId = useId();
  const seasonId = useId();
  const errId = useId();

  const [status, setStatus] = useState<WatchStatus>(
    initial?.status ?? "want_to_watch",
  );
  const [season, setSeason] = useState<string>(
    initial?.currentSeason != null ? String(initial.currentSeason) : "1",
  );
  const [rating, setRating] = useState<UserRating | null>(
    initial?.userRating ?? null,
  );

  const seasonVisible = !shouldClearSeason(status);

  const handleSubmit = () => {
    const parsedSeason = seasonVisible ? parseInt(season, 10) : null;
    let clamped: number | null = null;
    if (
      seasonVisible &&
      Number.isFinite(parsedSeason) &&
      parsedSeason! > 0
    ) {
      clamped =
        maxSeason != null && parsedSeason! > maxSeason
          ? maxSeason
          : parsedSeason!;
    }
    onSubmit({
      status,
      currentSeason: clamped,
      userRating: rating,
    });
  };

  const onSeasonChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSeason(e.target.value);
  };

  return (
    <div className="mt-6 space-y-6">
      <fieldset>
        <legend
          id={statusGroupId}
          className="font-mono text-mono uppercase text-ink-muted mb-3"
        >
          Status
        </legend>
        <ul
          role="radiogroup"
          aria-labelledby={statusGroupId}
          className="space-y-2"
        >
          {WATCH_STATUSES.map((s) => {
            const checked = status === s;
            return (
              <li key={s}>
                <label
                  className={`
                    flex cursor-pointer items-center gap-3
                    rounded-md border px-4 py-3
                    font-body text-base
                    transition-colors
                    ${
                      checked
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-surface text-ink hover:border-border-strong"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={checked}
                    onChange={() => setStatus(s)}
                    className="sr-only"
                  />
                  <span>{STATUS_LABELS[s]}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {seasonVisible && (
        <div>
          <label
            htmlFor={seasonId}
            className="block font-mono text-mono uppercase text-ink-muted mb-2"
          >
            Current season
          </label>
          <input
            id={seasonId}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxSeason ?? undefined}
            step={1}
            value={season}
            onChange={onSeasonChange}
            aria-describedby={
              maxSeason != null ? `${seasonId}-hint` : undefined
            }
            className="
              w-24 rounded-sm border border-border bg-surface
              px-3 py-2 font-body text-base text-ink
              focus:outline-2 focus:outline-accent focus:outline-offset-2
            "
          />
          {maxSeason != null && (
            <p
              id={`${seasonId}-hint`}
              className="mt-1 font-mono text-mono text-ink-muted"
            >
              1–{maxSeason} released
            </p>
          )}
        </div>
      )}

      <fieldset>
        <legend className="font-mono text-mono uppercase text-ink-muted mb-3">
          Rating (optional)
        </legend>
        <div className="flex gap-2" role="group" aria-label="Rating">
          {USER_RATINGS.map((r) => {
            const selected = rating === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={selected}
                aria-label={RATING_LABELS[r]}
                onClick={() => setRating(selected ? null : r)}
                className={`
                  inline-flex flex-1 items-center justify-center gap-2
                  rounded-md border px-3 py-2
                  font-body text-base
                  transition-colors
                  ${
                    selected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-ink hover:border-border-strong"
                  }
                  focus-visible:outline-2 focus-visible:outline-accent-sharp
                  focus-visible:outline-offset-2
                `}
              >
                <span aria-hidden className="text-xl">
                  {RATING_GLYPHS[r]}
                </span>
                <span>{RATING_LABELS[r]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {errorMessage && (
        <p
          id={errId}
          role="alert"
          aria-live="polite"
          className="font-mono text-mono text-danger"
        >
          [{errorMessage}]
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="
            flex-1 rounded-md border border-border bg-surface
            px-4 py-3 font-body text-base text-ink
            transition-colors hover:border-border-strong
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="
            flex-1 rounded-md bg-accent px-4 py-3
            font-body text-base text-accent-fg
            transition-opacity hover:opacity-90
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent-sharp
            focus-visible:outline-offset-2
          "
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
