import { type NextRequest, NextResponse } from "next/server";

import { getPublishedApiOrigin } from "@/lib/public-origins";

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
  const target = new URL(
    `/v1/${path.join("/")}`,
    `${getPublishedApiOrigin()}/`
  );
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

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
