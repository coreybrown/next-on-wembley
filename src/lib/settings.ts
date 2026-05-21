"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { RecModel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isValidPlatformKey } from "@/lib/platforms";
import { isValidRecModel } from "@/lib/rec-models";
import { regenerateAllLists } from "@/app/actions/recommendations";

export type ThemeOverride = "light" | "dark" | "system";
const VALID_THEMES = ["light", "dark", "system"] as const satisfies readonly ThemeOverride[];
const THEME_COOKIE = "theme";

function isValidTheme(v: string): v is ThemeOverride {
  return (VALID_THEMES as readonly string[]).includes(v);
}

export async function setThemeAction(theme: string): Promise<void> {
  if (!isValidTheme(theme)) {
    throw new Error(`Invalid theme: ${theme}`);
  }
  const jar = await cookies();
  if (theme === "system") {
    jar.delete(THEME_COOKIE);
  } else {
    jar.set(THEME_COOKIE, theme, {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }
  revalidatePath("/", "layout");
}

export async function getThemeOverride(): Promise<ThemeOverride> {
  const jar = await cookies();
  const v = jar.get(THEME_COOKIE)?.value;
  if (v === "light" || v === "dark") return v;
  return "system";
}

export async function toggleSubscriptionAction(
  platformKey: string,
): Promise<void> {
  if (!isValidPlatformKey(platformKey)) {
    throw new Error(`Invalid platform key: ${platformKey}`);
  }
  const session = await getSession();
  if (!session.userId) {
    throw new Error("Not authenticated");
  }

  const existing = await prisma.userSubscription.findUnique({
    where: {
      userId_platformKey: { userId: session.userId, platformKey },
    },
  });

  if (existing) {
    await prisma.userSubscription.delete({ where: { id: existing.id } });
  } else {
    await prisma.userSubscription.create({
      data: { userId: session.userId, platformKey },
    });
  }

  // Stamp the change so /recs can tell the current recommendations were
  // generated against an older subscription set (a removed sub deletes
  // its row, so this timestamp is the only durable signal).
  await prisma.user.update({
    where: { id: session.userId },
    data: { subscriptionsUpdatedAt: new Date() },
  });

  revalidatePath("/settings");
  revalidatePath("/recs");
}

export async function getUserSubscriptions(): Promise<string[]> {
  const session = await getSession();
  if (!session.userId) return [];
  const subs = await prisma.userSubscription.findMany({
    where: { userId: session.userId },
    select: { platformKey: true },
  });
  return subs.map((s) => s.platformKey);
}

// Per-user model choice for recommendation generation. Default seeded as
// `haiku`. Changing the value triggers a refresh of the user's lists in
// M3 Phase 10 — for now we just persist + revalidate so the new preference
// shows up the next time a refresh is triggered.
export async function setRecModelAction(model: string): Promise<void> {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("Not authenticated");
  }
  if (!isValidRecModel(model)) {
    throw new Error(`Invalid rec model: ${model}`);
  }
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { recModel: true },
  });
  const changed = current?.recModel !== model;
  await prisma.user.update({
    where: { id: session.userId },
    data: { recModel: model },
  });
  revalidatePath("/settings");
  revalidatePath("/recs");
  // Auto-regen all three lists when the model changes. Blocks the action —
  // the latency UX polish (background gen + nav pill) lands in Phase 13.
  // No-op (and silently absorbs failures) when nothing changed.
  if (changed) {
    try {
      await regenerateAllLists();
    } catch {
      // Don't fail the settings update if rec gen errors; the user can
      // retry from the Refresh button on /recs once it ships.
    }
  }
}

export async function getRecModel(): Promise<RecModel | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { recModel: true },
  });
  return user?.recModel ?? null;
}
