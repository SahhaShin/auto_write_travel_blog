const API_BASE = 'https://naver-blog-backend.onrender.com';

const selectEl  = document.getElementById('draftSelect');
const insertBtn = document.getElementById('insertBtn');
const draftInfo = document.getElementById('draftInfo');
const statusEl  = document.getElementById('status');

let drafts = [];

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status visible ${type}`;
}
function hideStatus() { statusEl.className = 'status'; }

async function loadDrafts() {
  showStatus('초안 목록을 불러오는 중...', 'loading');
  try {
    const res = await fetch(`${API_BASE}/api/drafts`);
    if (!res.ok) throw new Error('서버 응답 오류');
    drafts = await res.json();
    const filtered = drafts.filter(d =>
      ['GENERATED', 'EDITING', 'READY', 'DRAFT'].includes(d.status)
    );
    selectEl.innerHTML = '<option value="">-- 초안을 선택하세요 --</option>';
    filtered.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.finalTitle || d.generatedTitle || d.destination} (${d.travelDates || ''})`;
      selectEl.appendChild(opt);
    });
    hideStatus();
    if (filtered.length === 0) showStatus('불러올 초안이 없습니다.', 'error');
  } catch (e) {
    showStatus('초안 목록 로드 실패: ' + e.message, 'error');
  }
}

selectEl.addEventListener('change', async () => {
  const id = selectEl.value;
  if (!id) { draftInfo.className = 'draft-info'; insertBtn.disabled = true; return; }
  try {
    const res = await fetch(`${API_BASE}/api/drafts/${id}`);
    const draft = await res.json();
    document.getElementById('draftTitle').textContent = draft.finalTitle || draft.generatedTitle || '(제목 없음)';
    document.getElementById('draftDest').textContent = '📍 ' + draft.destination;
    document.getElementById('draftDate').textContent = draft.travelDates || '';
    document.getElementById('draftStatus').textContent = draft.status;
    draftInfo.className = 'draft-info visible';
    insertBtn.disabled = false;
  } catch (e) { showStatus('초안 로드 실패', 'error'); }
});

insertBtn.addEventListener('click', async () => {
  const id = selectEl.value;
  if (!id) return;

  insertBtn.disabled = true;
  insertBtn.innerHTML = '<span class="spinner"></span>입력 중...';

  try {
    const res = await fetch(`${API_BASE}/api/drafts/${id}`);
    const draft = await res.json();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('blog.naver.com') || !tab.url.includes('postwrite')) {
      showStatus('네이버 블로그 글쓰기 페이지에서 실행해주세요.', 'error');
      return;
    }

    const title   = draft.finalTitle || draft.generatedTitle || '';
    let   content = draft.finalContent || draft.generatedContent || '';

    // [IMAGE_N] 플레이스홀더 → 실제 <img> 태그로 교체
    const images = draft.images || [];
    images.forEach((img, idx) => {
      const imgUrl = img.publicUrl?.startsWith('http')
        ? img.publicUrl
        : `${API_BASE}${img.publicUrl}`;
      const imgTag = `<p><img src="${imgUrl}" alt="${img.originalName || ''}" style="max-width:100%;height:auto;"></p>`;
      content = content.replace(`[IMAGE_${idx + 1}]`, imgTag);
    });
    content = content.replace(/\[IMAGE_\d+\]/g, '');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: insertDraftIntoEditor,
      args: [title, content],
    });

    const result = results?.[0]?.result;
    if (result?.success) {
      showStatus('✅ 입력 완료! 내용 확인 후 직접 발행해주세요.', 'success');
    } else {
      showStatus('⚠️ ' + (result?.error || '입력 실패'), 'error');
    }
  } catch (e) {
    showStatus('오류: ' + e.message, 'error');
  } finally {
    insertBtn.disabled = false;
    insertBtn.textContent = '초안 불러오기';
  }
});

// ── 페이지 컨텍스트에서 실행 (MAIN world) ─────────────────
function insertDraftIntoEditor(title, content) {
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // 실제 contenteditable="true" 요소 찾기
  function findEditable(selectors, doc) {
    for (const sel of selectors) {
      const els = (doc || document).querySelectorAll(sel);
      for (const el of els) {
        // 자기 자신이 contenteditable이고 크기가 있는 경우
        if (el.isContentEditable && el.offsetHeight > 30) return el;
      }
    }
    return null;
  }

  // 요소 내부만 선택 (document 전체 selectAll 사용 안 함)
  function selectAllIn(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // DataTransfer paste 시뮬레이션
  function pasteHTML(el, html, doc) {
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const evt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(evt);
  }

  async function run() {
    // ── 1. 제목 입력 ────────────────────────────────────
    const titleSelectors = [
      '.se-title-input [contenteditable="true"]',
      '.se-title-input',
      '[data-placeholder="제목"]',
    ];
    let titleEl = findEditable(titleSelectors, document);

    // iframe 탐색
    if (!titleEl) {
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          titleEl = findEditable(titleSelectors, doc);
          if (titleEl) break;
        } catch (e) {}
      }
    }

    if (titleEl) {
      titleEl.focus();
      await sleep(200);
      selectAllIn(titleEl);
      await sleep(100);
      // 선택 후 insertText
      document.execCommand('insertText', false, title);
      titleEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await sleep(600);

    // ── 2. 본문 에디터 찾기 ──────────────────────────────
    const contentSelectors = [
      // SmartEditor ONE 본문 내 실제 contenteditable
      '.se-component-content [contenteditable="true"]',
      '.se-text [contenteditable="true"]',
      '.se-content [contenteditable="true"]',
      // fallback
      '.se-content',
      '[role="textbox"]',
    ];

    let contentEl = null;
    let targetDoc = document;

    contentEl = findEditable(contentSelectors, document);

    if (!contentEl) {
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          contentEl = findEditable(contentSelectors, doc);
          if (contentEl) { targetDoc = doc; break; }
        } catch (e) {}
      }
    }

    if (!contentEl) return { success: false, error: '에디터 본문 영역을 찾지 못했습니다.' };

    // ── 3. 에디터 포커스 ────────────────────────────────
    contentEl.click();
    await sleep(400);
    contentEl.focus();
    await sleep(300);

    // ── 4. 에디터 내부 전체 선택 (document 전체 아님) ──
    selectAllIn(contentEl);
    await sleep(100);

    // ── 5. paste 이벤트로 HTML 삽입 ────────────────────
    pasteHTML(contentEl, content, targetDoc);
    await sleep(500);

    // ── 6. 삽입 확인 후 fallback ────────────────────────
    const textLen = (contentEl.textContent || '').replace(/\s/g, '').length;
    if (textLen < 5) {
      // execCommand insertHTML 시도
      selectAllIn(contentEl);
      const ok = targetDoc.execCommand('insertHTML', false, content);

      if (!ok || (contentEl.textContent || '').replace(/\s/g, '').length < 5) {
        // 최후 수단: innerHTML 직접 교체
        contentEl.innerHTML = content;
        ['input', 'change'].forEach(evtName =>
          contentEl.dispatchEvent(new Event(evtName, { bubbles: true }))
        );
      }
    }

    return { success: true };
  }

  return run();
}

loadDrafts();
