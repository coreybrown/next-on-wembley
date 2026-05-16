import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
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
  // Skip static assets and Next internals so middleware doesn't run on every chunk.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
