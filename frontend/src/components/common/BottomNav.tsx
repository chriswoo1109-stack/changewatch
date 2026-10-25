import { NavLink } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "홈", icon: "home" },
  { to: "/session", label: "정리", icon: "list" },
  { to: "/history", label: "기록", icon: "history" },
  { to: "/settings", label: "설정", icon: "settings" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? "font-semibold text-brand-600" : "text-slate-400"}`
          }
        >
          <Icon name={t.icon} className="h-6 w-6" />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
