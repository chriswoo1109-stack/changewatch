import { formatDuration } from "../../hooks/useListenGuard";
import Icon from "./Icon";

interface Props {
  seconds: number;
  stopped: boolean; // 돌아와 보니 듣기가 끊겨 있는지
  onResume: () => void;
  onDismiss: () => void;
}

/** 다른 앱에 다녀왔을 때: "듣기가 N분간 멈춰 있었어요" (CLAUDE.md 주의사항) */
export default function AwayNotice({ seconds, stopped, onResume, onDismiss }: Props) {
  return (
    <div className="w-full rounded-2xl bg-amber-400 p-4 text-slate-900" role="alert">
      <p className="flex items-center gap-2 font-bold">
        <Icon name="alert" className="h-5 w-5" />
        듣기가 {formatDuration(seconds)} 동안 멈춰 있었어요
      </p>
      <p className="mt-1 text-sm">
        그동안 나온 안내는 듣지 못했어요. {stopped ? "다시 듣기를 눌러 이어서 들어요." : "지금은 다시 듣고 있어요."}
      </p>
      <div className="mt-3 flex gap-2">
        {stopped && (
          <button className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white" onClick={onResume}>
            다시 듣기
          </button>
        )}
        <button className="flex-1 rounded-xl bg-white/60 py-2.5 text-sm font-semibold" onClick={onDismiss}>
          확인
        </button>
      </div>
    </div>
  );
}
