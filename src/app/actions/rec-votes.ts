"use server";

import { revalidatePath } from "next/cache";
import type { VoteValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export type VoteActionError =
  | "unauthorized"
  | "not_found"
  | "forbidden";

export type VoteActionResult =
  | { ok: true }
  | { ok: false; error: VoteActionError };

// Verifies the caller is allowed to vote on this item. User-scoped lists
// (corey / jaimie) are private to that user; co_watch is shared so
// either user may vote with their own userId. Returns the item's
// effective owner userId on success — voteOnRecAction writes the vote
// under that id, never the viewer's id, so partner viewing of someone
// else's list doesn't quietly clobber their picks.
async function authorizeVoteForItem(
  itemId: number,
  sessionUserId: number,
): Promise<
  | { ok: true; ownerUserId: number }
  | { ok: false; error: "not_found" | "forbidden" }
> {
  const item = await prisma.recommendationItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      run: { select: { scope: true } },
    },
  });
  if (!item) return { ok: false, error: "not_found" };

  const scope = item.run.scope;
  if (scope === "co_watch") {
    return { ok: true, ownerUserId: sessionUserId };
  }
  // scope is "corey" or "jaimie" — find the User whose username matches
  // and require the session to belong to them.
  const owner = await prisma.user.findUnique({
    where: { username: scope },
    select: { id: true },
  });
  if (!owner) return { ok: false, error: "not_found" };
  if (owner.id !== sessionUserId) return { ok: false, error: "forbidden" };
  return { ok: true, ownerUserId: owner.id };
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

  await prisma.recommendationVote.upsert({
    where: { itemId_userId: { itemId, userId: auth.ownerUserId } },
    create: { itemId, userId: auth.ownerUserId, vote },
    update: { vote, createdAt: new Date() },
  });

  revalidatePath("/recs");
  return { ok: true };
}

// Clears any vote on this item that belongs to the rightful owner per
// authorizeVoteForItem. Idempotent — calling this when no vote exists
// still returns ok. Used to back out of a vote without picking a
// different one.
export async function clearVoteAction(
  itemId: number,
): Promise<VoteActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const auth = await authorizeVoteForItem(itemId, session.userId);
  if (!auth.ok) return auth;

  await prisma.recommendationVote.deleteMany({
    where: { itemId, userId: auth.ownerUserId },
  });

  revalidatePath("/recs");
  return { ok: true };
}
