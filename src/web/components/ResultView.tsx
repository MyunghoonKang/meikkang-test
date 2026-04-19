import type { RoomStatePayload } from '../../shared/protocol';
import { StatusBadge } from './StatusBadge';
import { InlineSpinner } from './InlineSpinner';
import { CredentialForm } from './CredentialForm';

interface Props {
  state: RoomStatePayload;
  myPlayerId: string;
}

export function ResultView({ state, myPlayerId }: Props) {
  const isLoser = state.loserId === myPlayerId;

  // FINISHED stage — show result + CTA for loser
  if (state.status === 'FINISHED') {
    return (
      <div className="result-view">
        <StatusBadge status={state.status} />
        <h2>게임 종료</h2>
        {state.results && (
          <ul className="result-list">
            {state.results.map(r => (
              <li key={r.playerId}>
                {state.players.find(p => p.id === r.playerId)?.name ?? r.playerId}: {r.value}점
                {r.playerId === state.loserId ? ' 👎 (패자)' : ''}
              </li>
            ))}
          </ul>
        )}
        {isLoser && (
          <div className="credential-section">
            <p>패자로 선정되었습니다. ERP에 법인카드 지출결의서를 상신해야 합니다.</p>
            <button
              className="btn btn-primary"
              onClick={async () => {
                await fetch(`/api/sessions/${state.sessionId}/credential-input`, { method: 'POST' });
              }}
            >
              ERP 자격증명 입력하기
            </button>
          </div>
        )}
        {!isLoser && state.loserId && (
          <p>패자({state.players.find(p => p.id === state.loserId)?.name})가 자격증명을 입력하는 중입니다.</p>
        )}
      </div>
    );
  }

  // CREDENTIAL_INPUT stage
  if (state.status === 'CREDENTIAL_INPUT') {
    return (
      <div className="result-view">
        <StatusBadge status={state.status} />
        {isLoser ? (
          <CredentialForm sessionId={state.sessionId} loserId={state.loserId!} />
        ) : (
          <p>패자가 ERP 자격증명을 입력하는 중입니다. 잠시 기다려 주세요.</p>
        )}
      </div>
    );
  }

  // QUEUED stage
  if (state.status === 'QUEUED') {
    const scheduledDate = state.scheduledAt
      ? new Date(state.scheduledAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      : '예정';
    return (
      <div className="result-view">
        <StatusBadge status={state.status} />
        <h2>상신 대기</h2>
        <p>다음 영업일 09:00 KST에 자동 상신됩니다.</p>
        <p>예약 시각: {scheduledDate}</p>
      </div>
    );
  }

  // RUNNING stage
  if (state.status === 'RUNNING') {
    return (
      <div className="result-view">
        <StatusBadge status={state.status} />
        <h2>ERP 자동화 진행 중</h2>
        <InlineSpinner step={state.workerStep} />
      </div>
    );
  }

  // COMPLETED stage
  if (state.status === 'COMPLETED') {
    return (
      <div className="result-view result-view--success">
        <StatusBadge status={state.status} />
        <h2>🎉 상신 성공!</h2>
        {state.erpRefNo && <p>ERP 참조번호: <code>{state.erpRefNo}</code></p>}
      </div>
    );
  }

  // FAILED stage
  if (state.status === 'FAILED') {
    return (
      <div className="result-view result-view--error">
        <StatusBadge status={state.status} />
        <h2>상신 실패</h2>
        {state.errorLog && <pre className="error-log">{state.errorLog}</pre>}
        <p>관리자에게 문의하거나 수동으로 처리해 주세요.</p>
      </div>
    );
  }

  // ABORTED
  return (
    <div className="result-view">
      <StatusBadge status="ABORTED" />
      <h2>중단됨</h2>
    </div>
  );
}
