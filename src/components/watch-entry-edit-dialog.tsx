"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  updateWatchEntry,
  deleteWatchEntry,
  type WatchEntryActionError,
  type WatchEntryWithShow,
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
  entry: WatchEntryWithShow | null;
  onOpenChange: (open: boolean) => void;
};

export function WatchEntryEditDialog({ entry, onOpenChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const open = entry !== null;

  const close = () => {
    setError(null);
    onOpenChange(false);
  };

  const submit = (values: WatchEntryFormValues) => {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const res = await updateWatchEntry({ id: entry.id, ...values });
      if (!res.ok) {
        setError(ERROR_COPY[res.error]);
        return;
      }
      close();
    });
  };

  const remove = () => {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteWatchEntry(entry.id);
      if (!res.ok) {
        setError(ERROR_COPY[res.error]);
        return;
      }
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
            Edit entry
          </Dialog.Title>
          {entry && (
            <Dialog.Description className="mt-2 font-body text-sm text-ink-secondary">
              {entry.show.title}
            </Dialog.Description>
          )}
          {entry && (
            <WatchEntryForm
              initial={{
                status: entry.status,
                currentSeason: entry.currentSeason,
                userRating: entry.userRating,
              }}
              isPending={isPending}
              errorMessage={error}
              submitLabel="Save"
              onSubmit={submit}
              onCancel={close}
            />
          )}
          <div className="mt-6 border-t border-border pt-4 text-center">
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="
                font-mono text-mono text-danger
                underline-offset-2 hover:underline
                disabled:cursor-not-allowed disabled:opacity-50
                focus-visible:outline-2 focus-visible:outline-danger
                focus-visible:outline-offset-2
              "
            >
              Remove from list
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
