"use client";

import { useTransition } from "react";
import type { RecModel } from "@prisma/client";
import {
  REC_MODELS,
  REC_MODEL_LABELS,
  REC_MODEL_BLURBS,
} from "@/lib/rec-models";
import { setRecModelAction } from "@/lib/settings";

type Props = { current: RecModel };

export function RecModelSelect({ current }: Props) {
  const [isPending, startTransition] = useTransition();

  const choose = (model: RecModel) => {
    if (model === current) return;
    startTransition(() => setRecModelAction(model));
  };

  return (
    <fieldset disabled={isPending}>
      <legend className="font-mono text-mono uppercase text-ink-muted mb-3">
        Recommendation model
      </legend>
      <p className="font-body text-sm text-ink-secondary mb-4">
        The Claude model used when you refresh your picks. Changing it will
        trigger a fresh round of recommendations.
      </p>
      <ul className="space-y-2">
        {REC_MODELS.map((m) => {
          const active = m === current;
          return (
            <li key={m}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => choose(m)}
                className="
                  flex w-full flex-col items-start gap-1
                  rounded-md border border-border bg-surface-elevated
                  px-4 py-3 text-left
                  font-body text-base text-ink
                  transition-colors hover:border-border-strong
                  aria-pressed:border-accent
                  aria-pressed:bg-accent
                  aria-pressed:text-accent-fg
                  focus-visible:outline-2 focus-visible:outline-accent-sharp
                  focus-visible:outline-offset-2
                "
              >
                <span className="font-display text-lg font-bold">
                  {REC_MODEL_LABELS[m]}
                </span>
                <span
                  className={`
                    font-body text-sm
                    ${active ? "text-accent-fg/80" : "text-ink-secondary"}
                  `}
                >
                  {REC_MODEL_BLURBS[m]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
