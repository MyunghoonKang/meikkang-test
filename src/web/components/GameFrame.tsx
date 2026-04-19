import { useRef, useEffect } from 'react';
import { useGameFrame } from '../hooks/useGameFrame';
import type { Player } from '../../shared/protocol';

interface Props {
  gameUrl: string;
  playerId: string;
  players: Player[];
  sessionId: string;
  seed: string;
  onSubmit: (value: number) => void;
  showOutcome?: { loserId: string; results: { playerId: string; value: number }[] } | null;
}

export function GameFrame({ gameUrl, playerId, players, sessionId, seed, onSubmit, showOutcome }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { send } = useGameFrame(ref, (msg) => {
    if (msg.type === 'ready') send({ type: 'start' });
    if (msg.type === 'submit') onSubmit(msg.value);
  });

  useEffect(() => {
    const iframeEl = ref.current;
    if (!iframeEl) return;
    const onLoad = () => {
      send({ type: 'init', playerId, players, sessionId, seed });
    };
    iframeEl.addEventListener('load', onLoad);
    return () => iframeEl.removeEventListener('load', onLoad);
  }, [playerId, players, sessionId, seed, send]);

  useEffect(() => {
    if (showOutcome) send({ type: 'outcome', ...showOutcome });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOutcome]);

  return (
    <iframe
      ref={ref}
      src={gameUrl}
      sandbox="allow-scripts"
      width="100%"
      height="520"
      style={{ border: '1px solid #30363d', borderRadius: 8 }}
    />
  );
}
