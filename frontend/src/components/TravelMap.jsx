import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CAT_COLOR = {
  식사: '#f59e0b', 활동: '#10b981', 쇼핑: '#ec4899',
  숙소: '#8b5cf6', 기타: '#6b7280',
};

const makeIcon = (color, day) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:${color};border-radius:50%;
    border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:11px;font-weight:700;line-height:1">${day}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ko`;
    const res = await fetch(url, { headers: { 'User-Agent': 'travel-planner-auto-blog' } });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    return null;
  } catch { return null; }
}

function FitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 1) {
      const bounds = markers.map(m => [m.lat, m.lng]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers.length]);
  return null;
}

// 특정 활동으로 지도 이동 + 팝업 열기
function MapController({ highlightActivity, markers, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!highlightActivity) return;
    const target = markers.find(m => m.activity === highlightActivity);
    if (target) {
      map.flyTo([target.lat, target.lng], 16, { duration: 1 });
      setTimeout(() => {
        const ref = markerRefs.current[highlightActivity];
        if (ref) ref.openPopup();
      }, 1100);
    }
  }, [highlightActivity]);
  return null;
}

export default function TravelMap({ trip, items, highlightActivity }) {
  const [center, setCenter] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loadingText, setLoadingText] = useState('지도 로딩 중...');
  const cancelRef = useRef(false);
  const markerRefs = useRef({});

  useEffect(() => {
    cancelRef.current = false;
    setMarkers([]);
    setCenter(null);
    setLoadingText('위치 검색 중...');

    async function load() {
      // 1. 여행지 중심 좌표
      const destCoord = await geocode(trip.destination);
      if (cancelRef.current) return;
      if (destCoord) setCenter(destCoord);

      // 2. 의미있는 활동만 geocode (교통·항공 제외)
      const filtered = items.filter(i =>
        !['교통', '항공'].includes(i.category) && i.activity?.trim().length > 1
      );
      const seen = new Set();
      const unique = filtered.filter(i => {
        const k = i.activity.trim();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 15);

      setLoadingText(`마커 추가 중 (0 / ${unique.length})`);

      let done = 0;
      for (const item of unique) {
        if (cancelRef.current) return;

        let coord = null;
        if (item.lat && item.lng) {
          // 위도/경도 직접 입력된 경우 바로 사용 (geocoding 불필요)
          coord = [Number(item.lat), Number(item.lng)];
        } else {
          // 없으면 활동명+여행지로 Nominatim geocoding 시도
          coord = await geocode(`${item.activity}, ${trip.destination}`);
          await sleep(1100);
        }

        done++;
        setLoadingText(`마커 추가 중 (${done} / ${unique.length})`);
        if (coord && !cancelRef.current) {
          setCenter(prev => prev || coord);
          setMarkers(prev => [...prev, {
            lat: coord[0], lng: coord[1],
            activity: item.activity,
            dayNumber: item.dayNumber,
            timeStart: item.timeStart,
            timeEnd: item.timeEnd,
            category: item.category || '기타',
          }]);
        }
      }
      if (!cancelRef.current) setLoadingText('');
    }

    load();
    return () => { cancelRef.current = true; };
  }, [trip.id, items.map(i => i.id).join(',')]);

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 20, border: '1px solid #e5e7eb', position: 'relative', isolation: 'isolate' }}>
      {/* leaflet-div-icon 기본 흰 배경·테두리 제거 */}
      <style>{`.leaflet-div-icon { background: transparent !important; border: none !important; }`}</style>

      {loadingText && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          background: 'rgba(255,255,255,0.92)', padding: '4px 12px',
          borderRadius: 20, fontSize: 12, color: '#6b7280', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          📍 {loadingText}
        </div>
      )}
      {center ? (
        <MapContainer center={center} zoom={13} style={{ height: 320, width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds markers={markers} />
          <MapController
            highlightActivity={highlightActivity}
            markers={markers}
            markerRefs={markerRefs}
          />
          {markers.map((m, idx) => (
            <Marker
              key={idx}
              position={[m.lat, m.lng]}
              icon={makeIcon(CAT_COLOR[m.category] || '#6b7280', m.dayNumber)}
              ref={el => { if (el) markerRefs.current[m.activity] = el; }}
            >
              <Popup>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.activity}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {m.dayNumber}일차
                    {m.timeStart ? ` · ${m.timeStart}~${m.timeEnd}` : ''}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', color: '#9ca3af', fontSize: 14 }}>
          {loadingText || '위치를 찾을 수 없습니다.'}
        </div>
      )}
      {markers.length > 0 && (
        <div style={{ padding: '8px 12px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(CAT_COLOR).map(([cat, color]) => {
            const count = markers.filter(m => m.category === cat).length;
            if (!count) return null;
            return (
              <span key={cat} style={{ fontSize: 11, color: '#fff', background: color, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                {cat} {count}
              </span>
            );
          })}
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
            총 {markers.length}개 장소
          </span>
        </div>
      )}
    </div>
  );
}
