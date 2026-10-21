/** 불러오는 동안 보여주는 회색 자리 표시. "불러오는 중..." 글자 대신 화면 모양을 미리 보여줍니다. */
export default function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none ${className}`} aria-hidden />;
}

/** 카드 여러 장 모양의 로딩 표시 */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </div>
  );
}
