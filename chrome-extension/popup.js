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

    // 제목을 본문 상단에 포함 (제목 필드 자동입력 불가로 본문에 함께 삽입)
    const titleHtml = title ? `<h2>${title}</h2>` : '';
    const fullContent = titleHtml + content;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: insertDraftIntoEditor,
      args: [fullContent],
    });

    const result = results?.[0]?.result;
    if (result?.success) {
      showStatus('✅ 본문 입력 완료! 제목은 직접 입력 후 발행해주세요.', 'success');
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
function insertDraftIntoEditor(content) {
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function collectAllEditables() {
    const list = [];
    const isUsable = (el) => {
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const rect = el.getBoundingClientRect();
      if (rect.left < -500 || rect.top < -500) return false;
      if (rect.width < 20) return false;
      return el.offsetHeight > 0;
    };
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      if (isUsable(el)) list.push({ el, doc: document });
    });
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.querySelectorAll('[contenteditable="true"]').forEach(el => {
          if (isUsable(el)) list.push({ el, doc });
        });
      } catch (e) {}
    });
    return list;
  }

  async function run() {
    const editables = collectAllEditables();
    if (editables.length === 0) {
      return { success: false, error: 'contenteditable 요소 없음 — 에디터가 로딩 중일 수 있습니다.' };
    }

    // 가장 큰 요소 = 본문 에디터
    editables.sort((a, b) => b.el.offsetHeight - a.el.offsetHeight);
    const { el: bodyEl, doc: bodyDoc } = editables[0];

    bodyEl.click();
    await sleep(300);
    bodyEl.focus();
    await sleep(300);

    // 내부 전체 선택
    const range = bodyDoc.createRange();
    range.selectNodeContents(bodyEl);
    const sel = bodyDoc.defaultView.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    await sleep(100);

    // DataTransfer paste 시뮬레이션
    const dt = new DataTransfer();
    dt.setData('text/html', content);
    dt.setData('text/plain', content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    bodyEl.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    }));

    await sleep(600);

    // fallback: execCommand insertHTML
    const len = (bodyEl.textContent || '').replace(/\s/g, '').length;
    if (len < 5) {
      range.selectNodeContents(bodyEl);
      sel.removeAllRanges();
      sel.addRange(range);
      const ok = bodyDoc.execCommand('insertHTML', false, content);

      if (!ok || (bodyEl.textContent || '').replace(/\s/g, '').length < 5) {
        bodyEl.innerHTML = content;
        ['input', 'change'].forEach(evt =>
          bodyEl.dispatchEvent(new Event(evt, { bubbles: true }))
        );
      }
    }

    return { success: true };
  }

  return run();
}

loadDrafts();
