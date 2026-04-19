import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import './styles.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* RoomPage가 RoomStatus에 따라 LobbyView / GameView / ResultView를 스왑 */}
      <Route path="/room/:code" element={<RoomPage />} />
    </Routes>
  );
}
