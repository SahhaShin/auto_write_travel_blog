import { useState, useEffect } from 'react';
import { postApi } from '../api/postApi';

export default function SettingsPage() {
  const [current, setCurrent] = useState(null);   // 저장된 자격증명
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ naverId: '', naverPassword: '', blogId: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    postApi.getCredentials()
      .then(data => {
        if (data.exists) setCurrent(data);
        else setEditing(true); // 저장된 정보 없으면 바로 편집 모드
      })
      .catch(() => setEditing(true));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');
    try {
      await postApi.saveCredentials(form);
      const updated = await postApi.getCredentials();
      setCurrent(updated);
      setEditing(false);
      setSuccess(true);
      setForm({ naverId: '', naverPassword: '', blogId: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = () => {
    setSuccess(false);
    setError('');
    setEditing(true);
  };

  return (
    <div>
      <h1 className="section-title">설정</h1>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>네이버 로그인 정보</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
          자동 포스팅에 사용할 네이버 계정 정보입니다. AES-256으로 암호화되어 저장됩니다.
        </p>

        {/* 읽기 모드 */}
        {!editing && current?.exists && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={rowStyle}>
                <span style={labelStyle}>네이버 아이디</span>
                <span style={valueStyle}>{current.naverId}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>비밀번호</span>
                <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: 12, color: '#aaa', wordBreak: 'break-all' }}>
                  {current.encryptedPassword}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>블로그 URL</span>
                <span style={valueStyle}>
                  {current.blogId
                    ? `https://blog.naver.com/${current.blogId}`
                    : <span style={{ color: '#aaa' }}>미설정</span>}
                </span>
              </div>
            </div>
            {success && (
              <p style={{ color: '#03c75a', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
                로그인 정보가 업데이트되었습니다.
              </p>
            )}
            <button className="btn btn-secondary" onClick={handleEditClick}>수정</button>
          </div>
        )}

        {/* 편집 모드 */}
        {editing && (
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>네이버 아이디</label>
              <input
                type="text"
                placeholder="네이버 아이디"
                value={form.naverId}
                onChange={e => setForm({ ...form, naverId: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>네이버 비밀번호</label>
              <input
                type="password"
                placeholder="네이버 비밀번호"
                value={form.naverPassword}
                onChange={e => setForm({ ...form, naverPassword: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label>블로그 ID (URL 경로)</label>
              <input
                type="text"
                placeholder="예: myblog123 (blog.naver.com/myblog123)"
                value={form.blogId}
                onChange={e => setForm({ ...form, blogId: e.target.value })}
              />
            </div>

            {error && (
              <p style={{ color: '#ff4757', fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : '저장'}
              </button>
              {current?.exists && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                  취소
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>사용 방법</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 14, color: '#555' }}>
          <li><strong>스타일 관리</strong>: 기존 네이버 블로그 글 URL이나 텍스트를 추가합니다.</li>
          <li><strong>새 글 작성</strong>: 여행 사진과 여행 계획을 입력합니다.</li>
          <li><strong>AI 생성</strong>: AI가 기존 글 스타일을 분석하여 새 글을 작성합니다.</li>
          <li><strong>편집</strong>: 생성된 글을 자유롭게 수정합니다. (자동 저장)</li>
          <li><strong>네이버에 발행</strong>: 클릭 한 번으로 네이버 블로그에 자동으로 포스팅됩니다.</li>
        </ol>
      </div>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '10px 14px',
  background: '#f8f9fa',
  borderRadius: 8,
};

const labelStyle = {
  fontSize: 13,
  color: '#888',
  minWidth: 100,
  flexShrink: 0,
  paddingTop: 1,
};

const valueStyle = {
  fontSize: 14,
  color: '#222',
  fontWeight: 500,
  wordBreak: 'break-all',
};
