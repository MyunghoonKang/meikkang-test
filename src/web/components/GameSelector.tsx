import { useEffect, useState } from 'react';
import type { GameMeta } from '../../shared/protocol';

export function GameSelector({ selectedId, onSelect, disabled }: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [games, setGames] = useState<GameMeta[]>([]);
  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(setGames).catch(() => {});
  }, []);
  return (
    <select value={selectedId ?? ''} onChange={e => onSelect(e.target.value)} disabled={disabled}>
      <option value="" disabled>게임을 선택하세요</option>
      {games.map(g => (
        <option key={g.id} value={g.id}>{g.title} ({g.minPlayers}-{g.maxPlayers}명)</option>
      ))}
    </select>
  );
}
