"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Gear, ArrowsLeftRight, SignOut } from "@phosphor-icons/react";
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

const USER_CHIP_COLOR: Record<string, string> = {
  corey: "bg-user-corey text-user-corey-fg",
  jaimie: "bg-user-jaimie text-user-jaimie-fg",
};

const menuItemClass = `
  flex items-center gap-2 rounded-sm
  px-3 py-2
  font-body text-sm text-ink
  outline-none cursor-pointer
  transition-colors
  data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg
`;

export function IdentityChip({ currentUser }: Props) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const other = ALL_USERS.find((u) => u.username !== currentUser.username) ?? ALL_USERS[0];
  const monogram = currentUser.displayName.charAt(0);
  const chipColor =
    USER_CHIP_COLOR[currentUser.username] ?? "bg-accent text-accent-fg";

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Signed in as ${currentUser.displayName}. Open user menu.`}
            className={`
              inline-flex h-10 w-10 items-center justify-center
              rounded-sm border border-border-strong
              ${chipColor}
              font-display text-xl font-bold italic
              transition-transform hover:scale-105
              focus-visible:outline-2 focus-visible:outline-accent-sharp
              focus-visible:outline-offset-2
            `}
          >
            {monogram}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="
              z-40 min-w-44
              rounded-md border border-border bg-surface-elevated
              p-1 shadow-lg
              focus:outline-none
            "
          >
            <DropdownMenu.Label className="px-3 py-1.5 font-mono text-mono uppercase text-ink-muted">
              {currentUser.displayName}
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item asChild className={menuItemClass}>
              <Link href="/settings">
                <Gear size={16} weight="regular" aria-hidden />
                <span>Settings</span>
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setSwitchOpen(true)}
              className={menuItemClass}
            >
              <ArrowsLeftRight size={16} weight="regular" aria-hidden />
              <span>Switch user</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={() => {
                void logoutAction();
              }}
              className={menuItemClass}
            >
              <SignOut size={16} weight="regular" aria-hidden />
              <span>Log out</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root open={switchOpen} onOpenChange={setSwitchOpen}>
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
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
