import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

// Next 16 renamed the `middleware` file convention to `proxy`.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const isAuthed = !!session.userId;

  if (!isAuthed && !isPublic) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  if (isAuthed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  // Skip Next internals and static assets — including the metadata icon
  // routes (/icon.svg, /apple-icon.png) — so the proxy doesn't run
  // on every chunk and favicons aren't auth-gated behind /login.
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|ico|jpe?g|gif|webp)$).*)",
  ],
};
