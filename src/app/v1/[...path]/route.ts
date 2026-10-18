import { type NextRequest, NextResponse } from "next/server";

import {
  getPublishedApiOrigin,
  PRODUCTION_API_ORIGIN,
} from "@/lib/public-origins";

export const dynamic = "force-dynamic";

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

const proxy = async (
  request: NextRequest,
  context: ProxyContext
): Promise<NextResponse> => {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ title: "Not found." }, { status: 404 });
  }

  const { path } = await context.params;
  const configuredOrigin = getPublishedApiOrigin();
  const upstreamOrigin = loopbackOrigin(configuredOrigin)
    ? PRODUCTION_API_ORIGIN
    : configuredOrigin;
  const target = new URL(`/v1/${path.join("/")}`, `${upstreamOrigin}/`);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  try {
    const upstream = await fetch(target, {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      headers,
      method: request.method,
      redirect: "manual",
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    return new NextResponse(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch {
    return NextResponse.json(
      {
        detail: "The upstream API did not answer.",
        status: 504,
        title: "Gateway timeout.",
      },
      { status: 504 }
    );
  }
};

function loopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
