import { useEffect, useState } from "react";
import { onSlowChange } from "../../api/client";
import Icon from "./Icon";

/** 서버 응답이 4초 넘게 걸리면 화면 위에 띄우는 안내 (잠든 무료 서버를 깨우는 중일 수 있음) */
export default function ServerWaitBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowChange(setSlow), []);
  if (!slow) return null;
  return (
    <div className="fixed left-1/2 top-3 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2" role="status">
      <div className="flex items-start gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-xl">
        <Icon name="spinner" className="mt-0.5 h-5 w-5" />
        <div>
          <p className="font-semibold">서버를 깨우는 중이에요</p>
          <p className="text-sm text-slate-300">처음 접속하면 30초~1분 걸릴 수 있어요. 잠시만 기다려 주세요.</p>
        </div>
      </div>
    </div>
  );
}
