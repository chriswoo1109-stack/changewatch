import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "홈", icon: "⌂" },
  { to: "/session", label: "정리", icon: "☰" },
  { to: "/history", label: "기록", icon: "◷" },
  { to: "/settings", label: "설정", icon: "⚙" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center py-2 text-xs ${isActive ? "text-blue-600" : "text-slate-400"}`
          }
        >
          <span className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
