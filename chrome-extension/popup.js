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

    // ── [IMAGE_N] 플레이스홀더 → 실제 <img> 태그로 교체 ──
    const images = draft.images || [];
    images.forEach((img, idx) => {
      const imgUrl = img.publicUrl?.startsWith('http')
        ? img.publicUrl
        : `${API_BASE}${img.publicUrl}`;
      const imgTag = `<figure><img src="${imgUrl}" alt="${img.originalName || ''}" style="max-width:100%;height:auto;display:block;margin:8px auto;"></figure>`;
      content = content.replace(`[IMAGE_${idx + 1}]`, imgTag);
    });
    // 남은 플레이스홀더 제거
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

// ── 페이지 컨텍스트에서 실행되는 함수 (MAIN world) ─────
// 이 함수는 직렬화되어 탭에 주입됨 → 외부 변수 참조 불가
function insertDraftIntoEditor(title, content) {
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function run() {
    // ── 1. 제목 입력 ────────────────────────────────────
    const titleSelectors = [
      '.se-title-input [contenteditable]',
      '.se-title-input',
      '[data-placeholder="제목"]',
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
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, title);
      titleEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await sleep(600);

    // ── 2. 본문 에디터 찾기 ──────────────────────────────
    const contentSelectors = [
      '.se-content',
      '.se-main-container [contenteditable="true"]',
      '[role="textbox"]',
    ];
    let contentEl = null;
    let targetDoc = document;

    // 메인 문서에서 먼저 탐색
    for (const sel of contentSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetHeight > 50) { contentEl = el; break; }
      }
      if (contentEl) break;
    }

    // iframe 내부 탐색
    if (!contentEl) {
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          for (const sel of contentSelectors) {
            const el = doc.querySelector(sel);
            if (el && el.offsetHeight > 50) { contentEl = el; targetDoc = doc; break; }
          }
          if (contentEl) break;
        } catch (e) {}
      }
    }

    if (!contentEl) return { success: false, error: '에디터 본문 영역을 찾지 못했습니다.' };

    contentEl.click();
    await sleep(400);
    contentEl.focus();
    await sleep(300);

    // ── 3. DataTransfer paste 시뮬레이션 (가장 자연스러운 방식) ──
    // 기존 내용 전체 선택
    targetDoc.execCommand('selectAll', false, null);
    await sleep(100);

    // DataTransfer 객체로 paste 이벤트 생성
    const dt = new DataTransfer();
    dt.setData('text/html', content);
    dt.setData('text/plain', content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });

    const handled = contentEl.dispatchEvent(pasteEvent);

    await sleep(500);

    // ── 4. paste 이벤트 미처리 시 execCommand fallback ──
    // 에디터가 비어있으면 fallback 시도
    const isEmpty = (contentEl.textContent || '').trim() === '' ||
                    (contentEl.innerHTML || '').trim() === '' ||
                    (contentEl.innerHTML || '').trim() === '<p><br></p>';

    if (isEmpty) {
      // execCommand insertHTML 시도
      const inserted = targetDoc.execCommand('insertHTML', false, content);

      if (!inserted || isEmpty) {
        // 최후 수단: innerHTML 직접 + 이벤트 발생
        contentEl.innerHTML = content;
        ['input', 'change', 'keyup'].forEach(evtName => {
          contentEl.dispatchEvent(new Event(evtName, { bubbles: true }));
        });
      }
    }

    await sleep(300);
    return { success: true };
  }

  return run();
}

loadDrafts();
