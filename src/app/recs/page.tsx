import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth";
import { getLatestRunsForCurrentUser } from "@/app/actions/recommendations";
import { RecsView } from "@/components/recs-view";

export default async function RecsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const { runs, userSubKeys } = await getLatestRunsForCurrentUser();

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-16 sm:px-8 sm:py-20">
      <Link
        href="/"
        className="
          inline-flex items-center gap-2
          font-mono text-mono uppercase text-ink-muted
          transition-colors hover:text-ink
          focus-visible:outline-2 focus-visible:outline-accent
          focus-visible:outline-offset-2
        "
      >
        <ArrowLeft size={14} weight="regular" aria-hidden />
        <span>Back to list</span>
      </Link>

      <header className="mt-8 mb-10">
        <p className="font-mono text-mono uppercase text-ink-muted">
          [Recommendations · {user.displayName}]
        </p>
        <h1 className="mt-3 font-display text-2xl font-black text-ink leading-none sm:text-4xl">
          What&rsquo;s next on Wembley
        </h1>
        <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
      </header>

      <RecsView initial={runs} userSubKeys={userSubKeys} />
    </main>
  );
}
