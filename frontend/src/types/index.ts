// 백엔드 응답 형식과 똑같이 맞춥니다. (docs/api.md 참고)

export type ChangeType = "new" | "change" | "correction" | "cancel" | "mention" | "uncertain";
export type ChangeStatus = "applied" | "pending" | "ignored" | "rejected";

export interface Fact {
  key: string;
  label: string;
  value: string;
  updated_at: string;
}

export interface Session {
  id: string;
  title: string;
  domain: string;
  created_at: string;
  facts: Fact[];
}

export interface Change {
  id: number;
  key: string;
  label: string;
  old_value: string | null;
  new_value: string | null;
  change_type: ChangeType;
  evidence: string;
  confidence: number;
  status: ChangeStatus;
  reason: string;
  created_at: string;
}

export interface AnalyzeResponse {
  announcement_id: number;
  text: string;
  changes: Change[];
  needs_confirmation: boolean;
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  new: "신규",
  change: "변경",
  correction: "정정",
  cancel: "취소",
  mention: "단순 언급",
  uncertain: "불확실",
};

export const STATUS_LABEL: Record<ChangeStatus, string> = {
  applied: "반영됨",
  pending: "확인 필요",
  ignored: "유지",
  rejected: "거절됨",
};
