import Icon from "./Icon";

interface Props {
  state: "idle" | "listening" | "busy"; // 대기 / 듣는 중(빨강 물결) / 분석 중(초록 깜빡임)
}

/** 녹음 화면의 큰 마이크. 듣는 중에는 바깥으로 퍼지는 물결로 "듣고 있다"는 걸 보여줍니다. */
export default function ListeningOrb({ state }: Props) {
  const color = state === "listening" ? "bg-red-500" : state === "busy" ? "bg-brand-500" : "bg-slate-700";
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      {state === "listening" && (
        <>
          {/* 움직임 줄이기 설정 사용자는 물결 없이 */}
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30 motion-reduce:hidden" />
          <span className="absolute -inset-3 animate-ping rounded-full bg-red-500/15 [animation-delay:500ms] motion-reduce:hidden" />
        </>
      )}
      <span
        className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-xl ${color} ${
          state === "busy" ? "animate-pulse" : ""
        }`}
      >
        <Icon name={state === "busy" ? "spinner" : "mic"} className="h-12 w-12" />
      </span>
    </div>
  );
}
