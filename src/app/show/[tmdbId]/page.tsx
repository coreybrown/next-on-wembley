import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth";
import { loadShowDetail } from "@/lib/show-detail";
import { ShowDetailBody } from "@/components/show-detail-body";

type PageProps = {
  params: Promise<{ tmdbId: string }>;
  searchParams: Promise<{ recItem?: string }>;
};

export default async function ShowDetailPage({
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

  return (
    <main className="bg-page min-h-svh mx-auto max-w-3xl px-6 pb-16 pt-10">
      <nav className="mb-6">
        <Link
          href="/recs"
          className="
            inline-flex items-center gap-1
            font-mono text-mono uppercase text-ink-muted
            transition-colors hover:text-ink
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          <ArrowLeft size={14} weight="bold" aria-hidden />
          <span>Back to recs</span>
        </Link>
      </nav>
      <ShowDetailBody view={view} />
    </main>
  );
}
