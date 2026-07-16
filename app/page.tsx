'use client';

import { useState } from 'react';

export default function Home() {
  const [foodText, setFoodText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '500px' }}>
      <h1>Unflump</h1>
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