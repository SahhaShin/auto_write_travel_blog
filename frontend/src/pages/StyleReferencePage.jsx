import { useState, useEffect } from 'react';
import { styleApi } from '../api/styleApi';

const CATEGORIES = ['여행', '맛집', '숙소', '카페', '기타'];

export default function StyleReferencePage() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('text'); // 'text' | 'url'
  const [form, setForm] = useState({ title: '', content: '', sourceUrl: '', category: '여행' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await styleApi.getAll();
      setSamples(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (formMode === 'url') {
        await styleApi.addFromUrl(form.sourceUrl, form.category);
      } else {
        await styleApi.addFromText({ title: form.title, content: form.content, category: form.category });
      }
      setForm({ title: '', content: '', sourceUrl: '', category: '여행' });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await styleApi.delete(id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="section-title" style={{ margin: 0 }}>스타일 참고 글 관리</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '취소' : '+ 참고 글 추가'}
        </button>
      </div>

      <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>
        기존에 작성한 네이버 블로그 글을 추가하면 AI가 동일한 문체로 글을 생성합니다.
      </p>

      {showForm && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button
              className={`btn ${formMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFormMode('text')}
            >텍스트 직접 입력</button>
            <button
              className={`btn ${formMode === 'url' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFormMode('url')}
            >URL에서 가져오기</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>카테고리</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {formMode === 'url' ? (
              <div className="form-group">
                <label>네이버 블로그 URL</label>
                <input
                  type="url"
                  placeholder="https://blog.naver.com/..."
                  value={form.sourceUrl}
                  onChange={e => setForm({...form, sourceUrl: e.target.value})}
                  required
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>제목</label>
                  <input
                    type="text"
                    placeholder="참고 글 제목"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>본문 내용</label>
                  <textarea
                    placeholder="기존 블로그 글 본문을 붙여넣으세요..."
                    value={form.content}
                    onChange={e => setForm({...form, content: e.target.value})}
                    style={{ minHeight: 200 }}
                    required
                  />
                </div>
              </>
            )}

            {error && <p style={{ color: '#ff4757', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? <span className="spinner" /> : '저장'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
      ) : samples.length === 0 ? (
        <div className="empty-state">
          <h3>참고 글이 없습니다</h3>
          <p>기존 네이버 블로그 글을 추가하면 AI가 동일한 문체로 글을 생성합니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {samples.map(sample => (
            <div key={sample.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span className="badge badge-generated">{sample.category || '여행'}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{sample.title}</h3>
                </div>
                {sample.sourceUrl && (
                  <a href={sample.sourceUrl} target="_blank" rel="noreferrer"
                     style={{ fontSize: 12, color: '#03c75a' }}>
                    원본 URL 보기
                  </a>
                )}
                <p style={{ color: '#888', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                  {sample.content?.substring(0, 150)}...
                </p>
              </div>
              <button
                className="btn btn-danger"
                style={{ marginLeft: 16, flexShrink: 0 }}
                onClick={() => handleDelete(sample.id)}
              >삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
