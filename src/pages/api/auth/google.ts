import type { APIRoute } from "astro";
import { generateCodeVerifier, generateState } from "arctic";
import { createGoogleClient } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, url }) => {
  const env = locals.runtime.env;

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  // Build redirect URI from custom domain if available, otherwise use current origin
  // In production, this should be your custom domain (e.g., https://yoursite.com)
  const customDomain = env.CUSTOM_DOMAIN || url.origin;
  const redirectUri = `${customDomain}/pulse/api/auth/callback`;

  const google = createGoogleClient(clientId, clientSecret, redirectUri);

  // Generate state and code verifier for PKCE
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Generate authorization URL with PKCE
  const scopes = ["openid", "email", "profile"];
  const authUrl = google.createAuthorizationURL(state, codeVerifier, scopes);

  // Store state and code verifier in cookies for validation
  const stateCookie = `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  const verifierCookie = `oauth_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;

  return new Response(null, {
    status: 302,
    headers: [
      ["Location", authUrl.toString()],
      ["Set-Cookie", stateCookie],
      ["Set-Cookie", verifierCookie],
    ],
  });
};
