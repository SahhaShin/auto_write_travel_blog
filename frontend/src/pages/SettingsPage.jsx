import { useState } from 'react';
import { postApi } from '../api/postApi';

export default function SettingsPage() {
  const [form, setForm] = useState({ naverId: '', naverPassword: '', blogId: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');
    try {
      await postApi.saveCredentials(form);
      setSuccess(true);
      setForm({ naverId: '', naverPassword: '', blogId: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="section-title">설정</h1>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>네이버 로그인 정보</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
          자동 포스팅을 위해 네이버 로그인 정보를 설정하세요.
          입력된 정보는 AES-256으로 암호화되어 저장됩니다.
          <br />
          <strong style={{ color: '#ff4757' }}>주의: 2차 인증(OTP)이 활성화된 경우 자동 포스팅이 실패할 수 있습니다.</strong>
        </p>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>네이버 아이디</label>
            <input
              type="text"
              placeholder="네이버 아이디"
              value={form.naverId}
              onChange={e => setForm({...form, naverId: e.target.value})}
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
              onChange={e => setForm({...form, naverPassword: e.target.value})}
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
              onChange={e => setForm({...form, blogId: e.target.value})}
            />
          </div>

          {success && (
            <p style={{ color: '#03c75a', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
              로그인 정보가 안전하게 저장되었습니다.
            </p>
          )}
          {error && (
            <p style={{ color: '#ff4757', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : '저장'}
          </button>
        </form>
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
