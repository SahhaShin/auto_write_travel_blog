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
  const markerRefs = useRef({});

  useEffect(() => {
    // 위경도가 입력된 활동만 마커로 표시
    const newMarkers = items
      .filter(i => i.lat && i.lng)
      .map(item => ({
        lat: Number(item.lat), lng: Number(item.lng),
        activity: item.activity,
        dayNumber: item.dayNumber,
        timeStart: item.timeStart,
        timeEnd: item.timeEnd,
        category: item.category || '기타',
      }));
    setMarkers(newMarkers);
    setCenter(newMarkers.length > 0 ? [newMarkers[0].lat, newMarkers[0].lng] : null);
  }, [trip.id, items.map(i => `${i.id}:${i.lat}:${i.lng}`).join(',')]);

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 20, border: '1px solid #e5e7eb', position: 'relative', isolation: 'isolate' }}>
      {/* leaflet-div-icon 기본 흰 배경·테두리 제거 */}
      <style>{`.leaflet-div-icon { background: transparent !important; border: none !important; }`}</style>


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
          일정에 위도/경도를 입력하면 지도에 표시됩니다.
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
