"use client";

import { useState } from "react";

const MAX_URL_LENGTH = 2048;

function validateUrl(value) {
  const trimmedUrl = value.trim();

  // TODO 1: 빈 값 검증
  if (trimmedUrl.length === 0) {
    return "URL을 입력해 주세요.";
  }

  // TODO 2: 최대 길이 검증
  if (trimmedUrl.length > MAX_URL_LENGTH) {
    return `URL은 ${MAX_URL_LENGTH}자 이하로 입력해 주세요.`;
  }

  // TODO 3: http:// 또는 https:// 시작 여부 검증
  if (
    !trimmedUrl.startsWith("http://") &&
    !trimmedUrl.startsWith("https://")
  ) {
    return "URL은 http:// 또는 https://로 시작해야 합니다.";
  }

  // TODO 4: 올바른 URL 형식 검증
  let parsedUrl;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return "올바른 URL 형식으로 입력해 주세요.";
  }

  return null;
}

export default function Home() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    setOriginalUrl(event.target.value);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setResult("");

    const validationError = validateUrl(originalUrl);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "요청 처리에 실패했습니다.");
        return;
      }

      setResult(data.shortUrl);
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="url-card" aria-labelledby="page-title">
        <div className="week-label">CLOUD COMPUTING</div>

        <div className="intro">
          <h1 id="page-title">URL Shortener</h1>
          <p>
            긴 URL을 입력하고, 안전하게 처리할 수 있는 값인지 확인해 보세요.
          </p>
        </div>

        <form className="url-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="original-url">줄이고 싶은 URL</label>
          <div className="input-row">
            <input
              id="original-url"
              name="originalUrl"
              type="text"
              inputMode="url"
              placeholder="https://example.com/very-long-url"
              value={originalUrl}
              onChange={handleChange}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "url-error" : undefined}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Checking..." : "Shorten"}
            </button>
          </div>

          <div className="message-area" aria-live="polite">
            {error && (
              <p id="url-error" className="message message-error" role="alert">
                {error}
              </p>
            )}

            {isLoading && (
              <p className="message message-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                입력한 URL을 확인하고 있습니다.
              </p>
            )}

            {result && (
              <p className="message message-success" role="status">
                {result}
              </p>
            )}
          </div>
        </form>

        <aside className="practice-note">
          <span aria-hidden="true">✓</span>
          <p>
            이번 주에는 <code>Route Handler</code>를 만들고 Backend API와
            연결합니다.
          </p>
        </aside>
      </section>
    </main>
  );
}
