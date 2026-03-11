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
    const content = draft.finalContent || draft.generatedContent || '';

    // 페이지 컨텍스트(MAIN world)에서 직접 실행 → SmartEditor API 접근 가능
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

// ── 페이지 컨텍스트에서 실행되는 함수 (MAIN world) ─────
// 이 함수는 직렬화되어 탭에 주입됨 → 외부 변수 참조 불가
function insertDraftIntoEditor(title, content) {
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function run() {
    // ── 제목 입력 ──────────────────────────────────────
    const titleSelectors = [
      '.se-title-input [contenteditable]',
      '.se-title-input',
      '[data-placeholder="제목"]',
      'div[contenteditable="true"]:first-of-type',
    ];
    let titleEl = null;
    for (const sel of titleSelectors) {
      titleEl = document.querySelector(sel);
      if (titleEl) break;
    }
    if (titleEl) {
      titleEl.click();
      titleEl.focus();
      await sleep(300);
      // 전체 선택 후 삭제 후 입력
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete');
      document.execCommand('insertText', false, title);
    }

    await sleep(500);

    // ── 본문 입력: execCommand('insertHTML') ──────────
    const contentSelectors = [
      '.se-content',
      '.se-main-container [contenteditable="true"]',
      '[role="textbox"]',
    ];
    let contentEl = null;
    for (const sel of contentSelectors) {
      const els = document.querySelectorAll(sel);
      // 높이가 있는 요소 우선
      for (const el of els) {
        if (el.offsetHeight > 50) { contentEl = el; break; }
      }
      if (contentEl) break;
    }

    if (!contentEl) {
      // iframe 내부 탐색
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          for (const sel of contentSelectors) {
            const el = doc.querySelector(sel);
            if (el && el.offsetHeight > 50) { contentEl = el; break; }
          }
          if (contentEl) break;
        } catch (e) {}
      }
    }

    if (!contentEl) return { success: false, error: '에디터 본문 영역을 찾지 못했습니다.' };

    contentEl.click();
    contentEl.focus();
    await sleep(400);

    // 전체 선택 후 HTML 삽입
    document.execCommand('selectAll', false, null);
    const inserted = document.execCommand('insertHTML', false, content);

    if (!inserted) {
      // fallback: innerHTML 직접 설정
      contentEl.innerHTML = content;
      contentEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return { success: true };
  }

  return run();
}

loadDrafts();
