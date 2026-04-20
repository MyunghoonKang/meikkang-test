import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

export default function HomePage() {
  const { create, join } = useSession();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const doCreate = async () => {
    try { const s = await create(name); nav(`/room/${s.roomCode}`); }
    catch (e: unknown) { setErr((e as Error).message); }
  };
  const doJoin = async () => {
    try { const s = await join(code.toUpperCase(), name); nav(`/room/${s.roomCode}`); }
    catch (e: unknown) { setErr((e as Error).message); }
  };

  return (
    <div className="home">
      <h1>Meal Proposal Game</h1>
      <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} />
      <section>
        <h2>방 만들기</h2>
        <button disabled={!name} onClick={doCreate}>방 만들기</button>
      </section>
      <section>
        <h2>방 참여</h2>
        <input placeholder="룸 코드 (4자리)" maxLength={4} value={code}
               onChange={e => setCode(e.target.value.toUpperCase())} />
        <button disabled={!name || code.length !== 4} onClick={doJoin}>참여</button>
      </section>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
