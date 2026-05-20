import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLatestRunsForCurrentUser } from "@/app/actions/recommendations";
import { RecsView } from "@/components/recs-view";

export default async function RecsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const { runs, userSubKeys, partnerDisplayName, disagreedShows } =
    await getLatestRunsForCurrentUser();

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-8 sm:py-12">
      {/* RecsView owns the masthead — the Refresh button it carries is a
          live, page-level control, so the header sits with it. */}
      <RecsView
        initial={runs}
        userSubKeys={userSubKeys}
        partnerDisplayName={partnerDisplayName}
        disagreedShows={disagreedShows}
        viewerUsername={user.username}
      />
    </main>
  );
}
