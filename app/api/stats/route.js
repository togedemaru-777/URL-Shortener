import {
  getSummaryStats,
  getTopUrl,
  getUrlStats,
} from "../../../lib/stats";

import { authenticate } from "../../../lib/auth";
import { authorize } from "../../../lib/authorization";

export const dynamic = "force-dynamic";

function authenticationRequiredResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
      "Cache-Control": "no-store",
    },
  });
}

function forbiddenResponse() {
  return new Response("Forbidden", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request) {
  // 인증/인가를 DB 조회보다 먼저 검사해야
  // 인증 없는 요청에 항상 401이 내려갑니다.
  const user = authenticate(request);
  if (!user) return authenticationRequiredResponse();
  if (!authorize(user, "stats:read")) return forbiddenResponse();

  try {
    const summary = await getSummaryStats();
    const topUrl = await getTopUrl();
    const urls = await getUrlStats();

    return Response.json(
      {
        summary: {
          ...summary,
          topUrl,
        },
        urls,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {
    console.error("Failed to load stats", error);

    return Response.json(
      {
        error: {
          code: "STATS_ERROR",
          message: "Failed to load stats.",
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
