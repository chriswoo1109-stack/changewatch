import { Link } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

interface Props {
  icon: IconName;
  title: string;
  description?: string;
  action?: { to: string; label: string };
}

/** 보여줄 내용이 없을 때: 아이콘 + 한 줄 설명 + 다음에 할 일 버튼 */
export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="mt-4 font-bold text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && (
        <Link to={action.to} className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
          {action.label}
        </Link>
      )}
    </div>
  );
}
