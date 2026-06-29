import type {
  CompanyLoop,
  CompanyLoopListItem,
  CompanyLoopProposal,
  CompanyLoopRun,
  CompanyLoopRunDetail,
} from "@bedlam/shared";
import { api } from "./client";

export const companyLoopsApi = {
  list: (companyId: string) => api.get<CompanyLoopListItem[]>(`/companies/${companyId}/loops`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<CompanyLoop>(`/companies/${companyId}/loops`, data),
  get: (id: string) => api.get<CompanyLoop>(`/loops/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.patch<CompanyLoop>(`/loops/${id}`, data),
  archive: (id: string) => api.post<CompanyLoop>(`/loops/${id}/archive`, {}),
  run: (id: string) => api.post<CompanyLoopRun>(`/loops/${id}/run`, {}),
  listRuns: (id: string, limit: number = 50) => api.get<CompanyLoopRun[]>(`/loops/${id}/runs?limit=${limit}`),
  getRun: (id: string) => api.get<CompanyLoopRunDetail>(`/loop-runs/${id}`),
  listProposals: (runId: string) => api.get<CompanyLoopProposal[]>(`/loop-runs/${runId}/proposals`),
  approveProposal: (id: string, note?: string | null) =>
    api.post<CompanyLoopProposal>(`/loop-proposals/${id}/approve`, { note: note ?? null }),
  rejectProposal: (id: string, note?: string | null) =>
    api.post<CompanyLoopProposal>(`/loop-proposals/${id}/reject`, { note: note ?? null }),
  applyProposal: (id: string) => api.post<CompanyLoopProposal>(`/loop-proposals/${id}/apply`, {}),
};
