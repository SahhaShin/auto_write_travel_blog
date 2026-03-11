// 네이버 블로그 글쓰기 페이지에서 제목/본문 자동 입력

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'INSERT_DRAFT') return;

  const { title, content } = message.draft;

  (async () => {
    try {
      await insertTitle(title);
      await sleep(600);
      await insertContent(content);
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  })();

  return true; // 비동기 응답 유지
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 제목 입력 ──────────────────────────────────────────
async function insertTitle(title) {
  if (!title) return;

  const selectors = [
    '.se-title-input',
    '[contenteditable="true"].se-title-input',
    '[data-placeholder="제목"]',
  ];

  let el = findElement(selectors);

  // iframe 내부 탐색
  if (!el) {
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        for (const sel of selectors) {
          el = doc.querySelector(sel);
          if (el) break;
        }
        if (el) break;
      } catch (e) {}
    }
  }

  if (el) {
    el.focus();
    await sleep(200);
    // 기존 내용 전체 선택 후 교체
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, title);
  }
}

// ── 본문 입력: 클립보드 붙여넣기 방식 ─────────────────
async function insertContent(htmlContent) {
  if (!htmlContent) return;

  // 에디터 본문 영역 포커스
  const editorSelectors = [
    '.se-content',
    '[role="textbox"]',
    '.se-main-container [contenteditable="true"]',
    '.se-component-content',
  ];

  let editorEl = findElement(editorSelectors);
  let targetDoc = document;

  if (!editorEl) {
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        for (const sel of editorSelectors) {
          editorEl = doc.querySelector(sel);
          if (editorEl) { targetDoc = doc; break; }
        }
        if (editorEl) break;
      } catch (e) {}
    }
  }

  if (!editorEl) {
    throw new Error('SmartEditor 본문 영역을 찾을 수 없습니다.');
  }

  // 에디터 클릭 후 포커스
  editorEl.click();
  await sleep(400);
  editorEl.focus();
  await sleep(300);

  // HTML을 클립보드에 쓰기
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([stripHtml(htmlContent)], { type: 'text/plain' }),
      })
    ]);
  } catch (e) {
    // clipboard API 실패 시 execCommand fallback
    const tempEl = document.createElement('div');
    tempEl.innerHTML = htmlContent;
    document.body.appendChild(tempEl);
    const range = document.createRange();
    range.selectNodeContents(tempEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    document.body.removeChild(tempEl);
  }

  await sleep(300);

  // 에디터에 붙여넣기 (Ctrl+V 시뮬레이션)
  editorEl.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'v', code: 'KeyV', ctrlKey: true, bubbles: true
  }));

  // execCommand paste 도 시도
  editorEl.focus();
  document.execCommand('paste');

  await sleep(500);
}

// ── 유틸 ──────────────────────────────────────────────
function findElement(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
