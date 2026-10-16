import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" };

export default function Button({ variant = "primary", className = "", ...props }: Props) {
  const style =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300"
      : "border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-40";
  return <button className={`rounded-xl px-4 py-3 font-semibold transition ${style} ${className}`} {...props} />;
}
