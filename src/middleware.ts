import { defineMiddleware } from "astro:middleware";
import { getDb } from "./db/getDb";
import { validateSession, getSessionIdFromCookie } from "./lib/auth";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/pulse/login",
  "/pulse/api/auth/google",
  "/pulse/api/auth/callback",
  "/pulse/api/auth/logout",
  "/pulse/api/admin/export",
  "/pulse/api/admin/sync",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return next();
  }

  // Skip middleware for non-pulse routes (if any)
  if (!pathname.startsWith("/pulse")) {
    return next();
  }

  // Check for session
  const sessionId = getSessionIdFromCookie(
    context.request.headers.get("cookie")
  );

  if (!sessionId) {
    return context.redirect("/pulse/login");
  }

  // Validate session
  const db = getDb(context.locals);
  const result = await validateSession(db, sessionId);

  if (!result) {
    return context.redirect("/pulse/login");
  }

  // Attach user to locals for use in pages/API routes
  context.locals.user = result.user;

  return next();
});
