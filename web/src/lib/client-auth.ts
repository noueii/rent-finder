'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Hook to get the current session client-side
 */
export function useAuth() {
  const { data: session, status } = useSession();
  
  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === "loading",
    status,
  };
}

/**
 * Hook to require authentication - redirects to sign in if not authenticated
 * @param redirectTo - The URL to redirect to after sign in (default: current page)
 */
export function useRequireAuth(redirectTo?: string) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === "loading") return; // Still loading
    
    if (!session) {
      const callbackUrl = redirectTo || window.location.pathname;
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [session, status, router, redirectTo]);
  
  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === "loading",
  };
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  const { data: session } = useSession();
  
  // For now, any authenticated user is admin
  // In the future, check for specific role:
  // return session?.user?.role === 'admin';
  
  return !!session?.user;
}