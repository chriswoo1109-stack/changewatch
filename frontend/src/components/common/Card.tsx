import type { ReactNode } from "react";

/** 흰 카드. 테두리 대신 은은한 그림자로 배경(연한 회색) 위에 떠 보이게 합니다. */
export default function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-card ${className}`}>{children}</div>;
}
