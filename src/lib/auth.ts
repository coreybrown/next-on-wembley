"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { verifyPasscode } from "@/lib/passcode";

export type LoginState = { error: string | null };

export type CurrentUser = {
  id: number;
  username: string;
  displayName: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const passcode = String(formData.get("passcode") ?? "");

  if (!username || !passcode) {
    return { error: "Choose a user and enter a passcode." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPasscode(passcode, user.passcodeHash))) {
    return { error: "Incorrect passcode." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.displayName = user.displayName;
  await session.save();

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return {
    id: session.userId,
    username: session.username ?? "",
    displayName: session.displayName ?? "",
  };
}
