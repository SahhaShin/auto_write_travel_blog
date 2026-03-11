import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postApi } from '../api/postApi';
import { draftApi } from '../api/draftApi';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleDeleteDraft = async (id) => {
    if (!window.confirm('이 초안을 삭제하시겠습니까?')) return;
    try {
      await draftApi.delete(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  };

  useEffect(() => {
    Promise.all([postApi.getHistory(), draftApi.getAll()])
      .then(([h, d]) => {
        setHistory(h);
        setDrafts(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (status) => {
    const map = {
      DRAFT: '초안', GENERATED: '생성됨', EDITING: '편집중',
      READY: '발행대기', POSTED: '발행완료', FAILED: '실패',
    };
    return map[status] || status;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>;
  }

  return (
    <div>
      {/* 발행 히스토리 */}
      {history.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h1 className="section-title">발행 히스토리</h1>
          <div style={{ display: 'grid', gap: 12 }}>
            {history.map(h => (
              <div key={h.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{h.title}</h3>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#888' }}>
                    <span>{h.category}</span>
                    <span>사진 {h.imageCount}장</span>
                    <span>{new Date(h.postedAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <a
                  href={h.naverPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ textDecoration: 'none', flexShrink: 0 }}
                >
                  블로그 보기
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 초안 목록 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 className="section-title" style={{ margin: 0 }}>
            {history.length > 0 ? '작성 중인 초안' : '내 블로그 글'}
          </h1>
          <button className="btn btn-primary" onClick={() => navigate('/create')}>
            + 새 글 작성
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="empty-state">
            <h3>작성된 글이 없습니다</h3>
            <p>새 글 작성 버튼을 눌러 첫 여행 블로그를 작성해보세요!</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/create')}>
              새 글 작성하기
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {drafts.map(draft => (
              <div key={draft.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span className={`badge badge-${draft.status?.toLowerCase()}`}>
                      {statusLabel(draft.status)}
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                      {draft.finalTitle || draft.generatedTitle || draft.destination}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#888' }}>
                    <span>📍 {draft.destination}</span>
                    {draft.travelDates && <span>📅 {draft.travelDates}</span>}
                    <span>{draft.category}</span>
                    <span>{new Date(draft.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/editor/${draft.id}`)}
                  >
                    {draft.status === 'POSTED' ? '보기' : '편집'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ color: '#ff4757' }}
                    onClick={() => handleDeleteDraft(draft.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
