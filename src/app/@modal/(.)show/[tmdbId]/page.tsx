import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadShowDetail } from "@/lib/show-detail";
import { ShowDetailDrawer } from "@/components/show-detail-drawer";

type PageProps = {
  params: Promise<{ tmdbId: string }>;
  searchParams: Promise<{ recItem?: string }>;
};

// Phase 20b — intercepting route. Reached when /show/[tmdbId] is
// navigated to from a sibling root-level route (/recs, /in-progress,
// /, etc.). Renders the Show Detail body inside a Radix Dialog drawer
// so the originating list stays visible underneath with scroll
// position preserved. Cold loads / shared-URL visits go through the
// non-intercepted page at src/app/show/[tmdbId]/page.tsx instead.
export default async function ShowDetailModal({
  params,
  searchParams,
}: PageProps) {
  const { tmdbId: tmdbIdStr } = await params;
  const { recItem } = await searchParams;
  const tmdbId = Number(tmdbIdStr);
  if (!Number.isFinite(tmdbId)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recItemId = recItem ? Number(recItem) : null;
  const view = await loadShowDetail(
    tmdbId,
    user.id,
    recItemId != null && Number.isFinite(recItemId) ? recItemId : null,
  );
  if (!view) notFound();

  return <ShowDetailDrawer view={view} />;
}
