import type { Player } from '../../shared/protocol';

export function PlayerList({ players, hostId }: { players: Player[]; hostId: string }) {
  return (
    <div className="player-list">
      {players.map(p => (
        <div key={p.id} className="player-chip">{p.name}{p.id === hostId && ' 👑'}</div>
      ))}
    </div>
  );
}
