import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { LobbyView } from '../components/LobbyView';
import { GameView } from '../components/GameView';
import { ResultView } from '../components/ResultView';

export default function RoomPage() {
  const { code } = useParams();
  const { session, me } = useSession();

  useEffect(() => {
    if (!code || session) return;
    fetch(`/api/sessions/${code}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => {});
  }, [code, session]);

  if (!session || !me) return <div className="room">방 정보 로딩 중…</div>;

  switch (session.status) {
    case 'PREPARING': return <LobbyView snap={session} me={me} />;
    case 'PLAYING':   return <GameView  snap={session} me={me} />;
    // 4A가 CREDENTIAL_INPUT/QUEUED/RUNNING/COMPLETED/FAILED case 추가 예정 (별도 PR)
    default:          return <ResultView snap={session} me={me} />;
  }
}
