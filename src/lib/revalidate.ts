import "server-only";
import { revalidatePath } from "next/cache";

// Phase 34. Named helpers replacing the 20-ish ad-hoc revalidatePath
// strings scattered across server actions. Each call site previously
// picked its own subset — and the picks drifted out of sync with
// what the data actually drives (e.g. deleteWatchEntry forgot
// /in-progress; bumpSeasonAction forgot /recs even though a
// continuation rec depends on the bumped season).
//
// The rule of thumb the helpers encode:
// - revalidateRecSurfaces()   — vote / rec-only mutations.
// - revalidateWatchSurfaces() — watch-history surfaces only.
// - revalidateAll()           — anything that crosses both (the
//                                  default for status / season /
//                                  rating / watch-entry CRUD, since
//                                  rec cards' WTW + Continuation
//                                  states depend on watch-entry data).

const REC_SURFACES = ["/recs"] as const;
const WATCH_SURFACES = ["/", "/in-progress"] as const;

export function revalidateRecSurfaces(): void {
  for (const path of REC_SURFACES) revalidatePath(path);
}

export function revalidateWatchSurfaces(): void {
  for (const path of WATCH_SURFACES) revalidatePath(path);
}

export function revalidateAll(): void {
  revalidateRecSurfaces();
  revalidateWatchSurfaces();
}
