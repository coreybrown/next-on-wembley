"use client";

import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ShowDetailView } from "@/lib/show-detail";
import { ShowDetailBody } from "@/components/show-detail-body";

type Props = { view: ShowDetailView };

// Phase 20b — Show Detail rendered inside a Radix Dialog when reached
// via in-app navigation from a sibling route (intercepted via
// app/@modal/(.)show/[tmdbId]/page.tsx). The standalone full-page
// route stays mounted underneath, so closing the drawer
// (Esc / overlay tap / close button / browser back) returns the user
// to /recs / /in-progress / wherever they started with their scroll
// position preserved.
export function ShowDetailDrawer({ view }: Props) {
  const router = useRouter();

  const onOpenChange = (open: boolean) => {
    if (!open) router.back();
  };

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0 z-40 bg-surface-overlay/70 backdrop-blur-sm
            data-[state=open]:animate-in data-[state=closed]:animate-out
          "
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="
            fixed z-50 bg-page text-ink focus:outline-none
            overflow-y-auto
            inset-x-0 bottom-0 max-h-[90vh] rounded-t-lg border-t border-border-strong
            sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:h-svh sm:w-[480px]
            sm:max-w-full sm:rounded-none sm:border-l sm:border-t-0 sm:border-border-strong
            data-[state=open]:animate-in data-[state=closed]:animate-out
          "
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-page px-6 py-3">
            <Dialog.Title className="font-mono text-mono uppercase text-ink-muted">
              Show detail
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="
                  inline-flex h-9 w-9 items-center justify-center
                  rounded-sm border border-border bg-surface text-ink-secondary
                  transition-colors hover:border-accent hover:text-accent
                  focus-visible:outline-2 focus-visible:outline-accent-sharp
                  focus-visible:outline-offset-2
                "
              >
                <X size={16} weight="bold" />
              </button>
            </Dialog.Close>
          </div>
          <div className="px-6 pb-12 pt-6">
            <ShowDetailBody view={view} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
