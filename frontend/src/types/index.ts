// 백엔드 응답 형식과 똑같이 맞춥니다. (docs/api.md 참고)

export type ChangeType = "new" | "change" | "correction" | "cancel" | "mention" | "uncertain";
export type ChangeStatus = "applied" | "pending" | "ignored" | "rejected";

export interface Fact {
  key: string;
  label: string;
  value: string;
  updated_at: string;
}

export interface Todo {
  id: number;
  text: string;
  evidence: string;
  done: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  domain: string;
  my_number: string | null;
  my_name: string | null;
  created_at: string;
  facts: Fact[];
  todos: Todo[];
}

/** 안내에서 내 번호·이름이 불렸을 때만 옵니다. */
export interface MyTurn {
  matched: string;
  evidence: string;
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
  todos: Todo[]; // 이번 안내에서 새로 생긴 할 일
  my_turn: MyTurn | null;
}

/** 대기 모드 조각 1개의 처리 결과 */
export interface ListenResponse {
  text: string; // 새로 들린 문장. 다음 조각을 보낼 때 prev_text로 넘깁니다.
  skipped: boolean;
  my_turn: MyTurn | null;
  analysis: AnalyzeResponse | null; // 안내 키워드가 있을 때만
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
