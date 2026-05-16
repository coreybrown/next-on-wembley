"use client";

import { useTransition } from "react";
import { setThemeAction, type ThemeOverride } from "@/lib/settings";

const OPTIONS: { value: ThemeOverride; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type Props = { current: ThemeOverride };

export function ThemeSelect({ current }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <fieldset disabled={isPending}>
      <legend className="font-mono text-mono uppercase text-ink-muted mb-3">
        Theme
      </legend>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="
              flex cursor-pointer items-center justify-center
              rounded-md border border-border bg-surface-elevated
              px-4 py-3 font-body text-base text-ink
              transition-colors hover:border-border-strong
              has-[input:checked]:border-accent
              has-[input:checked]:bg-accent
              has-[input:checked]:text-accent-fg
              has-[input:focus-visible]:outline-2
              has-[input:focus-visible]:outline-accent-sharp
              has-[input:focus-visible]:outline-offset-2
            "
          >
            <input
              type="radio"
              name="theme"
              value={opt.value}
              defaultChecked={current === opt.value}
              onChange={() =>
                startTransition(async () => {
                  await setThemeAction(opt.value);
                })
              }
              className="sr-only"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
