import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import travelApi from '../api/travelApi';

const TRAVEL_STYLES = [
  '맛집 탐방', '감성 카페', '자연/트레킹', '쇼핑', '현지 문화 체험',
  '관광지 위주', '액티비티', '힐링/휴양', '야경/도시 감성',
];

const CURRENCIES = [
  { code: 'KRW', name: '원 (한국)' },
  { code: 'JPY', name: '엔 (일본)' },
  { code: 'USD', name: '달러 (미국)' },
  { code: 'EUR', name: '유로 (유럽)' },
  { code: 'AUD', name: '호주달러' },
  { code: 'THB', name: '바트 (태국)' },
  { code: 'VND', name: '동 (베트남)' },
  { code: 'TWD', name: '대만달러' },
  { code: 'HKD', name: '홍콩달러' },
  { code: 'SGD', name: '싱가포르달러' },
  { code: 'GBP', name: '파운드 (영국)' },
];

export default function TravelCreatePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('auto'); // 'auto' | 'complete'
  const [loading, setLoading] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [existingPlan, setExistingPlan] = useState('');
  const [planImages, setPlanImages] = useState([]); // { preview, data, mimeType }
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    travelers: 2,
    budgetPerPerson: '',
    currency: 'USD',
    exchangeRate: '',
  });

  const compressImage = (file) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const [, data] = dataUrl.split(',');
      resolve({ preview: dataUrl, data, mimeType: 'image/jpeg' });
    };
    img.src = url;
  });

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files);
    const compressed = await Promise.all(files.map(compressImage));
    setPlanImages(prev => [...prev, ...compressed]);
    e.target.value = '';
  };

  const removePlanImage = (idx) => {
    setPlanImages(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleStyle = (s) => {
    setSelectedStyles(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.destination.trim()) return alert('여행지를 입력해주세요.');
    if (!form.title.trim()) {
      form.title = form.destination + ' 여행';
    }

    setLoading(true);
    try {
      const tripData = {
        ...form,
        travelers: Number(form.travelers) || 2,
        budgetPerPerson: form.budgetPerPerson ? Number(form.budgetPerPerson) : null,
        exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
        travelStyle: selectedStyles.join(', '),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      };

      const trip = await travelApi.createTrip(tripData);

      if (mode === 'auto') {
        await travelApi.generatePlan(trip.id);
      } else if (mode === 'complete' && (existingPlan.trim() || planImages.length > 0)) {
        const images = planImages.map(({ data, mimeType }) => ({ data, mimeType }));
        await travelApi.completePlan(trip.id, existingPlan, images.length > 0 ? images : undefined);
      }

      navigate(`/travel/${trip.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'AI 계획 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h2 style={styles.title}>새 여행 계획</h2>

        {/* 모드 선택 */}
        <div style={styles.modeRow}>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'auto' ? styles.modeBtnActive : {}) }}
            onClick={() => setMode('auto')}
          >
            AI 자동 생성
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'complete' ? styles.modeBtnActive : {}) }}
            onClick={() => setMode('complete')}
          >
            기존 계획 완성하기
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>여행 제목</label>
              <input
                style={styles.input}
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="예: 2025년 봄 일본 여행"
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>여행지 <span style={styles.req}>*</span></label>
              <input
                style={styles.input}
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="예: 일본 도쿄 & 오사카"
                required
              />
            </div>
          </div>

          <div style={{ ...styles.row, gap: 12 }}>
            <div style={styles.field}>
              <label style={styles.label}>출발일</label>
              <input style={styles.input} type="date" name="startDate" value={form.startDate} onChange={handleChange} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>귀국일</label>
              <input style={styles.input} type="date" name="endDate" value={form.endDate} onChange={handleChange} />
            </div>
          </div>

          <div style={{ ...styles.row, gap: 12 }}>
            <div style={styles.field}>
              <label style={styles.label}>인원</label>
              <input
                style={styles.input}
                type="number"
                name="travelers"
                value={form.travelers}
                onChange={handleChange}
                min={1} max={20}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>1인 예산 (원)</label>
              <input
                style={styles.input}
                type="number"
                name="budgetPerPerson"
                value={form.budgetPerPerson}
                onChange={handleChange}
                placeholder="예: 2000000"
              />
            </div>
          </div>

          <div style={{ ...styles.row, gap: 12 }}>
            <div style={styles.field}>
              <label style={styles.label}>현지 통화</label>
              <select style={styles.input} name="currency" value={form.currency} onChange={handleChange}>
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>환율 (1{form.currency} = ?원)</label>
              <input
                style={styles.input}
                type="number"
                name="exchangeRate"
                value={form.exchangeRate}
                onChange={handleChange}
                placeholder="예: 900"
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>여행 스타일 (복수 선택)</label>
            <div style={styles.tagRow}>
              {TRAVEL_STYLES.map(s => (
                <button
                  key={s}
                  type="button"
                  style={{
                    ...styles.tag,
                    ...(selectedStyles.includes(s) ? styles.tagActive : {}),
                  }}
                  onClick={() => toggleStyle(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {mode === 'complete' && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>계획 사진 업로드 (선택)</label>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  손으로 쓴 계획, 캡처 이미지 등을 올리면 AI가 읽어서 반영합니다.
                </p>
                <label style={styles.imgUploadBtn}>
                  사진 선택
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                </label>
                {planImages.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    {planImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img
                          src={img.preview}
                          alt=""
                          style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <button
                          type="button"
                          onClick={() => removePlanImage(idx)}
                          style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 20, height: 20, borderRadius: '50%',
                            background: '#ef4444', color: '#fff', border: 'none',
                            cursor: 'pointer', fontSize: 11, lineHeight: '20px', textAlign: 'center',
                          }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={styles.field}>
                <label style={styles.label}>기존 계획 텍스트 (선택)</label>
                <textarea
                  style={{ ...styles.input, height: 140, resize: 'vertical' }}
                  value={existingPlan}
                  onChange={e => setExistingPlan(e.target.value)}
                  placeholder="텍스트로 된 계획도 함께 입력하면 AI가 합쳐서 완성해줍니다."
                />
              </div>
            </>
          )}

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading
              ? 'AI가 여행 계획을 짜는 중...'
              : mode === 'auto' ? 'AI로 여행 계획 생성' : '계획 완성하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '32px 24px', minHeight: '80vh' },
  inner: { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  title: { margin: '0 0 24px', fontSize: 22, fontWeight: 700 },
  modeRow: { display: 'flex', gap: 8, marginBottom: 28 },
  modeBtn: {
    flex: 1, padding: '10px 0', border: '2px solid #e5e7eb', borderRadius: 8,
    background: '#f9fafb', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#6b7280',
  },
  modeBtnActive: { borderColor: '#2ecc71', background: '#f0fdf4', color: '#16a34a' },
  row: { display: 'flex', gap: 0 },
  field: { flex: 1, marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  req: { color: '#ef4444' },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
  },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: {
    padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 20,
    background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#6b7280',
  },
  tagActive: { borderColor: '#2ecc71', background: '#dcfce7', color: '#16a34a', fontWeight: 600 },
  submitBtn: {
    width: '100%', marginTop: 24, padding: '14px 0',
    background: '#2ecc71', color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  imgUploadBtn: {
    display: 'inline-block', padding: '8px 16px',
    border: '1px solid #d1d5db', borderRadius: 8,
    background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#374151',
  },
};
