"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "@phosphor-icons/react";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { toggleSubscriptionAction } from "@/lib/settings";

type Props = { active: string[] };

export function SubscriptionEditor({ active }: Props) {
  const [optimistic, applyOptimistic] = useOptimistic(
    active,
    (state: string[], platformKey: string) =>
      state.includes(platformKey)
        ? state.filter((k) => k !== platformKey)
        : [...state, platformKey],
  );
  const [isPending, startTransition] = useTransition();

  const toggle = (key: PlatformKey) => {
    startTransition(async () => {
      applyOptimistic(key);
      await toggleSubscriptionAction(key);
    });
  };

  return (
    <fieldset disabled={isPending}>
      <legend className="font-mono text-mono uppercase text-ink-muted mb-3">
        Streaming subscriptions
      </legend>
      <p className="font-body text-sm text-ink-secondary mb-4">
        Region is Canada. We&rsquo;ll only recommend shows you can actually
        watch.
      </p>
      <ul className="space-y-2">
        {PLATFORMS.map((p) => {
          const isActive = optimistic.includes(p.key);
          return (
            <li key={p.key}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => toggle(p.key)}
                className="
                  flex w-full items-center justify-between
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
                <span>{p.displayName}</span>
                <span
                  aria-hidden
                  className={
                    isActive
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-pill bg-accent-fg/20"
                      : "inline-block h-5 w-5 rounded-pill border border-border-strong"
                  }
                >
                  {isActive && <Check size={14} weight="bold" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
