import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Protected app routes
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/software/new") ||
    pathname.startsWith("/stacks") ||
    pathname.startsWith("/badges")
  ) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Admin routes
  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if ((session.user as { type?: string }).type !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === "/login" || pathname === "/register") && session?.user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/software/new/:path*",
    "/stacks/:path*",
    "/badges/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
