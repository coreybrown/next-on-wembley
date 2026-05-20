"use server";

import type { VoteValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidateRecSurfaces } from "@/lib/revalidate";

export type VoteActionError =
  | "unauthorized"
  | "not_found"
  | "forbidden"
  | "show_unavailable";

export type VoteActionResult =
  | { ok: true }
  | { ok: false; error: VoteActionError };

// Verifies the caller is allowed to vote on this item AND resolves the
// (ownerUserId, showId) pair the vote should write to. User-scoped lists
// (corey / jaimie) are private to that user; co_watch is shared so
// either user may vote with their own userId. Votes are keyed on the
// show — not the ephemeral rec item — so they survive future
// RecommendationRun refreshes.
async function authorizeVoteForItem(
  itemId: number,
  sessionUserId: number,
): Promise<
  | { ok: true; ownerUserId: number; showId: number }
  | { ok: false; error: "not_found" | "forbidden" | "show_unavailable" }
> {
  const item = await prisma.recommendationItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      showId: true,
      run: { select: { scope: true } },
    },
  });
  if (!item) return { ok: false, error: "not_found" };
  // showId becomes null when the underlying Show row was deleted after
  // the rec persisted (cascade SetNull). Without it we can't anchor the
  // per-show vote.
  if (item.showId == null) return { ok: false, error: "show_unavailable" };

  const scope = item.run.scope;
  if (scope === "co_watch") {
    return { ok: true, ownerUserId: sessionUserId, showId: item.showId };
  }
  const owner = await prisma.user.findUnique({
    where: { username: scope },
    select: { id: true },
  });
  if (!owner) return { ok: false, error: "not_found" };
  if (owner.id !== sessionUserId) return { ok: false, error: "forbidden" };
  return { ok: true, ownerUserId: owner.id, showId: item.showId };
}

// Cast a vote on a recommendation item. Latest write wins: a second call
// for the same (item, user) replaces the prior vote. We also bump
// createdAt on update so the "recent votes" prompt slice surfaces the
// user's most recent intent first.
export async function voteOnRecAction(
  itemId: number,
  vote: VoteValue,
): Promise<VoteActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const auth = await authorizeVoteForItem(itemId, session.userId);
  if (!auth.ok) return auth;

  await prisma.showVote.upsert({
    where: {
      showId_userId: { showId: auth.showId, userId: auth.ownerUserId },
    },
    create: { showId: auth.showId, userId: auth.ownerUserId, vote },
    update: { vote, createdAt: new Date() },
  });

  revalidateRecSurfaces();
  return { ok: true };
}

// Clears the rightful owner's vote on the show backing this rec item.
// Idempotent — calling this when no vote exists still returns ok.
export async function clearVoteAction(
  itemId: number,
): Promise<VoteActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const auth = await authorizeVoteForItem(itemId, session.userId);
  if (!auth.ok) return auth;

  await prisma.showVote.deleteMany({
    where: { showId: auth.showId, userId: auth.ownerUserId },
  });

  revalidateRecSurfaces();
  return { ok: true };
}

// Phase 28. Show-keyed clear for the "Buried disagrees" inspector: lets
// the viewer re-vote their own past Disagree by simply deleting it.
// Skips the item-based auth (authorizeVoteForItem) because the inspector
// works on shows directly — the viewer is by definition the owner of
// their own vote.
export async function clearOwnVoteOnShowAction(
  showId: number,
): Promise<VoteActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  await prisma.showVote.deleteMany({
    where: { showId, userId: session.userId },
  });

  revalidateRecSurfaces();
  return { ok: true };
}
