import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { imageApi } from '../api/imageApi';
import { draftApi } from '../api/draftApi';
import travelApi from '../api/travelApi';

const CATEGORIES = ['여행', '맛집', '숙소', '카페', '기타'];
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default function CreatePostPage() {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [form, setForm] = useState({
    destination: '',
    travelDates: '',
    itinerary: '',
    keyPoints: '',
    category: '여행',
  });

  useEffect(() => {
    travelApi.getTrips().then(setTrips).catch(() => {});
  }, []);

  const handleTripSelect = (tripId) => {
    setSelectedTripId(tripId);
    if (!tripId) return;
    const trip = trips.find(t => String(t.id) === String(tripId));
    if (!trip) return;
    setForm(prev => ({
      ...prev,
      destination: trip.destination || prev.destination,
      travelDates: trip.startDate && trip.endDate
        ? `${trip.startDate} ~ ${trip.endDate}`
        : prev.travelDates,
    }));
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);
    setError('');
    try {
      const uploaded = await imageApi.upload(acceptedFiles, null);
      setUploadedImages(prev => [...prev, ...uploaded]);
      setImages(prev => [
        ...prev,
        ...acceptedFiles.map((f, i) => ({
          file: f,
          preview: URL.createObjectURL(f),
          id: uploaded[i]?.id,
        }))
      ]);
    } catch (e) {
      setError('이미지 업로드 실패: ' + e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    multiple: true,
  });

  const removeImage = (idx) => {
    const newImages = [...images];
    const removed = newImages.splice(idx, 1)[0];
    setImages(newImages);
    if (removed.id) {
      imageApi.delete(removed.id).catch(console.error);
      setUploadedImages(prev => prev.filter(i => i.id !== removed.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.destination) {
      setError('여행지를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const draft = await draftApi.create({
        ...form,
        images: uploadedImages,
        tripId: selectedTripId ? Number(selectedTripId) : null,
      });
      navigate(`/editor/${draft.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="section-title">새 여행 블로그 작성</h1>

      <form onSubmit={handleSubmit}>
        {/* 이미지 업로드 */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>여행 사진 업로드</h2>

          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? '#03c75a' : '#ddd'}`,
              borderRadius: 10,
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragActive ? '#f0fff8' : '#fafafa',
              transition: 'all 0.2s',
            }}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <span className="spinner" />
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                <p style={{ color: '#888', fontSize: 14 }}>
                  {isDragActive ? '여기에 놓으세요!' : '사진을 드래그하거나 클릭하여 업로드'}
                </p>
                <p style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>JPG, PNG, GIF, WebP (최대 20MB)</p>
              </>
            )}
          </div>

          {images.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img
                    src={img.preview}
                    alt=""
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#ff4757', color: 'white', border: 'none',
                      cursor: 'pointer', fontSize: 12, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >x</button>
                  <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4 }}>
                    사진 {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 여행 계획 연결 */}
        {trips.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #2ecc71' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>여행 계획 연결 (선택)</h2>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              내 여행 플래너의 일정·경비·정보를 AI가 블로그에 자동으로 반영합니다.
            </p>
            <select
              value={selectedTripId}
              onChange={e => handleTripSelect(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            >
              <option value="">연결 안 함 (직접 입력)</option>
              {trips.map(trip => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} — {trip.destination}
                  {trip.startDate ? ` (${trip.startDate})` : ''}
                </option>
              ))}
            </select>
            {selectedTripId && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#166534' }}>
                ✅ 일정·경비·여행 정보가 AI 글쓰기에 반영됩니다.
                <button
                  type="button"
                  style={{ marginLeft: 12, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => navigate(`/travel/${selectedTripId}`)}
                >
                  계획 보기 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* 여행 정보 입력 */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>여행 정보 입력</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>여행지 *</label>
              <input
                type="text"
                placeholder="예: 제주도, 부산, 도쿄"
                value={form.destination}
                onChange={e => setForm({...form, destination: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>여행 날짜</label>
              <input
                type="text"
                placeholder="예: 2025-12-24 ~ 2025-12-27"
                value={form.travelDates}
                onChange={e => setForm({...form, travelDates: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>카테고리</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>여행 일정 / 개요</label>
            <textarea
              placeholder="1일차: 공항 도착, 호텔 체크인, 시내 관광&#10;2일차: 올레길 트레킹, 해산물 점심, 성산일출봉..."
              value={form.itinerary}
              onChange={e => setForm({...form, itinerary: e.target.value})}
              style={{ minHeight: 120 }}
            />
          </div>

          <div className="form-group">
            <label>강조하고 싶은 포인트</label>
            <textarea
              placeholder="- 맛있었던 음식점 이름과 메뉴&#10;- 특히 좋았던 장소나 뷰&#10;- 여행 꿀팁&#10;- 숙소 후기..."
              value={form.keyPoints}
              onChange={e => setForm({...form, keyPoints: e.target.value})}
              style={{ minHeight: 100 }}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: '#ff4757', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
            {submitting ? <span className="spinner" /> : 'AI 글 생성하러 가기'}
          </button>
        </div>
      </form>
    </div>
  );
}
