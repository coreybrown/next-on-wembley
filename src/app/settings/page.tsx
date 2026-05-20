import { ThemeSelect } from "@/components/theme-select";
import { SubscriptionEditor } from "@/components/subscription-editor";
import { RecModelSelect } from "@/components/rec-model-select";
import { BudgetStatusCard } from "@/components/budget-status";
import {
  getThemeOverride,
  getUserSubscriptions,
  getRecModel,
} from "@/lib/settings";
import { getBudgetStatus } from "@/lib/llm-budget";
import { getCurrentUser } from "@/lib/auth";

// Toggling a subscription here fires a background rec-gen (LLM, 30–60s);
// lift the function ceiling so it isn't killed mid-generation.
export const maxDuration = 60;

export default async function SettingsPage() {
  const [user, theme, subs, recModel, budget] = await Promise.all([
    getCurrentUser(),
    getThemeOverride(),
    getUserSubscriptions(),
    getRecModel(),
    getBudgetStatus(),
  ]);

  // Middleware gates this route; the null check is for TypeScript.
  if (!user) return null;

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-8 sm:py-12">
      <header className="mb-10">
        <p className="font-mono text-mono uppercase text-ink-muted">
          [Settings]
        </p>
        <h1 className="mt-3 font-display text-4xl font-black text-ink leading-none">
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
        <section>
          <BudgetStatusCard status={budget} />
        </section>
      </div>
    </main>
  );
}
