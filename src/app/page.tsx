import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWatchEntries } from "@/app/actions/watch-entries";
import { refreshStaleAcrossHistory } from "@/app/actions/in-progress";
import { Dashboard } from "@/components/dashboard";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  // M5 Phase 30: sweep the user's watch history for stale TMDb metadata
  // BEFORE fetching entries so the dashboard renders with fresh
  // posters / production status / providers. Throttled + per-show
  // errors swallowed inside the helper.
  await refreshStaleAcrossHistory();
  const entries = await getWatchEntries();
  return <Dashboard entries={entries} displayName={user.displayName} />;
}
