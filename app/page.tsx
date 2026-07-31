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

  return (
    <main style={{ padding: '2rem', maxWidth: '500px' }}>
      <h1>Unflump</h1>
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f0f0' }}>
        <strong>Today so far:</strong> {todayTotals.kcal} kcal | {todayTotals.protein_g}g protein
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
      </div>
    </main>
  );
}