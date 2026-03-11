// 네이버 블로그 글쓰기 페이지에서 제목/본문 자동 입력

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'INSERT_DRAFT') return;

  const { title, content } = message.draft;

  try {
    insertTitle(title);
    setTimeout(() => {
      insertContent(content);
      sendResponse({ success: true });
    }, 800);
  } catch (e) {
    sendResponse({ success: false, error: e.message });
  }

  return true; // 비동기 응답
});

// ── 제목 입력 ──────────────────────────────────────────
function insertTitle(title) {
  if (!title) return;

  const selectors = [
    '.se-title-input',
    '[contenteditable="true"].se-title-input',
    '[data-placeholder="제목"]',
    'div[contenteditable="true"]:first-of-type',
  ];

  let el = null;
  for (const sel of selectors) {
    el = document.querySelector(sel);
    if (el) break;
  }

  if (!el) {
    // iframe 안에서 탐색
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
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
    el.textContent = '';
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, title);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ── 본문 입력 ──────────────────────────────────────────
function insertContent(htmlContent) {
  if (!htmlContent) return;

  // SmartEditor ONE: .se-content 또는 [role="textbox"]
  const selectors = [
    '.se-content',
    '.se-main-container [role="textbox"]',
    '[role="textbox"]',
    '.se-component-content',
  ];

  let el = null;
  let targetDoc = document;

  // 먼저 메인 문서에서 탐색
  for (const sel of selectors) {
    el = document.querySelector(sel);
    if (el) break;
  }

  // 없으면 iframe 내부 탐색
  if (!el) {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        for (const sel of selectors) {
          el = doc.querySelector(sel);
          if (el) {
            targetDoc = doc;
            break;
          }
        }
        if (el) break;
      } catch (e) {}
    }
  }

  if (el) {
    el.focus();
    el.innerHTML = htmlContent;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    return;
  }

  // 마지막 수단: 페이지 컨텍스트에서 SmartEditor API 직접 호출
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      try {
        // SmartEditor ONE API 시도
        var editorList = window.nhn && window.nhn.husky && window.nhn.husky.EZCreator;
        if (editorList) {
          var ed = editorList.getEditor('content');
          if (ed) { ed.exec('PASTE_HTML', [${JSON.stringify(htmlContent)}]); return; }
        }
        // contenteditable 강제 주입
        var all = document.querySelectorAll('[contenteditable=true]');
        for (var i = 0; i < all.length; i++) {
          if (all[i].offsetHeight > 100) {
            all[i].innerHTML = ${JSON.stringify(htmlContent)};
            all[i].dispatchEvent(new Event('input', {bubbles:true}));
            break;
          }
        }
      } catch(e) { console.error('초안 입력 오류:', e); }
    })();
  `;
  document.head.appendChild(script);
  script.remove();
}
