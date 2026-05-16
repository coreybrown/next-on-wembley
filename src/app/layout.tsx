import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Chivo, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Gear, FilmReel } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth";
import { IdentityChip } from "@/components/identity-chip";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
});

const chivo = Chivo({
  subsets: ["latin"],
  variable: "--font-chivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Next on Wembley",
  description:
    "A weekly column of what to watch — for two readers, one couch.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const dataTheme =
    themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      suppressHydrationWarning
      className={`${fraunces.variable} ${chivo.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-svh bg-surface text-ink font-body">
        {user && (
          <header className="fixed right-4 top-4 z-30 flex items-center gap-2">
            <Link
              href="/in-progress"
              aria-label="In Progress"
              className="
                inline-flex h-10 w-10 items-center justify-center
                rounded-sm border border-border-strong
                bg-surface-elevated text-ink
                transition-colors hover:border-accent hover:text-accent
                focus-visible:outline-2 focus-visible:outline-accent-sharp
                focus-visible:outline-offset-2
              "
            >
              <FilmReel size={20} weight="regular" />
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="
                inline-flex h-10 w-10 items-center justify-center
                rounded-sm border border-border-strong
                bg-surface-elevated text-ink
                transition-colors hover:border-accent hover:text-accent
                focus-visible:outline-2 focus-visible:outline-accent-sharp
                focus-visible:outline-offset-2
              "
            >
              <Gear size={20} weight="regular" />
            </Link>
            <IdentityChip currentUser={user} />
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
