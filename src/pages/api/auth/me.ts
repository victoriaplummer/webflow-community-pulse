import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { validateSession, getSessionIdFromCookie } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);

  const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

  if (!sessionId) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const result = await validateSession(db, sessionId);

  if (!result) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      avatarUrl: result.user.avatarUrl,
    },
  });
};
