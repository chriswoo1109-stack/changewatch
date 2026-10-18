import type { ButtonHTMLAttributes } from "react";
import Icon from "./Icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
  loading?: boolean; // true면 돌아가는 표시를 보여주고 누를 수 없게 합니다
};

export default function Button({ variant = "primary", loading = false, className = "", disabled, children, ...props }: Props) {
  const style =
    variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300"
      : "border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-40";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition ${style} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Icon name="spinner" className="h-5 w-5" />}
      {children}
    </button>
  );
}
