'use client';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export default function Home() {
  const [foodText, setFoodText] = useState('');
  const [foodImages, setFoodImages] = useState<File[]>([]);
  const [loggedAt, setLoggedAt] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, protein_g: 0 });
  const [todayEntries, setTodayEntries] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '', happened_at: '' });

  const [measurementFiles, setMeasurementFiles] = useState<File[]>([]);
  const [measuredAt, setMeasuredAt] = useState('');
  const [measurementLoading, setMeasurementLoading] = useState(false);
  const [measurementResult, setMeasurementResult] = useState<any>(null);
  const [measurementError, setMeasurementError] = useState('');
  const [measurementHistory, setMeasurementHistory] = useState<any[]>([]);

  const [activityText, setActivityText] = useState('');
  const [activityImages, setActivityImages] = useState<File[]>([]);
  const [activityAt, setActivityAt] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityResult, setActivityResult] = useState<any>(null);
  const [activityError, setActivityError] = useState('');
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityEditForm, setActivityEditForm] = useState({ activity_type: '', duration_min: '', kcal_burned: '', happened_at: '' });

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
const [pendingConfirm, setPendingConfirm] = useState<any>(null);

  const [bmrExplainerOpen, setBmrExplainerOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('bmrExplainerOpen');
    if (saved !== null) {
      setBmrExplainerOpen(saved === 'true');
    }
  }, []);
  function nowForInput() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function average(entries: any[], key: string) {
    const values = entries.map((e) => e[key]).filter((v) => v !== null && v !== undefined);
    if (values.length === 0) return null;
    const sum = values.reduce((a: number, b: number) => a + b, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  function fmtDelta(n: number | null, unit: string) {
    if (n === null) return '—';
    const sign = n > 0 ? '+' : '';
    return sign + n + unit;
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    setLoggedAt(nowForInput());
    setMeasuredAt(nowForInput());
    setActivityAt(nowForInput());
  }, []);

  async function fetchTodayData() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .gte('happened_at', startOfDay.toISOString())
      .order('happened_at', { ascending: true });
    if (data) {
      const totals = data.reduce(
        (acc, row) => ({
          kcal: acc.kcal + (row.kcal || 0),
          protein_g: acc.protein_g + (row.protein_g || 0),
        }),
        { kcal: 0, protein_g: 0 }
      );
      setTodayTotals(totals);
      setTodayEntries(data);
    }
  }

  async function fetchMeasurementHistory() {
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .order('measured_at', { ascending: false });
    if (data) {
      setMeasurementHistory(data);
    }
  }

  async function fetchTodayActivities() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .gte('happened_at', startOfDay.toISOString())
      .order('happened_at', { ascending: true });
    if (data) {
      setTodayActivities(data);
    }
  }

  async function fetchRecentActivities() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .gte('happened_at', sevenDaysAgo.toISOString())
      .order('happened_at', { ascending: false });
    if (data) {
      setRecentActivities(data);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Delete this entry?');
    if (!confirmed) return;
    await fetch('/api/delete-food', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchTodayData();
  }

  useEffect(() => {
    fetchTodayData();
    fetchMeasurementHistory();
    fetchTodayActivities();
    fetchRecentActivities();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const images = [];
    for (const file of foodImages) {
      const imageBase64 = await fileToBase64(file);
      images.push({ imageBase64, mediaType: file.type });
    }

    const res = await fetch('/api/parse-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        foodText,
        happenedAt: new Date(loggedAt).toISOString(),
        images,
      }),
    });
    const data = await res.json();
    setResult(data);
    setFoodText('');
    setFoodImages([]);
    setLoggedAt(nowForInput());
    setLoading(false);
    fetchTodayData();
  }

  function startEdit(entry: any) {
    setEditingId(entry.id);
    const dt = new Date(entry.happened_at);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setEditForm({
      kcal: String(entry.kcal ?? ''),
      protein_g: String(entry.protein_g ?? ''),
      carbs_g: String(entry.carbs_g ?? ''),
      fat_g: String(entry.fat_g ?? ''),
      happened_at: dt.toISOString().slice(0, 16),
    });
  }

  async function saveEdit(id: string) {
    await fetch('/api/edit-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        kcal: Number(editForm.kcal),
        protein_g: Number(editForm.protein_g),
        carbs_g: Number(editForm.carbs_g),
        fat_g: Number(editForm.fat_g),
        happened_at: new Date(editForm.happened_at).toISOString(),
      }),
    });
    setEditingId(null);
    fetchTodayData();
  }

  async function handleMeasurementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (measurementFiles.length === 0) return;
    setMeasurementLoading(true);
    setMeasurementError('');
    setMeasurementResult(null);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    let lastResult = null;

    for (const file of measurementFiles) {
      try {
        const imageBase64 = await fileToBase64(file);
        let res = await fetch('/api/parse-body-measurement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            mediaType: file.type,
            measuredAt: new Date(measuredAt).toISOString(),
          }),
        });
        let data = await res.json();

        if (data.duplicate) {
          const existingDate = new Date(data.existingEntry.measured_at).toLocaleDateString();
          const confirmed = window.confirm(
            `A reading already exists for ${existingDate} (${data.existingEntry.weight_kg}kg). Overwrite it with the new reading?`
          );
          if (confirmed) {
            res = await fetch('/api/parse-body-measurement', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-force-replace': 'true' },
              body: JSON.stringify({
                imageBase64,
                mediaType: file.type,
                measuredAt: new Date(measuredAt).toISOString(),
              }),
            });
            data = await res.json();
            if (!data.error) {
              successCount++;
              replacedCount++;
              lastResult = data;
            } else {
              failCount++;
            }
          } else {
            skippedCount++;
          }
          continue;
        }

        if (data.error) {
          failCount++;
        } else {
          successCount++;
          lastResult = data;
        }
      } catch (err) {
        failCount++;
      }
    }

    setMeasurementResult(lastResult);
    const messages = [];
    if (failCount > 0) messages.push(`${failCount} failed`);
    if (skippedCount > 0) messages.push(`${skippedCount} skipped (duplicate, kept existing)`);
    if (replacedCount > 0) messages.push(`${replacedCount} replaced existing reading`);
    if (messages.length > 0) {
      setMeasurementError(`${successCount} uploaded successfully. ${messages.join(', ')}.`);
    }
    setMeasurementFiles([]);
    setMeasuredAt(nowForInput());
    fetchMeasurementHistory();
    setMeasurementLoading(false);
  }

  async function handleDeleteActivity(id: string) {
    const confirmed = window.confirm('Delete this activity?');
    if (!confirmed) return;
    await fetch('/api/delete-activity', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchTodayActivities();
    fetchRecentActivities();
  }

  function startEditActivity(activity: any) {
    setEditingActivityId(activity.id);
    const dt = new Date(activity.happened_at);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setActivityEditForm({
      activity_type: activity.activity_type || '',
      duration_min: String(activity.duration_min ?? ''),
      kcal_burned: String(activity.kcal_burned ?? ''),
      happened_at: dt.toISOString().slice(0, 16),
    });
  }

  async function saveActivityEdit(id: string) {
    await fetch('/api/edit-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        activity_type: activityEditForm.activity_type,
        duration_min: Number(activityEditForm.duration_min),
        kcal_burned: Number(activityEditForm.kcal_burned),
        happened_at: new Date(activityEditForm.happened_at).toISOString(),
      }),
    });
    setEditingActivityId(null);
    fetchTodayActivities();
    fetchRecentActivities();
  }

  async function handleActivitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setActivityLoading(true);
    setActivityError('');
    setActivityResult(null);

    const images = [];
    for (const file of activityImages) {
      const imageBase64 = await fileToBase64(file);
      images.push({ imageBase64, mediaType: file.type });
    }

    try {
      const res = await fetch('/api/parse-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityText,
          happenedAt: new Date(activityAt).toISOString(),
          images,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setActivityError(data.error);
      } else {
        setActivityResult(data.entries);
        setActivityText('');
        setActivityImages([]);
        setActivityAt(nowForInput());
        fetchTodayActivities();
        fetchRecentActivities();
      }
    } catch (err) {
      setActivityError('Something went wrong logging the activity.');
    }
    setActivityLoading(false);
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatInput('');
    setChatLoading(true);

    const newMessages = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);

    try {
      const conversationHistory = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ask-unflump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });
      const data = await res.json();
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply }]);

      if (data.savedContext && !data.savedContext.autoSaved) {
        setPendingConfirm(data.savedContext);
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Try again?' }]);
    }
    setChatLoading(false);
  }

  async function confirmSaveContext(save: boolean) {
    if (save && pendingConfirm) {
      await supabase.from('user_context').insert({
        category: pendingConfirm.category,
        content: pendingConfirm.content,
      });
    }
    setPendingConfirm(null);
  }

  const hasHistory = measurementHistory.length >= 2;
  const windowSize = Math.min(3, Math.floor(measurementHistory.length / 2) || 1);

  const recentWindow = hasHistory ? measurementHistory.slice(0, windowSize) : [];
  const earliestWindow = hasHistory ? measurementHistory.slice(-windowSize) : [];

  let weekWindow: any[] = [];
  if (hasHistory) {
    const latestDate = new Date(measurementHistory[0].measured_at);
    const sevenDaysAgo = new Date(latestDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const oldEnough = measurementHistory.filter((m) => new Date(m.measured_at) <= sevenDaysAgo);
    weekWindow = oldEnough.slice(0, windowSize);
  }

  const latestDateLabel = hasHistory ? fmtDate(measurementHistory[0].measured_at) : '';
  const earliestDateLabel = hasHistory ? fmtDate(measurementHistory[measurementHistory.length - 1].measured_at) : '';
  const weekDateLabel = weekWindow.length > 0 ? fmtDate(weekWindow[0].measured_at) : '';

  const todayActivityKcal = todayActivities.reduce((sum, a) => sum + (a.kcal_burned || 0), 0);
  const proteinTarget = measurementHistory.length > 0 && measurementHistory[0].muscle_kg
    ? Math.round(measurementHistory[0].muscle_kg * 2.2)
    : null;

  return (
    <main style={{ padding: '2rem', maxWidth: '500px' }}>
      <h1>Unflump</h1>
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f0f0' }}>
         <strong>Today so far:</strong> {todayTotals.kcal} kcal | {todayTotals.protein_g}g
        {proteinTarget !== null ? ` / ${proteinTarget}g` : ''} protein
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={foodText}
          onChange={(e) => setFoodText(e.target.value)}
          placeholder="What did you eat? (optional if uploading a photo)"
          rows={3}
          style={{ width: '100%', padding: '0.5rem' }}
        />
        <div style={{ marginTop: '0.5rem' }}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFoodImages(e.target.files ? Array.from(e.target.files) : [])}
          />
          {foodImages.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: '#666' }}>{foodImages.length} photo(s) selected</p>
          )}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ marginRight: '0.5rem' }}>When:</label>
          <input
            type="datetime-local"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? 'Logging...' : 'Log it'}
        </button>
      </form>
      {result && (
        <div style={{ marginTop: '1rem' }}>
          <p>{result.kcal} kcal | {result.protein_g}g protein | {result.carbs_g}g carbs | {result.fat_g}g fat</p>
        </div>
      )}
      <div style={{ marginTop: '2rem' }}>
        <h3>Today's entries</h3>
        {todayEntries.length === 0 && <p>Nothing logged yet today.</p>}
        {todayEntries.map((entry) => (
          <div key={entry.id} style={{ borderBottom: '1px solid #ddd', padding: '0.5rem 0' }}>
            {editingId === entry.id ? (
              <div>
                <div>
                  <strong>{entry.meal_label}</strong> — {entry.raw_text}
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>kcal</label>
                    <input type="number" value={editForm.kcal} onChange={(e) => setEditForm({ ...editForm, kcal: e.target.value })} style={{ width: '70px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>protein (g)</label>
                    <input type="number" value={editForm.protein_g} onChange={(e) => setEditForm({ ...editForm, protein_g: e.target.value })} style={{ width: '70px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>carbs (g)</label>
                    <input type="number" value={editForm.carbs_g} onChange={(e) => setEditForm({ ...editForm, carbs_g: e.target.value })} style={{ width: '70px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>fat (g)</label>
                    <input type="number" value={editForm.fat_g} onChange={(e) => setEditForm({ ...editForm, fat_g: e.target.value })} style={{ width: '70px' }} />
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <input type="datetime-local" value={editForm.happened_at} onChange={(e) => setEditForm({ ...editForm, happened_at: e.target.value })} />
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => saveEdit(entry.id)}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <strong>{entry.meal_label}</strong> — {entry.raw_text}
                {entry.confidence === 'uncertain' && (
                  <span style={{ color: '#c0392b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>⚠ check this</span>
                )}
                <br />
                {new Date(entry.happened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {entry.kcal} kcal | {entry.protein_g}g protein | {entry.carbs_g}g carbs | {entry.fat_g}g fat
                <button onClick={() => startEdit(entry)} style={{ marginLeft: '1rem' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(entry.id)} style={{ marginLeft: '0.5rem' }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem', borderTop: '2px solid #ccc', paddingTop: '1.5rem' }}>
        <h3>Body measurement upload</h3>
        <form onSubmit={handleMeasurementSubmit}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setMeasurementFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {measurementFiles.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: '#666' }}>{measurementFiles.length} file(s) selected</p>
          )}
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ marginRight: '0.5rem' }}>When taken:</label>
            <input
              type="datetime-local"
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
            />
          </div>
          <button type="submit" disabled={measurementLoading || measurementFiles.length === 0} style={{ marginTop: '0.5rem' }}>
            {measurementLoading ? `Reading ${measurementFiles.length} file(s)...` : 'Upload readings'}
          </button>
        </form>
        {measurementError && (
          <p style={{ color: 'red', marginTop: '1rem' }}>{measurementError}</p>
        )}
        {measurementResult && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0' }}>
            <p>Weight: {measurementResult.weight_kg ?? '—'} kg</p>
            <p>Body fat: {measurementResult.body_fat_pct ?? '—'}%</p>
            <p>Muscle: {measurementResult.muscle_kg ?? '—'} kg</p>
            <p>Bone mass: {measurementResult.bone_mass_kg ?? '—'} kg</p>
            <p>Water: {measurementResult.water_pct ?? '—'}%</p>
            <p>Visceral fat: {measurementResult.visceral_fat ?? '—'}</p>
            <p>BMR: {measurementResult.bmr ?? '—'}</p>
            <p>Source: {measurementResult.source_app ?? '—'}</p>
          </div>
        )}

        {weekWindow.length > 0 && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#eaf1fb' }}>
            <strong>This week</strong>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              {weekDateLabel} → {latestDateLabel} (averaged over {windowSize} reading{windowSize > 1 ? 's' : ''} each end)
            </div>
            <p style={{ marginTop: '0.5rem' }}>
              Weight: {fmtDelta(
                average(recentWindow, 'weight_kg') !== null && average(weekWindow, 'weight_kg') !== null
                  ? Math.round((average(recentWindow, 'weight_kg')! - average(weekWindow, 'weight_kg')!) * 100) / 100
                  : null,
                'kg'
              )}
            </p>
            <p>
              Body fat: {fmtDelta(
                average(recentWindow, 'body_fat_pct') !== null && average(weekWindow, 'body_fat_pct') !== null
                  ? Math.round((average(recentWindow, 'body_fat_pct')! - average(weekWindow, 'body_fat_pct')!) * 100) / 100
                  : null,
                '%'
              )}
            </p>
            <p>
              Muscle: {fmtDelta(
                average(recentWindow, 'muscle_kg') !== null && average(weekWindow, 'muscle_kg') !== null
                  ? Math.round((average(recentWindow, 'muscle_kg')! - average(weekWindow, 'muscle_kg')!) * 100) / 100
                  : null,
                'kg'
              )}
            </p>
          </div>
        )}

        {hasHistory && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f4ea' }}>
            <strong>All-time progress</strong>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              {earliestDateLabel} → {latestDateLabel} (averaged over {windowSize} reading{windowSize > 1 ? 's' : ''} each end)
            </div>
            <p style={{ marginTop: '0.5rem' }}>
              Weight: {fmtDelta(
                average(recentWindow, 'weight_kg') !== null && average(earliestWindow, 'weight_kg') !== null
                  ? Math.round((average(recentWindow, 'weight_kg')! - average(earliestWindow, 'weight_kg')!) * 100) / 100
                  : null,
                'kg'
              )}
            </p>
            <p>
              Body fat: {fmtDelta(
                average(recentWindow, 'body_fat_pct') !== null && average(earliestWindow, 'body_fat_pct') !== null
                  ? Math.round((average(recentWindow, 'body_fat_pct')! - average(earliestWindow, 'body_fat_pct')!) * 100) / 100
                  : null,
                '%'
              )}
            </p>
            <p>
              Muscle: {fmtDelta(
                average(recentWindow, 'muscle_kg') !== null && average(earliestWindow, 'muscle_kg') !== null
                  ? Math.round((average(recentWindow, 'muscle_kg')! - average(earliestWindow, 'muscle_kg')!) * 100) / 100
                  : null,
                'kg'
              )}
            </p>
          </div>
        )}

    <h3 style={{ marginTop: '2rem' }}>Running progress</h3>
        {measurementHistory.length === 0 && <p>No readings logged yet.</p>}
        {measurementHistory.map((m) => (
          <div key={m.id} style={{ borderBottom: '1px solid #ddd', padding: '0.5rem 0' }}>
            <strong>{fmtDate(m.measured_at)}</strong>
            {' — '}
            {m.weight_kg !== null ? `${m.weight_kg} kg` : ''}
            {m.body_fat_pct !== null ? ` | ${m.body_fat_pct}% BF` : ''}
            {m.muscle_kg !== null ? ` | ${m.muscle_kg}kg muscle` : ''}
          </div>
        ))}

<h3 style={{ marginTop: '2rem' }}>Basal metabolism & muscle trend</h3>
        <p style={{ fontSize: '0.85rem', color: '#666' }}>Your engine getting bigger — BMR and muscle mass tend to rise together over time.</p>

        <button onClick={() => {
          const newValue = !bmrExplainerOpen;
          setBmrExplainerOpen(newValue);
          localStorage.setItem('bmrExplainerOpen', String(newValue));
        }} style={{ marginBottom: '0.5rem' }}>
          {bmrExplainerOpen ? 'Hide explanation' : 'What do BMR and TDEE mean?'}
        </button>

        {bmrExplainerOpen && (
          <div style={{ padding: '1rem', background: '#f7f7f7', marginBottom: '1rem' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>What's basal metabolic rate (BMR)?</p>
            <p style={{ marginTop: 0 }}>What your body burns just staying alive at complete rest — breathing, heartbeat, organ function, cell repair. The energy cost of simply existing, before you've moved a muscle.</p>

            <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>What's total daily energy expenditure (TDEE)?</p>
            <p style={{ marginTop: 0 }}>Your basal metabolic rate (BMR) plus everything else — walking, training, digesting food, even fidgeting. Total daily energy expenditure (TDEE) is always higher than basal metabolic rate (BMR); it's basal metabolic rate (BMR) with your whole day layered on top.</p>

            <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Does building muscle raise your basal metabolic rate (BMR)?</p>
            <p style={{ marginTop: 0, marginBottom: 0 }}>Yes — but modestly. Research puts it at roughly 10-13 kcal a day for every kilogram of muscle gained. Gaining 2kg of muscle (a solid few months of real training) raises basal metabolic rate (BMR) by around 20-26 kcal a day. The bigger effects of building muscle show up elsewhere: mobility and independence as you get older, lower risk of chronic illness, better hormonal regulation, more energy for the things you actually want to do, and simply feeling good in your body.</p>
          </div>
        )}

        {measurementHistory.filter((m) => m.bmr !== null).length === 0 && <p>No BMR readings logged yet.</p>}
        {measurementHistory.filter((m) => m.bmr !== null).map((m) => (
          <div key={m.id} style={{ borderBottom: '1px solid #ddd', padding: '0.5rem 0' }}>
            <strong>{fmtDate(m.measured_at)}</strong>
            {' — '}
            BMR: {m.bmr} kcal
            {m.muscle_kg !== null ? ` | Muscle: ${m.muscle_kg}kg` : ''}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem', borderTop: '2px solid #ccc', paddingTop: '1.5rem' }}>
        <h3>Activity logging</h3>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f0f0' }}>
          <strong>Today's activity burn:</strong> {todayActivityKcal} kcal
        </div>
        <form onSubmit={handleActivitySubmit}>
          <textarea
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            placeholder="Describe an activity (e.g. '1.5hrs ballet, intermediate' or 'yesterday I did 4 pullups') or upload a Samsung Health screenshot"
            rows={2}
            style={{ width: '100%', padding: '0.5rem' }}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setActivityImages(e.target.files ? Array.from(e.target.files) : [])}
            />
            {activityImages.length > 0 && (
              <p style={{ fontSize: '0.85rem', color: '#666' }}>{activityImages.length} photo(s) selected</p>
            )}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ marginRight: '0.5rem' }}>When:</label>
            <input
              type="datetime-local"
              value={activityAt}
              onChange={(e) => setActivityAt(e.target.value)}
            />
          </div>
          <button type="submit" disabled={activityLoading} style={{ marginTop: '0.5rem' }}>
            {activityLoading ? 'Logging...' : 'Log activity'}
          </button>
        </form>
        {activityError && (
          <p style={{ color: 'red', marginTop: '1rem' }}>{activityError}</p>
        )}
        {activityResult && activityResult.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0' }}>
            <strong>{activityResult.length > 1 ? `${activityResult.length} activities logged:` : 'Logged:'}</strong>
            {activityResult.map((a: any) => (
              <div key={a.id} style={{ marginTop: '0.5rem' }}>
                <p>{a.activity_type} — {a.duration_min} min — {a.kcal_burned} kcal</p>
                {a.notes && <p style={{ fontSize: '0.85rem', color: '#666' }}>{a.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: '2rem' }}>Today's activities</h3>
        {todayActivities.length === 0 && <p>Nothing logged yet today.</p>}
        {todayActivities.map((a) => (
          <div key={a.id} style={{ borderBottom: '1px solid #ddd', padding: '0.5rem 0' }}>
            {editingActivityId === a.id ? (
              <div>
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>activity</label>
                  <input type="text" value={activityEditForm.activity_type} onChange={(e) => setActivityEditForm({ ...activityEditForm, activity_type: e.target.value })} style={{ width: '150px' }} />
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>duration (min)</label>
                    <input type="number" value={activityEditForm.duration_min} onChange={(e) => setActivityEditForm({ ...activityEditForm, duration_min: e.target.value })} style={{ width: '70px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>kcal</label>
                    <input type="number" value={activityEditForm.kcal_burned} onChange={(e) => setActivityEditForm({ ...activityEditForm, kcal_burned: e.target.value })} style={{ width: '70px' }} />
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <input type="datetime-local" value={activityEditForm.happened_at} onChange={(e) => setActivityEditForm({ ...activityEditForm, happened_at: e.target.value })} />
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => saveActivityEdit(a.id)}>Save</button>
                  <button onClick={() => setEditingActivityId(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <strong>{a.activity_type}</strong> — {a.duration_min} min — {a.kcal_burned} kcal
                <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: '0.5rem' }}>({a.source})</span>
                {a.notes && <div style={{ fontSize: '0.85rem', color: '#666' }}>{a.notes}</div>}
                <button onClick={() => startEditActivity(a)} style={{ marginLeft: '0', marginTop: '0.25rem' }}>
                  Edit
                </button>
                <button onClick={() => handleDeleteActivity(a.id)} style={{ marginLeft: '0.5rem' }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        <h3 style={{ marginTop: '2rem' }}>Recent activities (last 7 days)</h3>
        {recentActivities.length === 0 && <p>No activities logged in the last 7 days.</p>}
        {recentActivities.map((a) => (
          <div key={a.id} style={{ borderBottom: '1px solid #ddd', padding: '0.5rem 0' }}>
            <strong>{fmtDate(a.happened_at)}</strong> — {a.activity_type} — {a.duration_min} min — {a.kcal_burned} kcal
            <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: '0.5rem' }}>({a.source})</span>
            {a.notes && <div style={{ fontSize: '0.85rem', color: '#666' }}>{a.notes}</div>}
            <button onClick={() => handleDeleteActivity(a.id)} style={{ marginLeft: '0.5rem' }}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem', borderTop: '2px solid #ccc', paddingTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>U</div>
          <strong>Unflump</strong>
        </div>

        <div style={{ minHeight: '150px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', padding: '0.75rem', marginBottom: '0.5rem' }}>
          {chatMessages.length === 0 && <p style={{ color: '#999' }}>Say hi, ask a question, or just tell me what's going on.</p>}
          {chatMessages.map((m, i) => (
            <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left', marginBottom: '0.5rem' }}>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 0.75rem',
                borderRadius: '12px',
                background: m.role === 'user' ? '#dcf0ff' : '#f0f0f0',
                maxWidth: '80%',
                textAlign: 'left',
              }}>
                {m.content}
              </span>
            </div>
          ))}
          {chatLoading && <p style={{ color: '#999' }}>Unflump is typing...</p>}
        </div>

        {pendingConfirm && (
          <div style={{ padding: '0.75rem', background: '#fff8e1', marginBottom: '0.5rem' }}>
            <p style={{ margin: 0 }}>Want me to remember this about you going forward? <em>({pendingConfirm.category}: {pendingConfirm.content})</em></p>
            <button onClick={() => confirmSaveContext(true)} style={{ marginTop: '0.5rem' }}>Yes, remember this</button>
            <button onClick={() => confirmSaveContext(false)} style={{ marginTop: '0.5rem', marginLeft: '0.5rem' }}>No</button>
          </div>
        )}

        <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="submit" disabled={chatLoading}>Send</button>
        </form>
      </div>
    </main>
  );
}