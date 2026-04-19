import { useState } from 'react';

export function CredentialForm({ sessionId, loserId }: { sessionId: string; loserId: string }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const saveRes = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loserId, loginId, password }),
      });
      if (!saveRes.ok) throw new Error(await saveRes.text());

      const enqueue = await fetch(`/api/sessions/${sessionId}/submissions`, { method: 'POST' });
      if (!enqueue.ok) throw new Error(await enqueue.text());
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="credential-form">
      <h2>ERP 자격증명 입력 (패자)</h2>
      <p>회사코드 <code>meissa</code> 는 자동 입력됩니다. ID/PW만 주세요.</p>
      <label>ID<input value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="off" required /></label>
      <label>PW<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? '저장 중…' : '저장하고 상신 예약'}</button>
    </form>
  );
}
