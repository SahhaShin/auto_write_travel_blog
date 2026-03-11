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

  // 메인 문서 + 모든 iframe에서 contenteditable="true" 요소 전부 수집
  // aria-hidden / 화면 밖 / 너무 좁은 요소(클립보드 헬퍼 등)는 제외
  function collectAllEditables() {
    const list = [];
    const isUsable = (el) => {
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const rect = el.getBoundingClientRect();
      if (rect.left < -500 || rect.top < -500) return false;  // 화면 밖
      if (rect.width < 20) return false;                       // 너무 좁음
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

  // 요소 내부만 선택 (document 전체 selectAll 사용 안 함)
  function selectAllIn(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // SE 문단 구조로 HTML 변환
  // SmartEditor ONE은 <p class="se-text-paragraph"> 구조를 사용
  function buildSEContent(html) {
    // 이미 <h2>/<p> 태그가 있으면 그대로 사용 (paste가 처리)
    return html;
  }

  async function run() {
    const editables = collectAllEditables();

    if (editables.length === 0) {
      return { success: false, error: 'contenteditable 요소 없음 — 에디터가 아직 로딩 중일 수 있습니다.' };
    }

    // 높이 기준 정렬 (큰 것 = 본문, 작은 것 = 제목)
    editables.sort((a, b) => b.el.offsetHeight - a.el.offsetHeight);

    // 제목 요소: 'title' 클래스 포함이거나 가장 작은 것
    const titleEntry = editables.find(({ el }) =>
      /title/i.test(el.className) || el.closest('[class*="title"]')
    ) || editables[editables.length - 1];

    // 본문 요소: 가장 큰 것 (단, 제목과 다른 것)
    const bodyEntry = editables.find(({ el }) => el !== titleEntry.el) || editables[0];

    // ── 1. 제목 입력 ────────────────────────────────────
    if (title && titleEntry) {
      const { el: titleEl, doc: titleDoc } = titleEntry;
      titleEl.click();
      await sleep(200);
      titleEl.focus();
      await sleep(200);

      // selectAllIn은 titleDoc 기준 range 사용
      const range = titleDoc.createRange();
      range.selectNodeContents(titleEl);
      const sel = titleDoc.defaultView.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      await sleep(100);

      // paste 방식으로 통일 (body와 동일)
      const dt = new DataTransfer();
      dt.setData('text/plain', title);
      dt.setData('text/html', `<span>${title}</span>`);
      const pasted = titleEl.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      }));

      await sleep(200);

      // paste 미처리 → titleDoc.execCommand fallback
      const titleText = (titleEl.textContent || '').replace(/\s/g, '');
      if (titleText.length < 2) {
        titleDoc.execCommand('insertText', false, title);
        titleEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 그래도 안 되면 __se-node span 직접 수정
      if ((titleEl.textContent || '').replace(/\s/g, '').length < 2) {
        const span = titleEl.querySelector('.__se-node') || titleEl.querySelector('span') || titleEl;
        span.textContent = title;
        titleEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: title }));
      }
    }

    await sleep(500);

    // ── 2. 본문 입력 ────────────────────────────────────
    if (!bodyEntry) {
      return { success: false, error: `본문 에디터 없음. 찾은 요소: ${editables.map(e => e.el.className.substring(0,40)).join(' | ')}` };
    }

    const { el: bodyEl, doc: bodyDoc } = bodyEntry;

    bodyEl.click();
    await sleep(300);
    bodyEl.focus();
    await sleep(300);

    // 내부 전체 선택
    selectAllIn(bodyEl);
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

    // paste 미처리 확인 → execCommand insertHTML fallback
    const len = (bodyEl.textContent || '').replace(/\s/g, '').length;
    if (len < 5) {
      selectAllIn(bodyEl);
      const ok = bodyDoc.execCommand('insertHTML', false, content);

      // 그래도 실패 → innerHTML 직접 교체
      if (!ok || (bodyEl.textContent || '').replace(/\s/g, '').length < 5) {
        bodyEl.innerHTML = content;
        ['input', 'change'].forEach(evt =>
          bodyEl.dispatchEvent(new Event(evt, { bubbles: true }))
        );
      }
    }

    return {
      success: true,
      debug: {
        totalEditables: editables.length,
        titleClass: titleEntry.el.className.substring(0, 60),
        bodyClass: bodyEntry.el.className.substring(0, 60),
        bodyH: bodyEntry.el.offsetHeight,
      }
    };
  }

  return run();
}

loadDrafts();
