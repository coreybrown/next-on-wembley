"use server";

import { revalidatePath } from "next/cache";
import type { VoteValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export type VoteActionError = "unauthorized" | "not_found";

export type VoteActionResult =
  | { ok: true }
  | { ok: false; error: VoteActionError };

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

  const item = await prisma.recommendationItem.findUnique({
    where: { id: itemId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "not_found" };

  await prisma.recommendationVote.upsert({
    where: { itemId_userId: { itemId, userId: session.userId } },
    create: { itemId, userId: session.userId, vote },
    update: { vote, createdAt: new Date() },
  });

  revalidatePath("/recs");
  return { ok: true };
}

// Clears any vote the current user has on this item. Idempotent — calling
// this when no vote exists still returns ok. Used to back out of a vote
// without picking a different one.
export async function clearVoteAction(
  itemId: number,
): Promise<VoteActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  await prisma.recommendationVote.deleteMany({
    where: { itemId, userId: session.userId },
  });

  revalidatePath("/recs");
  return { ok: true };
}
