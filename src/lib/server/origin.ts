import { NextResponse } from "next/server";

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    return NextResponse.json({ error: "Invalid request origin.", code: "invalid_request" }, { status: 403 });
  }
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return NextResponse.json({ error: "Invalid request origin.", code: "invalid_request" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin.", code: "invalid_request" }, { status: 403 });
  }
  return null;
}
