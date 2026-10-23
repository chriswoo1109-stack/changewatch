import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { wakeServer } from "./api/client";
import BottomNav from "./components/common/BottomNav";
import ServerWaitBanner from "./components/common/ServerWaitBanner";
import HomePage from "./pages/HomePage";
import RecordingPage from "./pages/RecordingPage";
import ResultPage from "./pages/ResultPage";
import SessionPage from "./pages/SessionPage";
import ConfirmPage from "./pages/ConfirmPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import ShowPage from "./pages/ShowPage";

export default function App() {
  // 앱을 열자마자 잠든 서버를 미리 깨워 둡니다 (Render 무료 서버)
  useEffect(() => {
    wakeServer();
  }, []);

  // 녹음 화면은 듣기에만 집중하는 전체 화면: 하단 탭을 숨겨 화면 아래 색이 끊기지 않게 하고,
  // 듣는 중에 탭을 잘못 눌러 듣기가 멈추는 것도 막습니다. (나가기는 화면의 × 버튼)
  const fullScreen = useLocation().pathname === "/record";

  return (
    // 휴대폰 화면 폭으로 고정해 앱처럼 보이게 합니다.
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 shadow-sm">
      <main className={`flex-1 overflow-y-auto ${fullScreen ? "" : "pb-20"}`}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/record" element={<RecordingPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/show" element={<ShowPage />} />
          {/* 없는 주소는 홈으로 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ServerWaitBanner />
      {!fullScreen && <BottomNav />}
    </div>
  );
}
