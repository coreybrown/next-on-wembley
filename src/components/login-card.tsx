"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/auth";
import { Logo } from "@/components/logo";

const initialState: LoginState = { error: null };

export function LoginCard() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <article className="w-full max-w-md">
      <header className="mb-10 text-center text-ink">
        <Logo className="mx-auto mb-6 h-40 w-auto sm:h-48" />
        <p className="font-mono text-mono uppercase text-ink-muted">
          [a quiet borough · 2026]
        </p>
        <h1 className="mt-3 font-display text-4xl font-black text-ink leading-none">
          Next on{" "}
          <span tabIndex={0} className="group relative focus:outline-none">
            Wembley
            <span
              aria-hidden="true"
              className="
                pointer-events-none absolute left-1/2 top-full mt-3
                w-max max-w-xs -translate-x-1/2 whitespace-normal
                font-mono text-mono normal-case text-ink-muted
                opacity-0 transition-opacity duration-300
                group-hover:opacity-100 group-focus:opacity-100
              "
            >
              ¹ a quiet borough, a louder cat, depending on whom you ask
            </span>
          </span>
        </h1>
        <div aria-hidden className="mx-auto mt-3 h-[2px] w-16 bg-accent-sharp" />
        <p className="mt-6 font-display italic text-lg text-ink-secondary">
          A weekly column of what to watch.
        </p>
      </header>

      <form action={formAction} className="space-y-6" noValidate>
        <fieldset>
          <legend className="font-mono text-mono uppercase text-ink-muted mb-3">
            Who&rsquo;s signing in?
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { username: "corey", displayName: "Corey" },
              { username: "jaimie", displayName: "Jaimie" },
            ].map(({ username, displayName }) => (
              <label
                key={username}
                className="
                  flex cursor-pointer items-center justify-center gap-2
                  rounded-md border border-border bg-surface-elevated
                  px-4 py-3 text-base font-body text-ink
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
                  name="username"
                  value={username}
                  className="sr-only"
                  required
                />
                <span className="font-display italic">{displayName}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="passcode"
            className="block font-mono text-mono uppercase text-ink-muted mb-2"
          >
            Passcode
          </label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            aria-describedby={state.error ? "login-error" : undefined}
            aria-invalid={state.error ? true : undefined}
            className="
              w-full rounded-sm border border-border bg-surface-elevated
              px-3 py-3 text-base font-body text-ink
              transition-colors
              focus:outline-2 focus:outline-accent focus:outline-offset-2
            "
          />
        </div>

        {state.error && (
          <p
            id="login-error"
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
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </article>
  );
}
