import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import travelApi from '../api/travelApi';

const TABS = ['사전 준비', '여행 일정', '서류 준비', '짐 싸기', '경비', '각종 정보'];
const CATEGORIES_ITINERARY = ['교통', '식사', '활동', '항공', '숙소', '기타'];
const CATEGORIES_EXPENSE = ['교통', '식사', '활동', '쇼핑', '숙소', '기타'];

const categoryColor = {
  교통: '#3b82f6', 식사: '#f59e0b', 활동: '#10b981',
  항공: '#6366f1', 숙소: '#8b5cf6', 쇼핑: '#ec4899', 기타: '#6b7280',
};

// ─── 사전 준비 탭 ────────────────────────────────────────────────────────────
function PrePrepTab({ tripId, items, onChange }) {
  const [newItem, setNewItem] = useState('');
  const statuses = ['NOT_STARTED', '진행중', '완료'];
  const labelMap = { NOT_STARTED: '시작 전', IN_PROGRESS: '진행중', DONE: '완료' };
  const colorMap = { NOT_STARTED: '#e5e7eb', IN_PROGRESS: '#fef3c7', DONE: '#d1fae5' };
  const textMap = { NOT_STARTED: '#6b7280', IN_PROGRESS: '#92400e', DONE: '#065f46' };

  const cols = {
    NOT_STARTED: items.filter(i => i.status === 'NOT_STARTED'),
    IN_PROGRESS: items.filter(i => i.status === 'IN_PROGRESS'),
    DONE: items.filter(i => i.status === 'DONE'),
  };

  const cycleStatus = async (item) => {
    const cycle = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'];
    const next = cycle[(cycle.indexOf(item.status) + 1) % 3];
    await travelApi.updateChecklistStatus(tripId, item.id, next);
    onChange();
  };

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await travelApi.addChecklist(tripId, { category: 'PRE_PREP', item: newItem });
    setNewItem('');
    onChange();
  };

  const handleDelete = async (id) => {
    await travelApi.deleteChecklist(tripId, id);
    onChange();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          style={s.input}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="준비 항목 추가..."
        />
        <button style={s.addBtn} onClick={handleAdd}>추가</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {['NOT_STARTED', 'IN_PROGRESS', 'DONE'].map(status => (
          <div key={status} style={{ background: colorMap[status], borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: textMap[status], marginBottom: 10 }}>
              {labelMap[status]} ({cols[status].length})
            </div>
            {cols[status].map(item => (
              <div key={item.id} style={s.boardCard}>
                <span style={{ flex: 1, fontSize: 13 }}>{item.item}</span>
                <button style={s.cycleBtn} onClick={() => cycleStatus(item)} title="상태 변경">→</button>
                <button style={s.delBtn} onClick={() => handleDelete(item.id)}>✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 여행 일정 탭 ────────────────────────────────────────────────────────────
function ItineraryTab({ trip, items, onChange }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({ dayNumber: 1, timeStart: '', timeEnd: '', activity: '', category: '활동', cost: '', memo: '' });

  const totalDays = trip.startDate && trip.endDate
    ? Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1
    : 1;
  const days = Array.from({ length: Math.max(totalDays, ...items.map(i => i.dayNumber || 1)) }, (_, i) => i + 1);

  const handleSave = async () => {
    if (!form.activity.trim()) return alert('활동을 입력해주세요.');
    const data = { ...form, cost: form.cost ? Number(form.cost) : 0 };
    if (editId) {
      await travelApi.updateItinerary(trip.id, editId, data);
      setEditId(null);
    } else {
      await travelApi.addItinerary(trip.id, data);
      setAdding(false);
    }
    setForm({ dayNumber: 1, timeStart: '', timeEnd: '', activity: '', category: '활동', cost: '', memo: '' });
    onChange();
  };

  const handleEdit = (item) => {
    setForm({
      dayNumber: item.dayNumber, timeStart: item.timeStart || '', timeEnd: item.timeEnd || '',
      activity: item.activity, category: item.category || '활동',
      cost: item.cost || '', memo: item.memo || '',
    });
    setEditId(item.id);
    setAdding(false);
  };

  const handleDelete = async (id) => {
    await travelApi.deleteItinerary(trip.id, id);
    onChange();
  };

  const handleFillGaps = async () => {
    setAiLoading(true);
    try {
      await travelApi.fillGaps(trip.id);
      onChange();
    } catch (e) {
      alert(e.response?.data?.error || 'AI 추천 실패');
    } finally {
      setAiLoading(false);
    }
  };

  const formRow = (
    <tr style={{ background: '#f0fdf4' }}>
      <td style={s.td}>
        <select style={s.inputSm} value={form.dayNumber} onChange={e => setForm(p => ({ ...p, dayNumber: Number(e.target.value) }))}>
          {days.map(d => <option key={d} value={d}>{d}일차</option>)}
        </select>
      </td>
      <td style={s.td}>
        <input style={s.inputSm} placeholder="09:00" value={form.timeStart} onChange={e => setForm(p => ({ ...p, timeStart: e.target.value }))} />
        <span style={{ margin: '0 2px', color: '#aaa' }}>~</span>
        <input style={s.inputSm} placeholder="10:00" value={form.timeEnd} onChange={e => setForm(p => ({ ...p, timeEnd: e.target.value }))} />
      </td>
      <td style={s.td}>
        <input style={{ ...s.inputSm, width: 200 }} placeholder="활동 입력" value={form.activity} onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} />
      </td>
      <td style={s.td}>
        <select style={s.inputSm} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
          {CATEGORIES_ITINERARY.map(c => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td style={s.td}>
        <input style={s.inputSm} type="number" placeholder="0" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
      </td>
      <td style={s.td}>
        <input style={{ ...s.inputSm, width: 140 }} placeholder="메모" value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} />
      </td>
      <td style={s.td}>
        <button style={s.saveBtn} onClick={handleSave}>저장</button>
        <button style={s.cancelBtn} onClick={() => { setAdding(false); setEditId(null); }}>취소</button>
      </td>
    </tr>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
        <button style={s.aiBtn} onClick={handleFillGaps} disabled={aiLoading}>
          {aiLoading ? '분석 중...' : '✨ AI 빈 시간 채우기'}
        </button>
        <button style={s.addBtn} onClick={() => { setAdding(true); setEditId(null); }}>+ 일정 추가</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={s.th}>일차</th>
              <th style={s.th}>시간</th>
              <th style={s.th}>일정</th>
              <th style={s.th}>카테고리</th>
              <th style={s.th}>경비({trip.currency || '현지'})</th>
              <th style={s.th}>비고</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {adding && formRow}
            {days.map(day => {
              const dayItems = items.filter(i => i.dayNumber === day);
              const dateStr = trip.startDate
                ? new Date(new Date(trip.startDate).getTime() + (day - 1) * 86400000)
                    .toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
                : null;
              if (dayItems.length === 0 && !adding) return null;
              return [
                <tr key={`day-${day}`}>
                  <td colSpan={7} style={s.dayHeader}>
                    <span style={s.dayBadge}>{day}일차</span>
                    {dateStr && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{dateStr}</span>}
                  </td>
                </tr>,
                ...dayItems.map(item =>
                  editId === item.id ? (
                    <tr key={item.id} style={{ background: '#f0fdf4' }}>
                      <td style={s.td}>
                        <select style={s.inputSm} value={form.dayNumber} onChange={e => setForm(p => ({ ...p, dayNumber: Number(e.target.value) }))}>
                          {days.map(d => <option key={d} value={d}>{d}일차</option>)}
                        </select>
                      </td>
                      <td style={s.td}>
                        <input style={s.inputSm} placeholder="09:00" value={form.timeStart} onChange={e => setForm(p => ({ ...p, timeStart: e.target.value }))} />
                        <span style={{ margin: '0 2px', color: '#aaa' }}>~</span>
                        <input style={s.inputSm} placeholder="10:00" value={form.timeEnd} onChange={e => setForm(p => ({ ...p, timeEnd: e.target.value }))} />
                      </td>
                      <td style={s.td}>
                        <input style={{ ...s.inputSm, width: 200 }} value={form.activity} onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} />
                      </td>
                      <td style={s.td}>
                        <select style={s.inputSm} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                          {CATEGORIES_ITINERARY.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={s.td}>
                        <input style={s.inputSm} type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                      </td>
                      <td style={s.td}>
                        <input style={{ ...s.inputSm, width: 140 }} value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} />
                      </td>
                      <td style={s.td}>
                        <button style={s.saveBtn} onClick={handleSave}>저장</button>
                        <button style={s.cancelBtn} onClick={() => setEditId(null)}>취소</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...s.td, color: '#9ca3af', fontSize: 12 }}>{item.dayNumber}일차</td>
                      <td style={{ ...s.td, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {item.timeStart && item.timeEnd ? `${item.timeStart}~${item.timeEnd}` : item.timeStart || '-'}
                      </td>
                      <td style={{ ...s.td, fontWeight: 500 }}>{item.activity}</td>
                      <td style={s.td}>
                        <span style={{ ...s.catBadge, background: categoryColor[item.category] || '#6b7280' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: 13 }}>
                        {item.cost > 0 ? `${Number(item.cost).toLocaleString()}` : '-'}
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: '#6b7280' }}>{item.memo || '-'}</td>
                      <td style={s.td}>
                        <button style={s.iconBtn} onClick={() => handleEdit(item)}>✏️</button>
                        <button style={s.iconBtn} onClick={() => handleDelete(item.id)}>🗑️</button>
                      </td>
                    </tr>
                  )
                ),
              ];
            })}
          </tbody>
        </table>
        {items.length === 0 && !adding && (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
            일정이 없습니다. AI 생성 또는 직접 추가해주세요.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 체크리스트 탭 (서류 준비 / 짐 싸기 공용) ────────────────────────────────
function ChecklistTab({ tripId, items, category, onChange }) {
  const [newItem, setNewItem] = useState('');

  const handleToggle = async (item) => {
    const next = item.status === 'DONE' ? 'NOT_STARTED' : 'DONE';
    await travelApi.updateChecklistStatus(tripId, item.id, next);
    onChange();
  };

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await travelApi.addChecklist(tripId, { category, item: newItem, status: 'NOT_STARTED' });
    setNewItem('');
    onChange();
  };

  const handleDelete = async (id) => {
    await travelApi.deleteChecklist(tripId, id);
    onChange();
  };

  const done = items.filter(i => i.status === 'DONE').length;

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
        {done} / {items.length} 완료
        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, marginTop: 6 }}>
          <div style={{ height: 4, background: '#10b981', borderRadius: 4, width: items.length ? `${(done / items.length) * 100}%` : '0%', transition: 'width 0.3s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={s.input}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="항목 추가..."
        />
        <button style={s.addBtn} onClick={handleAdd}>추가</button>
      </div>
      {items.map(item => (
        <div key={item.id} style={{ ...s.checkRow, opacity: item.status === 'DONE' ? 0.5 : 1 }}>
          <input
            type="checkbox"
            checked={item.status === 'DONE'}
            onChange={() => handleToggle(item)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ flex: 1, fontSize: 14, textDecoration: item.status === 'DONE' ? 'line-through' : 'none' }}>
            {item.item}
          </span>
          <button style={s.delBtn} onClick={() => handleDelete(item.id)}>✕</button>
        </div>
      ))}
      {items.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 32 }}>
          항목이 없습니다. 추가해주세요.
        </p>
      )}
    </div>
  );
}

// ─── 경비 탭 ─────────────────────────────────────────────────────────────────
function ExpenseTab({ trip, items, onChange }) {
  const [form, setForm] = useState({ expenseDate: '', item: '', category: '식사', paymentMethod: '카드', amount: '', amountKrw: '', memo: '', settled: false });
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);

  const currency = trip.currency || '현지';
  const exchangeRate = trip.exchangeRate;

  const handleAmountChange = (val) => {
    setForm(prev => {
      const updated = { ...prev, amount: val };
      if (exchangeRate && val) {
        updated.amountKrw = Math.round(Number(val) * Number(exchangeRate));
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.item.trim()) return alert('항목을 입력해주세요.');
    const data = {
      ...form,
      amount: form.amount ? Number(form.amount) : null,
      amountKrw: form.amountKrw ? Number(form.amountKrw) : null,
    };
    if (editId) {
      await travelApi.updateExpense(trip.id, editId, data);
      setEditId(null);
    } else {
      await travelApi.addExpense(trip.id, data);
      setAdding(false);
    }
    setForm({ expenseDate: '', item: '', category: '식사', paymentMethod: '카드', amount: '', amountKrw: '', memo: '', settled: false });
    onChange();
  };

  const handleEdit = (exp) => {
    setForm({
      expenseDate: exp.expenseDate || '',
      item: exp.item, category: exp.category || '식사',
      paymentMethod: exp.paymentMethod || '카드',
      amount: exp.amount || '', amountKrw: exp.amountKrw || '',
      memo: exp.memo || '', settled: exp.settled || false,
    });
    setEditId(exp.id);
    setAdding(false);
  };

  const handleDelete = async (id) => {
    await travelApi.deleteExpense(trip.id, id);
    onChange();
  };

  // 요약 계산
  const totalLocal = items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalKrw = items.reduce((sum, e) => sum + Number(e.amountKrw || 0), 0);
  const perPersonLocal = items.reduce((sum, e) => sum + Number(e.amountPerPerson || 0), 0);
  const perPersonKrw = items.reduce((sum, e) => sum + Number(e.amountKrwPerPerson || 0), 0);

  const catSummary = {};
  items.forEach(e => {
    catSummary[e.category] = (catSummary[e.category] || 0) + Number(e.amountKrw || 0);
  });

  const formRow = (isEdit) => (
    <tr style={{ background: '#f0fdf4' }}>
      <td style={s.td}><input type="date" style={s.inputSm} value={form.expenseDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))} /></td>
      <td style={s.td}><input style={{ ...s.inputSm, width: 140 }} placeholder="항목명" value={form.item} onChange={e => setForm(p => ({ ...p, item: e.target.value }))} /></td>
      <td style={s.td}>
        <select style={s.inputSm} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
          {CATEGORIES_EXPENSE.map(c => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td style={s.td}>
        <select style={s.inputSm} value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}>
          <option>카드</option><option>현금</option>
        </select>
      </td>
      <td style={s.td}><input type="number" style={s.inputSm} placeholder="0" value={form.amount} onChange={e => handleAmountChange(e.target.value)} /></td>
      <td style={s.td}><input type="number" style={s.inputSm} placeholder="0" value={form.amountKrw} onChange={e => setForm(p => ({ ...p, amountKrw: e.target.value }))} /></td>
      <td style={s.td}><input style={{ ...s.inputSm, width: 100 }} placeholder="메모" value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} /></td>
      <td style={s.td}>
        <button style={s.saveBtn} onClick={handleSave}>저장</button>
        <button style={s.cancelBtn} onClick={() => { setAdding(false); setEditId(null); }}>취소</button>
      </td>
    </tr>
  );

  return (
    <div>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: `합계 (${currency})`, value: totalLocal.toLocaleString() },
          { label: '합계 (원)', value: totalKrw ? `₩${totalKrw.toLocaleString()}` : '-' },
          { label: `1인 (${currency})`, value: perPersonLocal.toLocaleString() },
          { label: '1인 (원)', value: perPersonKrw ? `₩${perPersonKrw.toLocaleString()}` : '-' },
        ].map(({ label, value }) => (
          <div key={label} style={s.summaryCard}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{value}</div>
          </div>
        ))}
      </div>
      {/* 카테고리별 요약 */}
      {Object.keys(catSummary).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(catSummary).map(([cat, krw]) => (
            <span key={cat} style={{ ...s.catBadge, background: categoryColor[cat] || '#6b7280', fontSize: 12, padding: '3px 10px' }}>
              {cat} ₩{krw.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button style={s.addBtn} onClick={() => { setAdding(true); setEditId(null); }}>+ 경비 추가</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={s.th}>날짜</th>
              <th style={s.th}>항목</th>
              <th style={s.th}>카테고리</th>
              <th style={s.th}>결제</th>
              <th style={s.th}>{currency} (합계)</th>
              <th style={s.th}>원화 (합계)</th>
              <th style={s.th}>메모</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {adding && formRow(false)}
            {items.map(exp => (
              editId === exp.id ? formRow(true) : (
                <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...s.td, fontSize: 12, color: '#6b7280' }}>{exp.expenseDate || '-'}</td>
                  <td style={{ ...s.td, fontWeight: 500 }}>{exp.item}</td>
                  <td style={s.td}>
                    <span style={{ ...s.catBadge, background: categoryColor[exp.category] || '#6b7280' }}>
                      {exp.category}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: 12 }}>{exp.paymentMethod || '-'}</td>
                  <td style={{ ...s.td, fontSize: 13 }}>{exp.amount ? Number(exp.amount).toLocaleString() : '-'}</td>
                  <td style={{ ...s.td, fontSize: 13 }}>
                    {exp.amountKrw ? `₩${Number(exp.amountKrw).toLocaleString()}` : '-'}
                    {exp.amountKrwPerPerson ? (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>1인 ₩{Number(exp.amountKrwPerPerson).toLocaleString()}</div>
                    ) : null}
                  </td>
                  <td style={{ ...s.td, fontSize: 12, color: '#6b7280' }}>{exp.memo || '-'}</td>
                  <td style={s.td}>
                    <button style={s.iconBtn} onClick={() => handleEdit(exp)}>✏️</button>
                    <button style={s.iconBtn} onClick={() => handleDelete(exp.id)}>🗑️</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
        {items.length === 0 && !adding && (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>경비 내역이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// ─── 각종 정보 탭 ────────────────────────────────────────────────────────────
function InfoTab({ trip, onChange }) {
  const [sections, setSections] = useState([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (trip.infoContent) {
      try { setSections(JSON.parse(trip.infoContent)); } catch { setSections([]); }
    }
  }, [trip.infoContent]);

  const handleSave = async () => {
    await travelApi.updateInfo(trip.id, JSON.stringify(sections));
    setEditing(false);
    onChange();
  };

  const updateSection = (idx, field, value) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addSection = () => setSections(prev => [...prev, { title: '새 섹션', content: '' }]);
  const removeSection = (idx) => setSections(prev => prev.filter((_, i) => i !== idx));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        {editing ? (
          <>
            <button style={s.addBtn} onClick={addSection}>+ 섹션 추가</button>
            <button style={s.saveBtn} onClick={handleSave}>저장</button>
            <button style={s.cancelBtn} onClick={() => setEditing(false)}>취소</button>
          </>
        ) : (
          <button style={s.addBtn} onClick={() => setEditing(true)}>편집</button>
        )}
      </div>
      {sections.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
          정보가 없습니다. AI 여행 계획 생성 시 자동으로 채워집니다.
        </p>
      ) : (
        sections.map((sec, idx) => (
          <div key={idx} style={s.infoSection}>
            {editing ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    style={{ ...s.input, fontWeight: 700, fontSize: 15 }}
                    value={sec.title}
                    onChange={e => updateSection(idx, 'title', e.target.value)}
                  />
                  <button style={s.delBtn} onClick={() => removeSection(idx)}>✕</button>
                </div>
                <textarea
                  style={{ ...s.input, height: 120, resize: 'vertical', fontSize: 13 }}
                  value={sec.content}
                  onChange={e => updateSection(idx, 'content', e.target.value)}
                />
              </>
            ) : (
              <>
                <h4 style={{ margin: '0 0 8px', color: '#1f2937' }}>{sec.title}</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{sec.content}</p>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function TravelDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const load = useCallback(() => {
    travelApi.getTrip(tripId)
      .then(setTrip)
      .catch(() => navigate('/travel'))
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}>불러오는 중...</div>;
  if (!trip) return null;

  const checklist = trip.checklist || [];
  const prePrepItems = checklist.filter(c => c.category === 'PRE_PREP');
  const docItems = checklist.filter(c => c.category === 'DOCUMENTS');
  const packItems = checklist.filter(c => c.category === 'PACKING');

  const nights = trip.startDate && trip.endDate
    ? Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000)
    : null;

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <button style={s.backBtn} onClick={() => navigate('/travel')}>← 목록</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{trip.title}</h2>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            📍 {trip.destination}
            {nights != null && ` · ${nights}박${nights + 1}일`}
            {trip.travelers && ` · ${trip.travelers}명`}
            {trip.currency && trip.exchangeRate && ` · 1${trip.currency} = ₩${Number(trip.exchangeRate).toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* 탭 */}
      <div style={s.tabBar}>
        {TABS.map((t, i) => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === i ? s.tabBtnActive : {}) }}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={s.tabContent}>
        {tab === 0 && <PrePrepTab tripId={tripId} items={prePrepItems} onChange={load} />}
        {tab === 1 && <ItineraryTab trip={trip} items={trip.itinerary || []} onChange={load} />}
        {tab === 2 && <ChecklistTab tripId={tripId} items={docItems} category="DOCUMENTS" onChange={load} />}
        {tab === 3 && <ChecklistTab tripId={tripId} items={packItems} category="PACKING" onChange={load} />}
        {tab === 4 && <ExpenseTab trip={trip} items={trip.expenses || []} onChange={load} />}
        {tab === 5 && <InfoTab trip={trip} onChange={load} />}
      </div>
    </div>
  );
}

// ─── 공용 스타일 ─────────────────────────────────────────────────────────────
const s = {
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' },
  inputSm: { padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 },
  addBtn: { padding: '8px 16px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' },
  aiBtn: { padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' },
  saveBtn: { padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  cancelBtn: { padding: '4px 10px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  delBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12, padding: '2px 4px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' },
  cycleBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 4px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#6b7280', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', verticalAlign: 'middle' },
  dayHeader: { padding: '10px 10px 4px', background: 'transparent' },
  dayBadge: { background: '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 },
  catBadge: { color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12 },
  boardCard: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 6, padding: '8px 10px', marginBottom: 6, fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
  infoSection: { background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 },
  summaryCard: { background: '#f9fafb', borderRadius: 8, padding: 14, border: '1px solid #e5e7eb' },
  tabBar: { display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 24 },
  tabBtn: { padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#9ca3af', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabBtnActive: { color: '#2ecc71', borderBottomColor: '#2ecc71' },
  tabContent: { background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  backBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, padding: 0 },
};
