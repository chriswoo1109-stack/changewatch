import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" };

export default function Button({ variant = "primary", className = "", ...props }: Props) {
  const style =
    variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300"
      : "border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-40";
  return <button className={`rounded-xl px-4 py-3 font-semibold transition ${style} ${className}`} {...props} />;
}
