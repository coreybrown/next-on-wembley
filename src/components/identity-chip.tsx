"use client";

import { useState, useActionState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { loginAction, logoutAction, type LoginState } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";

const initialState: LoginState = { error: null };

type Props = {
  currentUser: CurrentUser;
};

const ALL_USERS = [
  { username: "corey", displayName: "Corey" },
  { username: "jaimie", displayName: "Jaimie" },
];

export function IdentityChip({ currentUser }: Props) {
  const [open, setOpen] = useState(false);
  const other = ALL_USERS.find((u) => u.username !== currentUser.username) ?? ALL_USERS[0];
  const monogram = currentUser.displayName.charAt(0);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Currently signed in as ${currentUser.displayName}. Tap to switch user.`}
          className="
            inline-flex h-10 w-10 items-center justify-center
            rounded-sm border border-border-strong
            bg-accent text-accent-fg
            font-display text-xl font-bold italic
            transition-transform hover:scale-105
            focus-visible:outline-2 focus-visible:outline-accent-sharp
            focus-visible:outline-offset-2
          "
        >
          {monogram}
        </button>
      </Dialog.Trigger>
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
            Switch user
          </Dialog.Title>
          <Dialog.Description className="mt-2 font-body text-sm text-ink-secondary">
            Enter {other.displayName}&rsquo;s passcode to hand off the device.
          </Dialog.Description>

          <SwitchForm other={other} />

          <div className="mt-8 border-t border-border pt-4 text-center">
            <form action={logoutAction}>
              <button
                type="submit"
                className="
                  font-mono text-mono text-ink-muted
                  underline-offset-2 hover:underline hover:text-ink
                  focus-visible:outline-2 focus-visible:outline-accent
                  focus-visible:outline-offset-2
                "
              >
                Or sign out completely
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SwitchForm({
  other,
}: {
  other: { username: string; displayName: string };
}) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="username" value={other.username} />
      <div>
        <label
          htmlFor="switch-passcode"
          className="block font-mono text-mono uppercase text-ink-muted mb-2"
        >
          {other.displayName}&rsquo;s passcode
        </label>
        <input
          id="switch-passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-describedby={state.error ? "switch-error" : undefined}
          aria-invalid={state.error ? true : undefined}
          className="
            w-full rounded-sm border border-border bg-surface
            px-3 py-3 text-base font-body text-ink
            focus:outline-2 focus:outline-accent focus:outline-offset-2
          "
        />
      </div>
      {state.error && (
        <p
          id="switch-error"
          role="alert"
          aria-live="polite"
          className="font-mono text-mono text-danger"
        >
          [{state.error}]
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="
          w-full rounded-md bg-accent px-4 py-3
          font-body text-base text-accent-fg
          transition-opacity hover:opacity-90
          disabled:cursor-not-allowed disabled:opacity-50
          focus-visible:outline-2 focus-visible:outline-accent-sharp
          focus-visible:outline-offset-2
        "
      >
        {isPending ? "Switching…" : `Switch to ${other.displayName}`}
      </button>
    </form>
  );
}
