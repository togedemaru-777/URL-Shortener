import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { findUrlByShortCode, saveUrl } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2048;

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/*
 * createShortCode()
 *
 * 원본 URL을 입력받아 SHA-256 해시를 생성하고,
 * 그 값을 이용해 6자리 short code를 만듭니다.
 * 같은 URL은 항상 같은 코드가 나오므로 중복 처리의 기반이 됩니다.
 */
function createShortCode(originalUrl, length = 6) {
  const hex = createHash("sha256").update(originalUrl).digest("hex");

  let code = "";

  for (let i = 0; i < length; i++) {
    const value = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    code += ALPHABET[value % ALPHABET.length];
  }

  return code;
}

/*
 * getServiceHosts()
 *
 * 지금 요청을 처리하고 있는 "내 서비스"의 host 목록을 모읍니다.
 * Vercel은 proxy를 거치므로 x-forwarded-host를 함께 확인합니다.
 */
function getServiceHosts(request) {
  const hosts = new Set();

  const add = (value) => {
    if (!value) return;
    const host = value.split(",")[0].trim().toLowerCase();
    if (host) hosts.add(host);
  };

  add(request.headers.get("x-forwarded-host"));
  add(request.headers.get("host"));
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  try {
    add(new URL(request.url).host);
  } catch {
    // ignore
  }

  return hosts;
}

/*
 * getBaseUrl()
 *
 * 응답으로 돌려줄 shortUrl의 origin을 만듭니다.
 */
function getBaseUrl(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || "").split(",")[0].trim();

  if (!host) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = (forwardedProto || "").split(",")[0].trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}

/*
 * POST()
 *
 * 클라이언트가 보낸 URL을 검사하고,
 * 문제가 없으면 short URL을 생성하여 반환합니다.
 */
export async function POST(request) {
  try {
    /*
     * 1. 요청 body 읽기
     */
    const body = await request.json().catch(() => null);

    const raw = body?.originalUrl;
    const originalUrl = typeof raw === "string" ? raw.trim() : "";

    /*
     * 2. URL이 입력되지 않은 경우 → 400 Bad Request
     */
    if (!originalUrl) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_URL",
            message: "Original URL is required.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 3. URL이 너무 긴 경우 → 400 Bad Request
     */
    if (originalUrl.length > MAX_URL_LENGTH) {
      return NextResponse.json(
        {
          error: {
            code: "URL_TOO_LONG",
            message: `URL must be ${MAX_URL_LENGTH} characters or fewer.`,
          },
        },
        { status: 400 }
      );
    }

    /*
     * 4. URL 형식 검사 → 형식이 틀리면 400 Bad Request
     */
    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message: "URL must start with http:// or https://.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 5. 프로토콜 검사
     *
     * http, https만 허용합니다. (javascript:, data: 등은 차단)
     */
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message: "URL must start with http:// or https://.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 6. 자기 서비스 URL 단축 방지
     *
     * 내 Shortener 주소를 다시 단축하면 무한 redirect가 생기므로
     * host가 같으면 경로나 http/https 여부와 무관하게 차단합니다.
     */
    const serviceHosts = getServiceHosts(request);

    if (serviceHosts.has(parsedUrl.host.toLowerCase())) {
      return NextResponse.json(
        {
          error: {
            code: "SELF_URL_NOT_ALLOWED",
            message: "This service's own URL cannot be shortened.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 7. Short code 생성
     */
    const shortCode = createShortCode(originalUrl);
    const shortUrl = `${getBaseUrl(request)}/${shortCode}`;

    /*
     * 8. 동일 URL 중복 처리
     *
     * 같은 URL은 같은 shortCode가 나오므로,
     * 이미 저장되어 있으면 새로 만들지 않고 기존 값을 돌려줍니다.
     */
    const existingUrl = await findUrlByShortCode(shortCode);

    if (existingUrl) {
      return NextResponse.json(
        {
          shortCode,
          shortUrl,
          originalUrl,
          duplicated: true,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    /*
     * 9. 저장 후 생성 성공 → 201 Created
     */
    await saveUrl(shortCode, originalUrl);

    return NextResponse.json(
      {
        shortCode,
        shortUrl,
        originalUrl,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    /*
     * 10. 서버 내부 오류 → 500 Internal Server Error
     */
    console.error("Failed to create short URL", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create short URL.",
        },
      },
      { status: 500 }
    );
  }
}
