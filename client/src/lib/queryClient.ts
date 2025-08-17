
// Modified queryClient.ts
// Replace your existing client/src/lib/queryClient.ts with this updated version

import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { medicationStorage } from './medicationStorage';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Enhanced query function that uses Google Sheets as backup
export const getQueryFn: (options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;

    // Special handling for medications endpoint
    if (url === "/api/medications") {
      try {
        // Try the regular API first
        const res = await fetch(url, { credentials: "include" });

        if (res.status === 401 && unauthorizedBehavior === "returnNull") {
          return null;
        }

        if (res.ok) {
          const data = await res.json();
          // Also save to our backup storage
          await medicationStorage.saveMedications(data);
          return data;
        }

        // If API fails, try to get from Google Sheets backup
        console.warn('API request failed, trying Google Sheets backup...');
        const backupData = await medicationStorage.getMedications();
        return backupData;

      } catch (error) {
        console.error('API and backup failed:', error);
        // Return empty array instead of throwing to prevent app crash
        return [];
      }
    }

    // For other endpoints, use original logic
    const res = await fetch(url, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds - reduced from Infinity to allow periodic refresh
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
