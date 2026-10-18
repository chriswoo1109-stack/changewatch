import { useEffect } from "react";

interface Props {
  message: string;
  onClose: () => void;
}

/** 화면 전체를 깜빡이고 상단에 큰 알림을 띄웁니다. (진동 지원 기기는 진동도) */
export default function AlertFlash({ message, onClose }: Props) {
  useEffect(() => {
    navigator.vibrate?.([300, 150, 300]);
  }, [message]);

  return (
    <>
      <div key={message} className="cw-flash pointer-events-none fixed inset-0 z-40 bg-amber-300" aria-hidden />
      <div className="fixed left-1/2 top-3 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2" role="alert">
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-amber-500 p-4 text-left text-lg font-bold text-white shadow-xl"
        >
          🔔 {message}
          <span className="mt-1 block text-xs font-normal text-amber-100">눌러서 닫기</span>
        </button>
      </div>
    </>
  );
}
