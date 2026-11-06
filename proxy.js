// proxy.js
// Next.js 16에서는 middleware.js 대신 proxy.js를 사용합니다.
// 이 Proxy는 /admin 페이지가 렌더링되기 전에 인증과 인가를 검사합니다.

import { NextResponse } from "next/server";
import { authenticate } from "./lib/auth";
import { authorize } from "./lib/authorization";

function authenticationRequiredResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
      "Cache-Control": "no-store",
    },
  });
}

function forbiddenResponse() {
  return new NextResponse("Forbidden", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(request) {
  const user = authenticate(request);

  if (!user) {
    return authenticationRequiredResponse();
  }

  if (!authorize(user, "admin:page")) {
    return forbiddenResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
