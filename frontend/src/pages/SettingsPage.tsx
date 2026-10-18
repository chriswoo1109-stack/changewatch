import { useEffect, useState } from "react";
import { updateSession } from "../api/sessions";
import AlertFlash from "../components/common/AlertFlash";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { speechSupported } from "../hooks/useSpeechRecognition";
import { useSessionStore } from "../stores/sessionStore";
import { canSpeak } from "../utils/speak";

// 시안 13번(설정): 내 번호·이름 (서버 세션의 my_number·my_name)
export default function SettingsPage() {
  const { sessionId, myKeywords, setMyKeywords } = useSessionStore();
  const { session } = useCurrentSession();
  const [form, setForm] = useState(myKeywords);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testAlert, setTestAlert] = useState<string | null>(null);

  // 진행 중인 방문이 있으면 서버에 저장된 값을 보여줍니다.
  useEffect(() => {
    if (session) setForm({ waitNumber: session.my_number ?? "", name: session.my_name ?? "" });
  }, [session]);

  const save = async () => {
    const next = { waitNumber: form.waitNumber.trim(), name: form.name.trim() };
    setSaveError(null);
    try {
      // 빈 문자열은 서버에서 "지우기"로 처리됩니다.
      if (sessionId) await updateSession(sessionId, { my_number: next.waitNumber, my_name: next.name });
      setMyKeywords(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    }
  };

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">설정</h1>

      <Card className="space-y-3">
        <div>
          <p className="font-semibold">내 차례 알림</p>
          <p className="text-sm text-slate-500">
            안내에서 내 대기번호나 이름이 불리면 화면을 깜빡이고 소리로 알려드려요.
            {sessionId ? " 지금 방문에 바로 적용돼요." : " 다음에 시작하는 방문부터 적용돼요."}
          </p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-500">대기번호</span>
          <input
            className="mt-1 w-full rounded-lg border p-3"
            inputMode="numeric"
            value={form.waitNumber}
            onChange={(e) => setForm({ ...form, waitNumber: e.target.value })}
            placeholder="예: 37"
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
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save}>
            {saved ? "저장했어요 ✓" : "저장"}
          </Button>
          <Button variant="outline" onClick={() => setTestAlert(`내 차례예요! (${form.waitNumber || "37"}번)`)}>
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
