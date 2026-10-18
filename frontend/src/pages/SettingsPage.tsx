import { useState } from "react";
import AlertFlash from "../components/common/AlertFlash";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import { speechSupported } from "../hooks/useSpeechRecognition";
import { useSessionStore } from "../stores/sessionStore";
import { canSpeak } from "../utils/speak";

// 시안 13번(설정): 내 정보 키워드
export default function SettingsPage() {
  const { myKeywords, setMyKeywords } = useSessionStore();
  const [form, setForm] = useState(myKeywords);
  const [saved, setSaved] = useState(false);
  const [testAlert, setTestAlert] = useState<string | null>(null);

  const save = () => {
    setMyKeywords({ waitNumber: form.waitNumber.trim(), name: form.name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">설정</h1>

      <Card className="space-y-3">
        <div>
          <p className="font-semibold">내 정보 키워드</p>
          <p className="text-sm text-slate-500">듣는 중에 내 대기번호나 이름이 나오면 화면을 깜빡여 알려드려요.</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-500">대기번호</span>
          <input
            className="mt-1 w-full rounded-lg border p-3"
            inputMode="numeric"
            value={form.waitNumber}
            onChange={(e) => setForm({ ...form, waitNumber: e.target.value })}
            placeholder="예: 15"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">이름</span>
          <input
            className="mt-1 w-full rounded-lg border p-3"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 김민준"
          />
        </label>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save}>
            {saved ? "저장했어요 ✓" : "저장"}
          </Button>
          <Button variant="outline" onClick={() => setTestAlert(`${form.name || "OOO"}님, ${form.waitNumber || "15"}번 호출이에요!`)}>
            알림 시험
          </Button>
        </div>
      </Card>

      <Card className="space-y-1 text-sm">
        <p className="font-semibold">이 기기에서 쓸 수 있는 기능</p>
        <p>{speechSupported ? "✅" : "⚠"} 실시간 자막 {speechSupported ? "" : "(미지원 → 녹음 후 서버 인식 사용)"}</p>
        <p>{canSpeak ? "✅" : "⚠"} 다시 읽어주기</p>
        <p>{"share" in navigator ? "✅" : "⚠"} 공유하기 {"share" in navigator ? "" : "(미지원 → 복사로 대신)"}</p>
      </Card>

      {testAlert && <AlertFlash message={testAlert} onClose={() => setTestAlert(null)} />}
    </div>
  );
}
