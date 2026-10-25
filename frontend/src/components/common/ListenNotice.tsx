import Icon from "./Icon";

interface Props {
  onAgree: () => void;
  onCancel: () => void;
}

/** 처음 듣기 전에 보여주는 안내: 음성이 외부로 전송되고 원본은 저장하지 않는다는 것 (CLAUDE.md 보안·개인정보) */
export default function ListenNotice({ onAgree, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="listen-notice-title">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-slate-900">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name="mic" className="h-6 w-6" />
        </span>
        <h2 id="listen-notice-title" className="mt-4 text-xl font-bold">
          듣기 전에 알려드려요
        </h2>
        <ul className="mt-3 space-y-2 text-slate-600">
          <li className="flex gap-2">
            <Icon name="info" className="mt-0.5 h-5 w-5 text-brand-600" />
            <span>음성이 텍스트 변환·분석을 위해 외부 AI로 전송되며 원본은 저장하지 않습니다.</span>
          </li>
          <li className="flex gap-2">
            <Icon name="info" className="mt-0.5 h-5 w-5 text-brand-600" />
            <span>화면을 켜 둔 동안에만 들을 수 있어요. 다른 앱으로 가거나 화면이 꺼지면 듣기가 멈춰요.</span>
          </li>
        </ul>
        <div className="mt-6 flex gap-2">
          <button className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold" onClick={onCancel}>
            취소
          </button>
          <button className="flex-[2] rounded-xl bg-brand-600 py-3 font-semibold text-white" onClick={onAgree}>
            동의하고 시작
          </button>
        </div>
      </div>
    </div>
  );
}
