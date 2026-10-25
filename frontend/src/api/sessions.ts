import type { Change, Session, Todo } from "../types";
import { request } from "./client";

export interface SessionOptions {
  my_number?: string | null;
  my_name?: string | null;
}

export const createSession = (title: string, domain = "hospital", options: SessionOptions = {}) =>
  request<Session>("/sessions", { method: "POST", body: JSON.stringify({ title, domain, ...options }) });

export const getSession = (id: string) => request<Session>(`/sessions/${id}`);

/** 보낸 필드만 바뀝니다. 빈 문자열("")은 지우기 */
export const updateSession = (id: string, options: SessionOptions) =>
  request<Session>(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(options) });

export const getHistory = (id: string) => request<Change[]>(`/sessions/${id}/history`);

export const confirmChange = (changeId: number, approve: boolean) =>
  request<Change>(`/changes/${changeId}/confirm`, { method: "POST", body: JSON.stringify({ approve }) });

export const updateTodo = (todoId: number, done: boolean) =>
  request<Todo>(`/todos/${todoId}`, { method: "PATCH", body: JSON.stringify({ done }) });
