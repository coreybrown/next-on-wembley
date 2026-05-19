import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ThemeSelect } from "@/components/theme-select";
import { SubscriptionEditor } from "@/components/subscription-editor";
import { RecModelSelect } from "@/components/rec-model-select";
import {
  getThemeOverride,
  getUserSubscriptions,
  getRecModel,
} from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const [user, theme, subs, recModel] = await Promise.all([
    getCurrentUser(),
    getThemeOverride(),
    getUserSubscriptions(),
    getRecModel(),
  ]);

  // Middleware gates this route; the null check is for TypeScript.
  if (!user) return null;

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
          [Settings · {user.displayName}]
        </p>
        <h1 className="mt-3 font-display text-2xl font-black text-ink leading-none sm:text-4xl">
          Settings
        </h1>
        <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
      </header>

      <div className="space-y-16">
        <section>
          <ThemeSelect current={theme} />
        </section>
        <section>
          <SubscriptionEditor active={subs} />
        </section>
        {recModel && (
          <section>
            <RecModelSelect current={recModel} />
          </section>
        )}
      </div>
    </main>
  );
}
