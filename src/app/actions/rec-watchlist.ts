"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidateAll, revalidateRecSurfaces } from "@/lib/revalidate";

export type AddToWtwError =
  | "unauthorized"
  | "not_found"
  | "show_unavailable"
  | "already_in_history";

export type AddToWtwResult =
  | { ok: true }
  | { ok: false; error: AddToWtwError };

// Add the show backing a rec item to the current user's Want-to-Watch
// list. The show row already exists (the rec generation pipeline upserts
// it), so we skip the TMDb roundtrip that addWatchEntry would otherwise
// make. Idempotent when the user already has the show as want_to_watch;
// returns already_in_history when they have it under another status so
// the UI can show a helpful note instead of silently doing nothing.
export async function addToWantToWatchAction(
  itemId: number,
): Promise<AddToWtwResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const item = await prisma.recommendationItem.findUnique({
    where: { id: itemId },
    select: { id: true, showId: true },
  });
  if (!item) return { ok: false, error: "not_found" };
  // showId becomes null only when the underlying Show row was deleted
  // after the rec persisted (cascade SetNull). The user can't add a
  // ghost show — surface a clean error.
  if (item.showId == null) {
    return { ok: false, error: "show_unavailable" };
  }

  const existing = await prisma.watchEntry.findUnique({
    where: {
      userId_showId: { userId: session.userId, showId: item.showId },
    },
    select: { status: true },
  });
  if (existing) {
    if (existing.status === "want_to_watch") {
      revalidateRecSurfaces();
      return { ok: true };
    }
    return { ok: false, error: "already_in_history" };
  }

  await prisma.watchEntry.create({
    data: {
      userId: session.userId,
      showId: item.showId,
      status: "want_to_watch",
    },
  });

  revalidateAll();
  return { ok: true };
}
