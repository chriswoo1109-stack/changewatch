import type { Change, Session } from "../types";
import { request } from "./client";

export const createSession = (title: string, domain = "hospital") =>
  request<Session>("/sessions", { method: "POST", body: JSON.stringify({ title, domain }) });

export const getSession = (id: string) => request<Session>(`/sessions/${id}`);

export const getHistory = (id: string) => request<Change[]>(`/sessions/${id}/history`);

export const confirmChange = (changeId: number, approve: boolean) =>
  request<Change>(`/changes/${changeId}/confirm`, { method: "POST", body: JSON.stringify({ approve }) });
