import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import StyleReferencePage from './pages/StyleReferencePage';
import CreatePostPage from './pages/CreatePostPage';
import EditorPage from './pages/EditorPage';
import HistoryPage from './pages/HistoryPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
