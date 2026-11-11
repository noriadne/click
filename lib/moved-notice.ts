/**
 * 서비스 이전 안내 페이지 (v1.07).
 *
 * 이 저장소(Vercel 배포)는 더 이상 서비스하지 않고, 모든 주소에서 이 안내만 보여준다.
 * 새 서비스는 별도 소스로 NEW_SITE_URL 에서 운영된다. (데이터 이관 완료)
 * proxy.ts 가 인증 여부와 상관없이 이 HTML 을 그대로 응답한다.
 * 앱 화면(layout 의 로그인 게이트 등)을 거치지 않도록 일반 페이지가 아니라 proxy 응답으로 만든다.
 */
export const NEW_SITE_URL = "https://clickboardgame.com";

const NEW_SITE_LABEL = "clickboardgame.com";

/**
 * 운영자 전용 우회 코드 입력 폼 포함 여부를 isUnlockForm 으로 받는다.
 * unlockError 가 true 면 코드가 틀렸다는 안내를 보여준다.
 */
export function movedNoticeHtml(options?: { unlockError?: boolean }): string {
  const unlockError = options?.unlockError ?? false;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Click 모임일정이 새 주소로 이전했어요</title>
<link rel="icon" href="/icon.png">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: #09090b;
    color: #e4e4e7;
    font-family: system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    line-height: 1.6;
  }
  main {
    width: 100%;
    max-width: 400px;
    padding: 28px 24px;
    border: 1px solid #27272a;
    border-radius: 16px;
    background: #18181b;
    text-align: center;
  }
  .brand { margin: 0 0 20px; font-size: 15px; font-weight: 700; color: #a5b4fc; }
  h1 { margin: 0 0 12px; font-size: 20px; color: #fafafa; }
  p { margin: 0 0 12px; font-size: 14px; color: #a1a1aa; }
  .address {
    margin: 20px 0 8px;
    font-size: 17px;
    font-weight: 700;
    color: #fafafa;
    word-break: break-all;
  }
  .button {
    display: block;
    margin: 16px 0 0;
    padding: 12px 16px;
    border-radius: 12px;
    background: #6366f1;
    color: #ffffff;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    border: none;
    width: 100%;
    font-family: inherit;
    cursor: pointer;
  }
  .button:hover { background: #4f46e5; }
  .button:focus-visible { outline: 3px solid #c7d2fe; outline-offset: 3px; }
  details { margin-top: 24px; text-align: left; }
  summary {
    cursor: pointer;
    font-size: 12px;
    color: #52525b;
    text-align: center;
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  .unlock-form { margin-top: 12px; display: flex; gap: 8px; }
  .unlock-input {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #3f3f46;
    background: #09090b;
    color: #fafafa;
    font-size: 14px;
  }
  .unlock-input:focus-visible { outline: 2px solid #818cf8; }
  .unlock-submit {
    padding: 10px 14px;
    border-radius: 10px;
    border: none;
    background: #3f3f46;
    color: #fafafa;
    font-size: 14px;
    cursor: pointer;
  }
  .unlock-submit:hover { background: #52525b; }
  .unlock-error { margin-top: 8px; font-size: 12px; color: #f87171; }
</style>
</head>
<body>
<main>
  <p class="brand">Click 모임일정</p>
  <h1>새 주소로 이전했어요</h1>
  <p>모임 일정 서비스가 새 사이트로 옮겨졌어요.<br>앞으로는 아래 주소로 접속해 주세요.</p>
  <p class="address">${NEW_SITE_LABEL}</p>
  <a class="button" href="${NEW_SITE_URL}">새 사이트로 이동하기</a>
  <details ${unlockError ? "open" : ""}>
    <summary>운영자 확인</summary>
    <form class="unlock-form" method="GET" action="/">
      <input
        class="unlock-input"
        type="password"
        name="code"
        inputmode="numeric"
        autocomplete="off"
        placeholder="코드 입력"
        aria-label="운영자 코드"
      >
      <button class="unlock-submit" type="submit">확인</button>
    </form>
    ${unlockError ? '<p class="unlock-error">코드가 올바르지 않아요.</p>' : ""}
  </details>
</main>
</body>
</html>`;
}
