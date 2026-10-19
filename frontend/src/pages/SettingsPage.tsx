import { useEffect, useState } from "react";
import { updateSession } from "../api/sessions";
import AlertFlash from "../components/common/AlertFlash";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Icon from "../components/common/Icon";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useInstall } from "../hooks/useInstall";
import { speechSupported } from "../hooks/useSpeechRecognition";
import { useSessionStore } from "../stores/sessionStore";
import { detectPlatform } from "../utils/calendar";
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
            {saved ? (
              <span className="inline-flex items-center gap-1">
                저장했어요 <Icon name="check" className="h-4 w-4" />
              </span>
            ) : (
              "저장"
            )}
          </Button>
          <Button variant="outline" onClick={() => setTestAlert(`내 차례예요! (${form.waitNumber || "37"}번)`)}>
            알림 시험
          </Button>
        </div>
      </Card>

      <InstallCard />

      <Card className="space-y-2 text-sm">
        <p className="font-semibold">이 기기에서 쓸 수 있는 기능</p>
        <Support ok={speechSupported} label="실시간 자막" fallback="미지원: 녹음 후 서버 인식 사용" />
        <Support ok={canSpeak} label="다시 읽어주기" />
        <Support ok={"share" in navigator} label="공유하기" fallback="미지원: 복사로 대신" />
      </Card>

      {testAlert && <AlertFlash message={testAlert} onClose={() => setTestAlert(null)} />}
    </div>
  );
}

function Support({ ok, label, fallback }: { ok: boolean; label: string; fallback?: string }) {
  return (
    <p className="flex items-center gap-2">
      <Icon name={ok ? "checkCircle" : "alertCircle"} className={`h-5 w-5 ${ok ? "text-brand-600" : "text-amber-500"}`} />
      {label}
      {!ok && fallback && <span className="text-slate-400">({fallback})</span>}
    </p>
  );
}

/** 앱으로 설치하기 (PWA): 안드로이드는 버튼, 아이폰은 방법 안내, 이미 설치됐으면 표시만 */
function InstallCard() {
  const { canInstall, installed, install } = useInstall();
  const platform = detectPlatform();

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-semibold">앱으로 설치하기</p>
        <p className="text-sm text-slate-500">홈 화면에 추가하면 주소창 없이 앱처럼 바로 열 수 있어요.</p>
      </div>
      {installed ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-600">
          <Icon name="checkCircle" className="h-5 w-5" />
          앱으로 실행 중이에요
        </p>
      ) : canInstall ? (
        <Button className="w-full" onClick={install}>
          홈 화면에 추가
        </Button>
      ) : platform === "ios" ? (
        <ol className="space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-1.5">
            1. Safari 아래쪽의 공유 버튼
            <Icon name="iosShare" className="h-4 w-4 text-brand-600" />을 눌러요
          </li>
          <li>2. 목록에서 <b>홈 화면에 추가</b>를 눌러요</li>
          <li>3. 오른쪽 위 <b>추가</b>를 누르면 끝!</li>
        </ol>
      ) : (
        <p className="text-sm text-slate-600">
          브라우저 메뉴(오른쪽 위 점 세 개)에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요.
        </p>
      )}
    </Card>
  );
}
