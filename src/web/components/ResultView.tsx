import { StatusBadge } from './StatusBadge';
import { CredentialForm } from './CredentialForm';
import type { RoomStatePayload } from '../../shared/protocol';

type Snap = RoomStatePayload;

export function ResultView({ snap, me }: { snap: Snap; me: string }) {
  const loser = snap.players.find(p => p.id === snap.loserId);
  const iAmLoser = me === snap.loserId;

  return (
    <section className="result">
      <header>
        <h1>🎲 패자 발표 <StatusBadge status={snap.status} /></h1>
        <div style={{ fontSize: 48, textAlign: 'center', margin: 40 }}>
          💀 <strong>{loser?.name ?? '???'}</strong>
        </div>
        {snap.results && (
          <ul>
            {snap.results.map(r => {
              const p = snap.players.find(pp => pp.id === r.playerId);
              return <li key={r.playerId}>{p?.name}: {r.value}</li>;
            })}
          </ul>
        )}
      </header>

      {snap.status === 'FINISHED' && iAmLoser && (
        <CredentialForm sessionId={snap.sessionId} loserId={snap.loserId!} />
      )}
      {snap.status === 'FINISHED' && !iAmLoser && (
        <p>패자가 자격증명을 입력할 때까지 잠시 기다려주세요…</p>
      )}

      {/* 4A가 CREDENTIAL_INPUT/QUEUED/RUNNING/COMPLETED/FAILED 케이스 추가 예정 */}
    </section>
  );
}
