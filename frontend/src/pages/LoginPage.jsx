import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.post('/api/auth/login', form);
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f8f9fa',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 40,
        width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: '#03c75a', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: 'white', fontWeight: 700, marginBottom: 12,
          }}>N</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>블로그 자동 포스터</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>로그인이 필요합니다</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>아이디</label>
            <input
              type="text"
              placeholder="아이디"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <p style={{ color: '#ff4757', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
