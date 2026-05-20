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
// route stays mounted underneath, so closing it
// (Esc / overlay tap / close button / browser back) returns the user
// to /recs / /in-progress / wherever they started with their scroll
// position preserved.
//
// Presentation: a bottom sheet on mobile, a centered modal on desktop —
// centered (rather than a right-side drawer) so the detail content has
// the full modal width and reads without feeling squished.
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
            overflow-y-auto border-border-strong
            inset-x-0 bottom-0 max-h-[90vh] rounded-t-lg border-t
            sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2
            sm:-translate-x-1/2 sm:-translate-y-1/2
            sm:h-auto sm:max-h-[88vh] sm:w-[680px] sm:max-w-[calc(100vw-4rem)]
            sm:rounded-lg sm:border
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
