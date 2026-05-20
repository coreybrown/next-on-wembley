import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Chivo, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { FilmReel, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth";
import { IdentityChip } from "@/components/identity-chip";
import { Logo } from "@/components/logo";
import { RefreshProvider } from "@/components/refresh-context";
import { RefreshIndicator } from "@/components/refresh-indicator";
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
  modal,
}: {
  children: React.ReactNode;
  // Parallel-route slot for the Show Detail drawer (Phase 20b). The
  // `@modal` segment renders either the intercepted Show Detail
  // (overlay drawer) or its `default.tsx` (null) when nothing matches.
  modal: React.ReactNode;
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
        {/* Skip-link for keyboard users — sits before the sticky app
            bar so a single Tab lands on it; activating jumps focus
            past the bar's nav links to #content. */}
        <a
          href="#content"
          className="
            sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2
            focus:z-50 focus:rounded-sm focus:border focus:border-accent
            focus:bg-surface-elevated focus:px-3 focus:py-1
            focus:font-mono focus:text-mono focus:uppercase focus:text-ink
            focus:outline-none
          "
        >
          Skip to content
        </a>
        <RefreshProvider>
          {user && (
            // Phase 31: unified sticky app bar. Replaces the two
            // previously fixed top-left/top-right clusters; sits in
            // normal flow so pages no longer need to budget top
            // padding for chrome. Bar surface + border-b handle the
            // scroll-ghosting that used to require per-element badges.
            <header
              className="
                sticky top-0 z-30
                border-b border-border bg-surface/85 backdrop-blur
                supports-[backdrop-filter]:bg-surface/70
              "
            >
              <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6 sm:px-8">
                <Link
                  href="/"
                  aria-label="Next on Wembley — back to your list"
                  className="
                    inline-flex items-center
                    rounded-sm text-ink
                    transition-colors hover:text-accent
                    focus-visible:outline-2 focus-visible:outline-accent-sharp
                    focus-visible:outline-offset-2
                  "
                >
                  <Logo className="h-11 w-auto" title="" />
                </Link>
                <nav
                  aria-label="Primary"
                  className="flex items-center gap-1 sm:gap-2"
                >
                  <RefreshIndicator />
                  <Link
                    href="/in-progress"
                    aria-label="In Progress"
                    className="
                      inline-flex h-11 w-11 items-center justify-center
                      rounded-sm text-ink-secondary
                      transition-colors hover:bg-surface-elevated hover:text-accent
                      focus-visible:outline-2 focus-visible:outline-accent-sharp
                      focus-visible:outline-offset-2
                    "
                  >
                    <FilmReel size={20} weight="regular" />
                  </Link>
                  <Link
                    href="/recs"
                    aria-label="Recommendations"
                    className="
                      inline-flex h-11 w-11 items-center justify-center
                      rounded-sm text-ink-secondary
                      transition-colors hover:bg-surface-elevated hover:text-accent
                      focus-visible:outline-2 focus-visible:outline-accent-sharp
                      focus-visible:outline-offset-2
                    "
                  >
                    <Sparkle size={20} weight="regular" />
                  </Link>
                  <IdentityChip currentUser={user} />
                </nav>
              </div>
            </header>
          )}
          <div id="content" tabIndex={-1}>
            {children}
            {modal}
          </div>
        </RefreshProvider>
      </body>
    </html>
  );
}
