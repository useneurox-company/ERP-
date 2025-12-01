import { QueryClient, QueryFunction } from "@tanstack/react-query";

export function getCurrentUserId(): string {
  const storedUserId = localStorage.getItem("currentUserId");
  return storedUserId || "";
}

export function setCurrentUserId(userId: string) {
  localStorage.setItem("currentUserId", userId);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export function getCurrentUserRole(): string {
  const storedRole = localStorage.getItem("userRole");
  if (storedRole) {
    try {
      const role = JSON.parse(storedRole);
      // Encode role name to handle non-ASCII characters (e.g., Cyrillic)
      return role?.name ? encodeURIComponent(role.name) : "";
    } catch {
      return "";
    }
  }
  return "";
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const headers: Record<string, string> = {
    "X-User-Id": getCurrentUserId(),
    "X-User-Role": getCurrentUserRole(),
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  // For DELETE requests, return null (no content expected)
  if (method === 'DELETE' && res.status === 204) {
    return null as T;
  }

  // For all other requests, parse and return JSON
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: {
        "X-User-Id": getCurrentUserId(),
        "X-User-Role": getCurrentUserRole(),
      },
    });

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
      staleTime: 0, // Всегда делать запрос
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
