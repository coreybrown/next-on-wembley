"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isValidPlatformKey } from "@/lib/platforms";

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

  revalidatePath("/settings");
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
