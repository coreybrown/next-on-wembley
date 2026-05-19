"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { RecModel } from "@prisma/client";
import {
  REC_MODELS,
  REC_MODEL_LABELS,
  REC_MODEL_BLURBS,
  REC_MODEL_REFRESH_COST,
} from "@/lib/rec-models";
import { setRecModelAction } from "@/lib/settings";

type Props = { current: RecModel };

export function RecModelSelect({ current }: Props) {
  const [isPending, startTransition] = useTransition();
  // Model the user picked but hasn't confirmed yet. null = no dialog open.
  const [pending, setPending] = useState<RecModel | null>(null);

  const choose = (model: RecModel) => {
    if (model === current || isPending) return;
    setPending(model);
  };

  const confirm = () => {
    if (!pending) return;
    startTransition(async () => {
      await setRecModelAction(pending);
      setPending(null);
    });
  };

  const cancel = () => {
    if (isPending) return;
    setPending(null);
  };

  return (
    <>
      <fieldset disabled={isPending}>
        <legend className="font-mono text-mono uppercase text-ink-muted mb-3">
          Recommendation model
        </legend>
        <p className="font-body text-sm text-ink-secondary mb-4">
          The Claude model used when you refresh your picks. Changing it will
          trigger a fresh round of recommendations — we&rsquo;ll confirm before
          firing.
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

      <Dialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            className="
              fixed inset-0 z-40 bg-surface-overlay/70 backdrop-blur-sm
              data-[state=open]:animate-in data-[state=closed]:animate-out
            "
          />
          <Dialog.Content
            className="
              fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md
              -translate-x-1/2 -translate-y-1/2
              rounded-md border border-border bg-surface-elevated
              p-8 shadow-lg focus:outline-none
            "
          >
            <Dialog.Title className="font-display text-2xl font-bold text-ink">
              Switch to {pending ? REC_MODEL_LABELS[pending] : ""}?
            </Dialog.Title>
            <Dialog.Description className="mt-3 font-body text-sm text-ink-secondary">
              This regenerates Co-watch, Corey&rsquo;s Picks, and
              Jaimie&rsquo;s Picks immediately, using{" "}
              {pending ? REC_MODEL_REFRESH_COST[pending] : ""} of Anthropic
              API credit from your account.
            </Dialog.Description>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={cancel}
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
                onClick={confirm}
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
                {isPending ? "Switching…" : "Switch & regenerate"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
