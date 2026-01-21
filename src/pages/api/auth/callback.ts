import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import {
  createGoogleClient,
  getOrCreateUser,
  createSession,
  createSessionCookie,
  type GoogleUserInfo,
} from "../../../lib/auth";

// Helper to get cookie value
function getCookieValue(cookies: string, name: string): string | null {
  const cookie = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return cookie?.split("=")[1] || null;
}

export const GET: APIRoute = async ({ locals, url, request }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  // Get code and state from URL params
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/pulse/login?error=missing_params",
      },
    });
  }

  // Get stored state and code verifier from cookies
  const cookies = request.headers.get("cookie") || "";
  const storedState = getCookieValue(cookies, "oauth_state");
  const codeVerifier = getCookieValue(cookies, "oauth_code_verifier");

  if (!storedState || storedState !== state) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/pulse/login?error=invalid_state",
      },
    });
  }

  if (!codeVerifier) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/pulse/login?error=missing_verifier",
      },
    });
  }

  try {
    // Build redirect URI - must match what was sent in the authorization request
    const host = request.headers.get("host") || url.host;
    const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    const redirectUri = `${protocol}://${host}/pulse/api/auth/callback`;

    console.log("OAuth callback redirect URI:", redirectUri);

    const google = createGoogleClient(clientId, clientSecret, redirectUri);

    // Exchange code for tokens with PKCE code verifier
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch user info from Google");
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;

    // Get or create user in database
    const user = await getOrCreateUser(db, googleUser);

    // Create session
    const sessionId = await createSession(db, user.id);

    // Clear OAuth cookies and set session cookie
    const clearStateCookie = "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
    const clearVerifierCookie = "oauth_code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

    return new Response(null, {
      status: 302,
      headers: [
        ["Location", "/pulse"],
        ["Set-Cookie", clearStateCookie],
        ["Set-Cookie", clearVerifierCookie],
        ["Set-Cookie", createSessionCookie(sessionId)],
      ],
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/pulse/login?error=oauth_failed",
      },
    });
  }
};
