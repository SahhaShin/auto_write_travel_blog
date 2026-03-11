const API_BASE = 'https://naver-blog-backend.onrender.com';

const selectEl   = document.getElementById('draftSelect');
const insertBtn  = document.getElementById('insertBtn');
const draftInfo  = document.getElementById('draftInfo');
const statusEl   = document.getElementById('status');

let drafts = [];

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status visible ${type}`;
}

function hideStatus() {
  statusEl.className = 'status';
}

// 초안 목록 로드
async function loadDrafts() {
  showStatus('초안 목록을 불러오는 중...', 'loading');
  try {
    const res = await fetch(`${API_BASE}/api/drafts`);
    if (!res.ok) throw new Error('서버 응답 오류');
    drafts = await res.json();

    // GENERATED / EDITING / READY 상태만 표시
    const filtered = drafts.filter(d =>
      ['GENERATED', 'EDITING', 'READY', 'DRAFT'].includes(d.status)
    );

    selectEl.innerHTML = '<option value="">-- 초안을 선택하세요 --</option>';
    filtered.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      const title = d.finalTitle || d.generatedTitle || d.destination;
      const date = d.travelDates || '';
      opt.textContent = `${title} (${date})`;
      selectEl.appendChild(opt);
    });

    hideStatus();
    if (filtered.length === 0) {
      showStatus('불러올 초안이 없습니다. AI 생성 후 다시 시도해주세요.', 'error');
    }
  } catch (e) {
    showStatus('초안 목록 로드 실패: ' + e.message, 'error');
  }
}

// 초안 선택 시 정보 표시
selectEl.addEventListener('change', async () => {
  const id = selectEl.value;
  if (!id) {
    draftInfo.className = 'draft-info';
    insertBtn.disabled = true;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/drafts/${id}`);
    const draft = await res.json();

    document.getElementById('draftTitle').textContent =
      draft.finalTitle || draft.generatedTitle || '(제목 없음)';
    document.getElementById('draftDest').textContent = '📍 ' + draft.destination;
    document.getElementById('draftDate').textContent = draft.travelDates || '';
    document.getElementById('draftStatus').textContent = draft.status;

    draftInfo.className = 'draft-info visible';
    insertBtn.disabled = false;
  } catch (e) {
    showStatus('초안 상세 로드 실패', 'error');
  }
});

// 초안 불러오기 버튼
insertBtn.addEventListener('click', async () => {
  const id = selectEl.value;
  if (!id) return;

  insertBtn.disabled = true;
  insertBtn.innerHTML = '<span class="spinner"></span>입력 중...';

  try {
    const res = await fetch(`${API_BASE}/api/drafts/${id}`);
    const draft = await res.json();

    // 현재 탭이 네이버 글쓰기 페이지인지 확인
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('blog.naver.com') || !tab.url.includes('postwrite')) {
      showStatus('네이버 블로그 글쓰기 페이지에서 실행해주세요.\nblog.naver.com/계정ID/postwrite', 'error');
      return;
    }

    // content.js에 초안 데이터 전달
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'INSERT_DRAFT',
      draft: {
        title: draft.finalTitle || draft.generatedTitle || '',
        content: draft.finalContent || draft.generatedContent || '',
      }
    });

    if (response?.success) {
      showStatus('✅ 제목과 본문이 입력되었습니다. 내용 확인 후 발행해주세요!', 'success');
    } else {
      showStatus('입력 실패: ' + (response?.error || '알 수 없는 오류'), 'error');
    }
  } catch (e) {
    showStatus('오류: ' + e.message, 'error');
  } finally {
    insertBtn.disabled = false;
    insertBtn.textContent = '초안 불러오기';
  }
});

loadDrafts();
