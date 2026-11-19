import { QueryClient } from '@tanstack/react-query';

/**
 * Global singleton QueryClient instance with zero-stale real-time ERP defaults.
 *
 * Configured with:
 * - staleTime: 0 (data is immediately considered stale so any mount or invalidation fetches fresh data)
 * - refetchOnMount: 'always' (navigating across pages always verifies with the server)
 * - refetchOnWindowFocus: true (re-focusing tab checks for concurrent updates)
 * - retry: 1 (fast failure recovery without UI lockup)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 10, // 10 minutes cache retention
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

