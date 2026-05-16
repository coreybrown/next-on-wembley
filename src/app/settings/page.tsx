import { ThemeSelect } from "@/components/theme-select";
import { SubscriptionEditor } from "@/components/subscription-editor";
import { getThemeOverride, getUserSubscriptions } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const [user, theme, subs] = await Promise.all([
    getCurrentUser(),
    getThemeOverride(),
    getUserSubscriptions(),
  ]);

  // Middleware gates this route; the null check is for TypeScript.
  if (!user) return null;

  return (
    <main className="bg-page min-h-svh px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <p className="font-mono text-mono uppercase text-ink-muted">
            [Settings · {user.displayName}]
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-ink leading-none">
            Settings
          </h1>
          <div aria-hidden className="mx-auto mt-3 h-[2px] w-16 bg-accent-sharp" />
        </header>

        <div className="mt-16 space-y-16">
          <section>
            <ThemeSelect current={theme} />
          </section>
          <section>
            <SubscriptionEditor active={subs} />
          </section>
        </div>
      </div>
    </main>
  );
}
