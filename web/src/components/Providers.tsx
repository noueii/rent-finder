'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, trpcClient } from '~/utils/api';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Always stale
        cacheTime: 0, // No cache
        refetchOnWindowFocus: true, // Always refetch
        refetchOnMount: true, // Always refetch
        retry: false, // No retries
      },
    },
  }));

  return (
    <SessionProvider 
      refetchInterval={0} 
      refetchOnWindowFocus={true}
      refetchWhenOffline={false}
    >
      <api.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </api.Provider>
    </SessionProvider>
  );
}