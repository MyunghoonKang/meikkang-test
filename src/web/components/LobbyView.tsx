import { socket } from '../socket';
import { PlayerList } from './PlayerList';
import { GameSelector } from './GameSelector';
import type { RoomStatePayload } from '../../shared/protocol';

type Snap = RoomStatePayload;

export function LobbyView({ snap, me }: { snap: Snap; me: string }) {
  const isHost = snap.hostId === me;

  const selectGame = (id: string) => {
    socket.emit('game:select', { gameId: id }, (res: any) => res.error && alert(res.error));
  };
  const startGame = () => {
    socket.emit('game:start', {}, (res: any) => res.error && alert(res.error));
  };

  return (
    <section className="lobby">
      <h1>방 {snap.roomCode}</h1>
      <p>공유할 코드: <strong>{snap.roomCode}</strong></p>
      <button onClick={() => navigator.clipboard.writeText(snap.roomCode)}>룸 코드 복사</button>

      <h2>참가자 ({snap.players.length})</h2>
      <PlayerList players={snap.players} hostId={snap.hostId} />

      <h2>게임 선택</h2>
      <GameSelector selectedId={snap.selectedGameId} onSelect={selectGame} disabled={!isHost} />
      {isHost && (
        <button disabled={!snap.selectedGameId} onClick={startGame}>시작!</button>
      )}
      {!isHost && <p>호스트가 게임을 시작하기를 기다리는 중…</p>}
    </section>
  );
}
