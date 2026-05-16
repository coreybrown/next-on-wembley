"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { TmdbSearchResult } from "@/lib/tmdb";
import {
  addWatchEntry,
  type WatchEntryActionError,
} from "@/app/actions/watch-entries";
import {
  WatchEntryForm,
  type WatchEntryFormValues,
} from "@/components/watch-entry-form";

const ERROR_COPY: Record<WatchEntryActionError, string> = {
  unauthorized: "Session expired — please sign in again.",
  not_found: "Entry not found.",
  invalid_status: "Pick a valid status.",
  invalid_rating: "Pick a valid rating.",
  invalid_season: "Current season is only for Watching or Paused.",
  already_added: "This show is already on your list.",
  tmdb_unavailable: "TMDb is unavailable — try again in a moment.",
};

type Props = {
  show: TmdbSearchResult | null;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
};

export function AddShowModal({ show, onOpenChange, onAdded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = show !== null;

  const close = () => {
    setError(null);
    onOpenChange(false);
  };

  const submit = (values: WatchEntryFormValues) => {
    if (!show) return;
    setError(null);
    startTransition(async () => {
      const res = await addWatchEntry({ tmdbId: show.tmdbId, ...values });
      if (!res.ok) {
        setError(ERROR_COPY[res.error]);
        return;
      }
      onAdded?.();
      close();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0 z-40 bg-surface-overlay/70 backdrop-blur-sm
            data-[state=open]:animate-in data-[state=closed]:animate-out
          "
        />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[90vw] max-w-md
            -translate-x-1/2 -translate-y-1/2 overflow-y-auto
            rounded-md border border-border bg-surface-elevated
            p-8 shadow-lg focus:outline-none
          "
        >
          <Dialog.Title className="font-display text-2xl font-bold text-ink">
            Add to your list
          </Dialog.Title>
          {show && (
            <div className="mt-4 flex items-start gap-4">
              {show.posterUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={show.posterUrl}
                  alt=""
                  width={72}
                  height={108}
                  className="h-[108px] w-18 flex-shrink-0 rounded-sm bg-surface-overlay object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="h-[108px] w-18 flex-shrink-0 rounded-sm bg-surface-overlay"
                />
              )}
              <Dialog.Description asChild>
                <div className="font-body text-base text-ink">
                  <p className="font-display text-lg font-bold leading-tight">
                    {show.title}
                  </p>
                  {show.year && (
                    <p className="mt-1 font-mono text-mono uppercase text-ink-muted">
                      {show.year}
                    </p>
                  )}
                </div>
              </Dialog.Description>
            </div>
          )}
          <WatchEntryForm
            isPending={isPending}
            errorMessage={error}
            submitLabel="Add"
            onSubmit={submit}
            onCancel={close}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
