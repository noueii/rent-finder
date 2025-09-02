import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

/**
 * Get the current session and optionally require authentication
 * @param requireAuth - If true, redirects to sign in page if not authenticated
 * @returns The session or null
 */
export async function getSession(requireAuth = false) {
  const session = await auth();
  
  if (requireAuth && !session) {
    redirect("/auth/signin");
  }
  
  return session;
}

/**
 * Check if the current user has admin role
 * @returns boolean indicating admin status
 */
export async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

/**
 * Require admin role or redirect
 * @param redirectTo - URL to redirect if not admin (default: home)
 */
export async function requireAdmin(redirectTo = "/") {
  const session = await auth();
  
  if (!session || session.user.role !== "ADMIN") {
    redirect(redirectTo);
  }
  
  return session;
}

/**
 * Get user ID from session
 * @param requireAuth - If true, throws error if not authenticated
 * @returns User ID or null
 */
export async function getUserId(requireAuth = false): Promise<string | null> {
  const session = await auth();
  
  if (requireAuth && !session?.user?.id) {
    throw new Error("User not authenticated");
  }
  
  return session?.user?.id ?? null;
}