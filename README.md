# URL Shortener

과제 제출, URL Shortener 서비스입니다.

## 기능

- URL 단축 (`POST /api/shorten`)
- 단축 URL redirect (`GET /{shortCode}`)
- 클릭 수 집계 및 관리자 통계 (`/admin`, `GET /api/stats`)
- Basic 인증 + 역할 기반 인가 (`proxy.js`, `lib/auth.js`, `lib/authorization.js`)
- **동일 URL 중복 처리**: 이미 단축한 URL은 기존 shortCode를 그대로 반환
- **자기 서비스 URL 단축 방지**: 자신의 호스트로 향하는 URL은 400으로 차단

## 실행 방법

```bash
npm install
npm run dev
```

`.env.local` 파일에 다음 값이 필요합니다.

```text
DATABASE_URL=postgres://...   # Neon 연결 문자열
ADMIN_PASSWORD=...            # /admin, /api/stats Basic 인증 비밀번호
```

Vercel에서는 같은 두 값을 Project Settings → Environment Variables 에 등록합니다.

## 데이터베이스 스키마

4주차 교안의 `urls` 테이블에 6주차 교안의 사용량 컬럼을 합친 형태입니다.

```sql
CREATE TABLE urls (
  short_code      VARCHAR(6)    PRIMARY KEY,
  original_url    VARCHAR(2048) NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  click_count     BIGINT        NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ
);
```

이미 4주차 테이블을 만들어 둔 경우에는 6주차 컬럼만 추가합니다.

```sql
ALTER TABLE urls
ADD COLUMN click_count BIGINT NOT NULL DEFAULT 0,
ADD COLUMN last_clicked_at TIMESTAMPTZ;
```

## API

### POST /api/shorten

Request

```json
{ "originalUrl": "https://example.com/very/long/path" }
```

Response (최초 생성, `201 Created`)

```json
{
  "shortCode": "aB3dEf",
  "shortUrl": "https://my-app.vercel.app/aB3dEf",
  "originalUrl": "https://example.com/very/long/path"
}
```

Response (이미 단축된 URL, `200 OK`) — `shortCode`는 항상 동일합니다.

```json
{
  "shortCode": "aB3dEf",
  "shortUrl": "https://my-app.vercel.app/aB3dEf",
  "originalUrl": "https://example.com/very/long/path",
  "duplicated": true
}
```

오류 응답

| 상황 | status | code |
|---|---|---|
| `originalUrl` 누락 / 빈 문자열 | 400 | `MISSING_URL` |
| 2048자 초과 | 400 | `URL_TOO_LONG` |
| URL 형식 오류, `javascript:` 등 허용하지 않는 프로토콜 | 400 | `INVALID_URL` |
| 자기 서비스 호스트의 URL | 400 | `SELF_URL_NOT_ALLOWED` |
| 서버 내부 오류 | 500 | `INTERNAL_ERROR` |

### GET /{shortCode}

- 존재하면 `307` + `Location: <originalUrl>` + `Cache-Control: no-store`
- 없으면 `404`
- redirect 전에 `click_count`, `last_clicked_at` 을 갱신합니다.

### GET /api/stats

- 인증 없으면 `401` (+ `WWW-Authenticate: Basic`)
- 권한 없으면 `403`
- 성공 시 `summary`(전체 URL 수 / 클릭 수 / 클릭된 URL 수 / 최다 클릭 URL)와 `urls` 목록 반환

## 구현 포인트

### 동일 URL 중복 처리

shortCode는 원본 URL의 SHA-256 해시에서 만들기 때문에 같은 URL이면 항상 같은 코드가 나옵니다.
저장 전에 해당 코드가 이미 있는지 조회하여, 있으면 INSERT 없이 기존 코드를 `200`으로 반환합니다.
동시 요청 대비로 INSERT 에도 `ON CONFLICT DO NOTHING` 을 두었습니다.

### 자기 서비스 URL 단축 방지

Vercel은 proxy를 거치므로 `x-forwarded-host`, `host`, `VERCEL_URL`,
`VERCEL_PROJECT_PRODUCTION_URL` 을 모두 모아 "내 서비스 host" 집합을 만들고,
입력 URL의 host가 그 집합에 있으면 경로나 http/https 여부와 무관하게 `400`으로 차단합니다.
(무한 redirect 방지)


## GitHub에 올리지 말아야 할 것

```text
node_modules/
.next/
.env
.env.local
.vercel/
```
