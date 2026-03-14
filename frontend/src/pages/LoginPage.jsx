import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axiosClient from '../api/axiosClient';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.post('/api/auth/google', {
        idToken: credentialResponse.credential,
      });
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (e) {
      setError('Google 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

        <div style={{ margin: '20px 0', textAlign: 'center', position: 'relative' }}>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
          <span style={{
            position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
            background: 'white', padding: '0 10px', fontSize: 12, color: '#9ca3af',
          }}>또는</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google 로그인에 실패했습니다.')}
            text="signin_with"
            locale="ko"
          />
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
          계정이 없으신가요?{' '}
          <Link to="/register" style={{ color: '#03c75a', textDecoration: 'none', fontWeight: 600 }}>
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
