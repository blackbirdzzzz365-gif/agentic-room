const getApiBase = () =>
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(`${getApiBase()}${normalizePath(path)}`, {
      cache: "no-store",
      ...options,
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type ProxyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ProxyRequestOptions {
  method?: ProxyMethod;
  body?: unknown;
}

interface ProxyJsonResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function proxyJson<T>(
  path: string,
  options: ProxyRequestOptions = {}
): Promise<ProxyJsonResult<T>> {
  const method = options.method ?? "GET";

  try {
    const res = await fetch(`/api-proxy${normalizePath(path)}`, {
      method,
      cache: "no-store",
      headers:
        method === "GET"
          ? undefined
          : {
              "Content-Type": "application/json",
            },
      body:
        method === "GET" || options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    });

    if (!res.ok) {
      const errorPayload = await res
        .json()
        .catch(async () => ({ message: await res.text() }));

      return {
        data: null,
        error:
          (errorPayload as { message?: string; error?: string }).message ??
          (errorPayload as { message?: string; error?: string }).error ??
          res.statusText ??
          "Request failed",
        status: res.status,
      };
    }

    const data = await res.json().catch(() => null);
    return {
      data: data as T,
      error: null,
      status: res.status,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error",
      status: 0,
    };
  }
}

export async function readProxyJson<T>(path: string) {
  return proxyJson<T>(path, { method: "GET" });
}

export async function mutateJson<T>(
  path: string,
  body?: unknown,
  method: Exclude<ProxyMethod, "GET"> = "POST"
) {
  return proxyJson<T>(path, { method, body });
}

export const swrFetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed: ${url}`);
  }
  return res.json() as Promise<T>;
};
