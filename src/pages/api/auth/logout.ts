import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import {
  deleteSession,
  getSessionIdFromCookie,
  createLogoutCookie,
} from "../../../lib/auth";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);

  const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

  if (sessionId) {
    await deleteSession(db, sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/pulse/login",
      "Set-Cookie": createLogoutCookie(),
    },
  });
};

// Also allow GET for simple logout links
export const GET: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);

  const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

  if (sessionId) {
    await deleteSession(db, sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/pulse/login",
      "Set-Cookie": createLogoutCookie(),
    },
  });
};
