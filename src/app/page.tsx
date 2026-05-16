import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWatchEntries } from "@/app/actions/watch-entries";
import { Dashboard } from "@/components/dashboard";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const entries = await getWatchEntries();
  return <Dashboard entries={entries} displayName={user.displayName} />;
}
