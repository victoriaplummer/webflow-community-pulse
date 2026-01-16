// Authentication utilities for Google OAuth
import { Google } from "arctic";
import { eq, and, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users, sessions, type User } from "../db/schema";

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface GoogleUserInfo {
  sub: string; // Google ID
  email: string;
  name?: string;
  picture?: string;
}

// Generate a random session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Create Google OAuth client
export function createGoogleClient(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Google {
  return new Google(clientId, clientSecret, redirectUri);
}

// Create a new session for a user
export async function createSession(
  db: DrizzleD1Database,
  userId: number
): Promise<string> {
  const sessionId = generateSessionId();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: now,
  });

  return sessionId;
}

// Validate a session and return the user
export async function validateSession(
  db: DrizzleD1Database,
  sessionId: string
): Promise<{ user: User; session: typeof sessions.$inferSelect } | null> {
  if (!sessionId) return null;

  const now = Math.floor(Date.now() / 1000);

  // Get session with user
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (result.length === 0) return null;

  const { session, user } = result[0];

  // Check if session is expired
  if (session.expiresAt < now) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return { user, session };
}

// Delete a session (logout)
export async function deleteSession(
  db: DrizzleD1Database,
  sessionId: string
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// Clean up expired sessions
export async function cleanupExpiredSessions(
  db: DrizzleD1Database
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning();
  return result.length;
}

// Get or create user from Google profile
export async function getOrCreateUser(
  db: DrizzleD1Database,
  googleUser: GoogleUserInfo
): Promise<User> {
  const now = Math.floor(Date.now() / 1000);

  // Check if user exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.sub))
    .limit(1);

  if (existing.length > 0) {
    // Update last login
    await db
      .update(users)
      .set({ lastLogin: now })
      .where(eq(users.id, existing[0].id));
    return { ...existing[0], lastLogin: now };
  }

  // Create new user
  const newUser = await db
    .insert(users)
    .values({
      email: googleUser.email,
      name: googleUser.name || null,
      avatarUrl: googleUser.picture || null,
      googleId: googleUser.sub,
      createdAt: now,
      lastLogin: now,
    })
    .returning();

  return newUser[0];
}

// Cookie helpers
export const SESSION_COOKIE_NAME = "pulse_session";

export function createSessionCookie(sessionId: string): string {
  const maxAge = SESSION_DURATION_MS / 1000;
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function createLogoutCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === SESSION_COOKIE_NAME) {
      return value || null;
    }
  }
  return null;
}
