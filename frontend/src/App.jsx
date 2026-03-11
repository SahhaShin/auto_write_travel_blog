import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import StyleReferencePage from './pages/StyleReferencePage';
import CreatePostPage from './pages/CreatePostPage';
import EditorPage from './pages/EditorPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import './App.css';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Layout() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">N</span>
          <span className="brand-title">블로그 자동 포스터</span>
        </div>
        <nav className="header-nav">
          <NavLink to="/create">새 글 작성</NavLink>
          <NavLink to="/styles">스타일 관리</NavLink>
          <NavLink to="/history">발행 히스토리</NavLink>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#555', fontSize: 14, padding: '4px 8px',
            }}
          >
            로그아웃
          </button>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HistoryPage />} />
          <Route path="/create" element={<CreatePostPage />} />
          <Route path="/editor/:draftId" element={<EditorPage />} />
          <Route path="/styles" element={<StyleReferencePage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
