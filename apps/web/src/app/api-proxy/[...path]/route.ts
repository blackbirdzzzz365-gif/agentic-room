import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

function resolveProxyApiKey(): string | null {
  const explicitKey = process.env.AGENT_API_KEY?.trim();
  if (explicitKey) {
    return explicitKey;
  }

  const rawMap = process.env.AGENT_API_KEYS;
  if (!rawMap) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawMap) as Record<string, string>;
    const [firstKey] = Object.keys(parsed);
    return firstKey ?? null;
  } catch {
    return null;
  }
}

async function forwardRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>
) {
  const { path } = await paramsPromise;
  const targetPath = path.join("/");
  const targetUrl = new URL(`${API_BASE_URL}/${targetPath}`);
  targetUrl.search = request.nextUrl.search;

  const requiresApiKey = request.method !== "GET" && request.method !== "HEAD";
  const apiKey = resolveProxyApiKey();

  if (requiresApiKey && !apiKey) {
    return Response.json(
      {
        message:
          "Mutation proxy is missing AGENT_API_KEY or AGENT_API_KEYS in the web runtime. Browser mutations are blocked until the FE server receives an API key.",
      },
      { status: 500 }
    );
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  const upstream = await fetch(targetUrl, init);
  const responseBody = await upstream.text();
  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");

  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(request, context.params);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return forwardRequest(request, context.params);
}
