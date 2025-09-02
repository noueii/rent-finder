import { getServerSession } from "next-auth/next";
import { authOptions } from "~/lib/auth";
import { redirect } from "next/navigation";

/**
 * Get the current session from the server
 * @returns The session object or null if not authenticated
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get the current session and redirect to sign in if not authenticated
 * @param callbackUrl - The URL to redirect to after sign in
 * @returns The session object (never null due to redirect)
 */
export async function requireAuth(callbackUrl?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    const redirectUrl = callbackUrl || "/";
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(redirectUrl)}`);
  }
  
  return session;
}

/**
 * Check if the current user has admin privileges
 * @returns True if the user is an admin, false otherwise
 */
export async function isAdmin() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return false;
  }
  
  // For now, any authenticated user is considered an admin
  // In the future, you could check for specific roles:
  // return session.user.role === 'admin';
  
  return true;
}

/**
 * Require admin privileges or redirect
 * @param redirectUrl - The URL to redirect to if not admin (default: home)
 * @returns The session object
 */
export async function requireAdmin(redirectUrl: string = "/") {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/admin")}`);
  }
  
  // For now, any authenticated user can access admin
  // In the future, you could check for specific roles:
  // if (session.user.role !== 'admin') {
  //   redirect(redirectUrl);
  // }
  
  return session;
}