'use client';

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export default function Home() {
  const [foodText, setFoodText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, protein_g: 0 });

  async function fetchTodayTotals() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('food_logs')
      .select('kcal, protein_g')
      .gte('happened_at', startOfDay.toISOString());

    if (data) {
      const totals = data.reduce(
        (acc, row) => ({
          kcal: acc.kcal + (row.kcal || 0),
          protein_g: acc.protein_g + (row.protein_g || 0),
        }),
        { kcal: 0, protein_g: 0 }
      );
      setTodayTotals(totals);
    }
  }

  useEffect(() => {
    fetchTodayTotals();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/parse-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodText }),
    });
    const data = await res.json();
    setResult(data);
    setFoodText('');
    setLoading(false);
    fetchTodayTotals();
  }

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
          placeholder="What did you eat?"
          rows={3}
          style={{ width: '100%', padding: '0.5rem' }}
        />
        <button type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? 'Logging...' : 'Log it'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <p>{result.kcal} kcal | {result.protein_g}g protein | {result.carbs_g}g carbs | {result.fat_g}g fat</p>
        </div>
      )}
    </main>
  );
}