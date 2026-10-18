import { useEffect, useRef } from "react";

interface Props {
  message: string;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 4000;

/** 화면 전체를 깜빡이고 상단에 큰 알림을 띄웁니다. (진동 지원 기기는 진동도)
 *  4초 뒤 자동으로 닫히고, 화면 아무 데나 눌러도 닫힙니다. */
export default function AlertFlash({ message, onClose }: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    navigator.vibrate?.([300, 150, 300]);
    const timer = window.setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <>
      {/* 깜빡이는 막: 누르면 알림 닫기 (아래 화면 조작은 닫은 뒤에) */}
      <div key={message} className="cw-flash fixed inset-0 z-40 bg-amber-300" aria-hidden onClick={onClose} />
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
