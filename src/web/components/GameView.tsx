import { useEffect, useState } from 'react';
import { socket } from '../socket';
import { GameFrame } from './GameFrame';
import type { GameMeta, RoomStatePayload } from '../../shared/protocol';

type Snap = RoomStatePayload;

export function GameView({ snap, me }: { snap: Snap; me: string }) {
  const [game, setGame] = useState<GameMeta | null>(null);
  const [seed, setSeed] = useState('');
  const [outcome, setOutcome] = useState<{ loserId: string; results: { playerId: string; value: number }[] } | null>(null);
  const [progress, setProgress] = useState<{ submittedCount: number; total: number } | null>(null);

  useEffect(() => {
    const onBegin = (p: { game: GameMeta; seed: string }) => {
      setGame(p.game);
      setSeed(p.seed);
    };
    const onOutcome = (o: { loserId: string; results: { playerId: string; value: number }[] }) => setOutcome(o);
    const onProgress = (p: { submittedCount: number; total: number }) => setProgress(p);
    socket.on('game:begin', onBegin);
    socket.on('game:outcome', onOutcome);
    socket.on('game:progress', onProgress);
    return () => {
      socket.off('game:begin', onBegin);
      socket.off('game:outcome', onOutcome);
      socket.off('game:progress', onProgress);
    };
  }, []);

  if (!game) return <div className="game">게임 로딩 중...</div>;

  const submit = (value: number) => {
    socket.emit('player:submit', { value }, (res: unknown) => {
      if (res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error) {
        alert((res as { error: string }).error);
      }
    });
  };

  return (
    <section className="game">
      <h1>{game.title}</h1>
      {progress && <p>제출 {progress.submittedCount}/{progress.total}</p>}
      <GameFrame
        gameUrl={`/games/${game.filename}`}
        playerId={me}
        players={snap.players}
        sessionId={snap.sessionId}
        seed={seed}
        onSubmit={submit}
        showOutcome={outcome}
      />
    </section>
  );
}
