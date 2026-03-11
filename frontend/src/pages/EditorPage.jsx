import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { draftApi } from '../api/draftApi';
import { generateApi } from '../api/generateApi';
import { postApi } from '../api/postApi';
import './EditorPage.css';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const getImageUrl = (publicUrl) => publicUrl?.startsWith('http') ? publicUrl : `${BASE_URL}${publicUrl}`;

const STATUS_MESSAGES = {
  PENDING: '발행 준비 중...',
  LOGGING_IN: '네이버에 로그인 중...',
  NAVIGATING: '블로그 페이지 이동 중...',
  SETTING_TITLE: '제목 입력 중...',
  SETTING_CONTENT: '본문 입력 중...',
  UPLOADING_IMAGES: '이미지 업로드 중...',
  PUBLISHING: '발행 중...',
  UNKNOWN: '상태 확인 중...',
};

export default function EditorPage() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const [title, setTitle] = useState('');
  const saveTimer = useRef(null);
  const pollTimer = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'AI 생성 버튼을 눌러 글을 생성하세요...' }),
    ],
    onUpdate: () => {
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(autoSave, 3000);
    },
  });

  const autoSave = useCallback(async () => {
    if (!editor) return;
    try {
      await draftApi.update(draftId, {
        finalTitle: title,
        finalContent: editor.getHTML(),
        status: 'EDITING',
      });
      setSaved(true);
    } catch (e) {
      console.error('자동 저장 실패', e);
    }
  }, [editor, draftId, title]);

  useEffect(() => {
    loadDraft();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [draftId]);

  useEffect(() => {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(autoSave, 3000);
  }, [title]);

  const loadDraft = async () => {
    setLoading(true);
    try {
      const data = await draftApi.getById(draftId);
      setDraft(data);
      setTitle(data.finalTitle || data.generatedTitle || '');
      if (editor && (data.finalContent || data.generatedContent)) {
        let content = data.finalContent || data.generatedContent;
        // 이미지 플레이스홀더를 실제 img 태그로 변환
        if (data.images) {
          data.images.forEach((img, i) => {
            content = content.replace(
              `[IMAGE_${i + 1}]`,
              `<img src="${getImageUrl(img.publicUrl)}" alt="${img.originalName}" />`
            );
          });
        }
        editor.commands.setContent(content);
      }
    } catch (e) {
      setError('초안을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editor && draft) {
      let content = draft.finalContent || draft.generatedContent || '';
      if (draft.images) {
        draft.images.forEach((img, i) => {
          content = content.replace(
            `[IMAGE_${i + 1}]`,
            `<img src="${getImageUrl(img.publicUrl)}" alt="${img.originalName}" />`
          );
        });
      }
      if (content) editor.commands.setContent(content);
    }
  }, [editor, draft]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const result = await generateApi.generate(draftId, []);
      setDraft(result);
      setTitle(result.generatedTitle || '');

      let content = result.generatedContent || '';
      if (result.images) {
        // 이미지 목록은 draft에서 가져옴
      }
      // 이미지 데이터를 가져와서 플레이스홀더 교체
      const freshDraft = await draftApi.getById(draftId);
      let freshContent = freshDraft.generatedContent || '';
      if (freshDraft.images) {
        freshDraft.images.forEach((img, i) => {
          freshContent = freshContent.replace(
            `[IMAGE_${i + 1}]`,
            `<img src="${getImageUrl(img.publicUrl)}" alt="${img.originalName}" />`
          );
        });
      }
      editor.commands.setContent(freshContent);
      setSaved(false);
    } catch (e) {
      setError('AI 글 생성 실패: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!window.confirm('네이버 블로그에 발행하시겠습니까?')) return;

    // 먼저 저장
    await autoSave();

    setPosting(true);
    setPostStatus('PENDING');
    setPostUrl('');
    setError('');

    try {
      await postApi.startPost(draftId);

      // 상태 폴링
      pollTimer.current = setInterval(async () => {
        try {
          const result = await postApi.getStatus(draftId);
          const status = result.status;

          if (status.startsWith('SUCCESS:')) {
            clearInterval(pollTimer.current);
            setPostUrl(status.replace('SUCCESS:', ''));
            setPostStatus('SUCCESS');
            setPosting(false);
          } else if (status.startsWith('FAILED:')) {
            clearInterval(pollTimer.current);
            setError('발행 실패: ' + status.replace('FAILED:', ''));
            setPostStatus('FAILED');
            setPosting(false);
          } else {
            setPostStatus(status);
          }
        } catch (e) {
          console.error('상태 조회 실패', e);
        }
      }, 3000);
    } catch (e) {
      setError('발행 시작 실패: ' + e.message);
      setPosting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>;
  }

  return (
    <div className="editor-page">
      {/* 상단 툴바 */}
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>← 뒤로</button>
          <span style={{ color: '#888', fontSize: 13 }}>
            {saved ? '저장됨' : '저장 중...'}
          </span>
        </div>
        <div className="editor-topbar-right">
          {!generating && (
            <button className="btn btn-secondary" onClick={handleGenerate}>
              AI 재생성
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handlePost}
            disabled={posting || generating}
            style={{ background: '#03c75a' }}
          >
            {posting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" />
                {STATUS_MESSAGES[postStatus] || '발행 중...'}
              </span>
            ) : '네이버에 발행'}
          </button>
        </div>
      </div>

      {/* AI 생성 중 오버레이 */}
      {generating && (
        <div className="generating-banner">
          <span className="spinner" />
          <span>AI가 여행 블로그를 작성 중입니다... (10-30초 소요)</span>
        </div>
      )}

      {/* 발행 성공 배너 */}
      {postUrl && (
        <div className="success-banner">
          <span>발행 완료!</span>
          <a href={postUrl} target="_blank" rel="noreferrer" style={{ color: 'white', fontWeight: 700 }}>
            네이버 블로그에서 보기 →
          </a>
        </div>
      )}

      {error && (
        <div className="error-banner">{error}</div>
      )}

      {/* 편집 영역 */}
      <div className="editor-container">
        {/* 제목 */}
        <input
          className="title-input"
          type="text"
          placeholder="블로그 제목을 입력하세요"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {/* 여행 정보 요약 */}
        {draft && (
          <div className="draft-meta">
            <span>📍 {draft.destination}</span>
            {draft.travelDates && <span>📅 {draft.travelDates}</span>}
            <span className={`badge badge-${draft.status?.toLowerCase()}`}>{draft.status}</span>
          </div>
        )}

        {/* TipTap 에디터 툴바 */}
        {editor && (
          <div className="editor-toolbar">
            <button
              className={editor.isActive('bold') ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >B</button>
            <button
              className={editor.isActive('italic') ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >I</button>
            <button
              className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >H2</button>
            <button
              className={editor.isActive('bulletList') ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >•목록</button>
            <span className="toolbar-divider" />
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()}>좌</button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()}>가운데</button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()}>우</button>
          </div>
        )}

        {/* 에디터 본문 */}
        <div className="editor-content-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* 이미지 목록 */}
      {draft?.images?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>업로드된 이미지 ({draft.images.length}장)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {draft.images.map((img, i) => (
              <div key={img.id} style={{ textAlign: 'center' }}>
                <img
                  src={getImageUrl(img.publicUrl)}
                  alt={img.originalName}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }}
                />
                <div style={{ fontSize: 11, color: '#888' }}>사진 {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
