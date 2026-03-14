import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import travelApi from '../api/travelApi';

function dDayLabel(startDate) {
  if (!startDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diff = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function statusLabel(status) {
  const map = { PLANNING: '계획중', CONFIRMED: '확정', COMPLETED: '완료' };
  return map[status] || status;
}
function statusColor(status) {
  const map = { PLANNING: '#3b82f6', CONFIRMED: '#10b981', COMPLETED: '#6b7280' };
  return map[status] || '#6b7280';
}

export default function TravelListPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    travelApi.getTrips()
      .then(setTrips)
      .catch(e => alert(e.response?.data?.error || '불러오기 실패'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('이 여행을 삭제하시겠습니까?')) return;
    await travelApi.deleteTrip(id);
    setTrips(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <div style={styles.center}>불러오는 중...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>내 여행 목록</h2>
        <button style={styles.newBtn} onClick={() => navigate('/travel/new')}>
          + 새 여행 계획
        </button>
      </div>

      {trips.length === 0 ? (
        <div style={styles.empty}>
          <p>아직 여행 계획이 없습니다.</p>
          <button style={styles.newBtn} onClick={() => navigate('/travel/new')}>
            첫 여행 계획 만들기
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {trips.map(trip => {
            const dday = dDayLabel(trip.startDate);
            return (
              <div key={trip.id} style={styles.card} onClick={() => navigate(`/travel/${trip.id}`)}>
                <div style={styles.cardTop}>
                  <span style={{ ...styles.statusBadge, backgroundColor: statusColor(trip.status) }}>
                    {statusLabel(trip.status)}
                  </span>
                  {dday && (
                    <span style={{
                      ...styles.ddayBadge,
                      backgroundColor: dday === 'D-Day' ? '#ef4444' : '#f59e0b',
                    }}>
                      {dday}
                    </span>
                  )}
                  <button style={styles.deleteBtn} onClick={(e) => handleDelete(trip.id, e)}>✕</button>
                </div>
                <h3 style={styles.cardTitle}>{trip.title}</h3>
                <p style={styles.cardDest}>📍 {trip.destination}</p>
                <p style={styles.cardDate}>
                  {trip.startDate && trip.endDate
                    ? `${trip.startDate} ~ ${trip.endDate}`
                    : trip.startDate || '날짜 미정'}
                </p>
                <p style={styles.cardMeta}>
                  👥 {trip.travelers || 1}명
                  {trip.currency && ` · ${trip.currency}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '32px 24px', maxWidth: 900, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { margin: 0, fontSize: 22, fontWeight: 700 },
  newBtn: {
    padding: '10px 20px', background: '#2ecc71', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  empty: { textAlign: 'center', padding: '80px 0', color: '#888' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: 20, cursor: 'pointer', transition: 'box-shadow 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusBadge: {
    color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px',
    borderRadius: 20, marginRight: 'auto',
  },
  ddayBadge: {
    color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
  },
  deleteBtn: {
    background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
    fontSize: 14, padding: 2, marginLeft: 'auto',
  },
  cardTitle: { margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1f2937' },
  cardDest: { margin: '0 0 4px', fontSize: 13, color: '#4b5563' },
  cardDate: { margin: '0 0 4px', fontSize: 12, color: '#6b7280' },
  cardMeta: { margin: 0, fontSize: 12, color: '#9ca3af' },
  center: { textAlign: 'center', padding: 60, color: '#888' },
};
