import { Navigate, Route, Routes } from "react-router-dom";
import BottomNav from "./components/common/BottomNav";
import HomePage from "./pages/HomePage";
import RecordingPage from "./pages/RecordingPage";
import ResultPage from "./pages/ResultPage";
import SessionPage from "./pages/SessionPage";
import ConfirmPage from "./pages/ConfirmPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import ShowPage from "./pages/ShowPage";

export default function App() {
  return (
    // 휴대폰 화면 폭으로 고정해 앱처럼 보이게 합니다.
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 shadow-sm">
      <main className="flex-1 overflow-y-auto pb-20">
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
      <BottomNav />
    </div>
  );
}
