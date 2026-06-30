import type { CompanyLedger } from "@bedlam/shared";
import { api } from "./client";

export const companyLedgerApi = {
  list: (companyId: string) => api.get<CompanyLedger>(`/companies/${companyId}/ledger`),
};
