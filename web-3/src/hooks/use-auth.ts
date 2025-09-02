"use client";

import { useSession as useNextAuthSession } from "next-auth/react";

// Wrapper around NextAuth's useSession for consistent usage
export function useSession() {
  return useNextAuthSession();
}

// Export the actual hook for convenience
export const useAuthSession = useNextAuthSession;