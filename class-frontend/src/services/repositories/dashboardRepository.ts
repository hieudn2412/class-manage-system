import { apiRequest } from "../api/apiClient";
import type {
  DashboardData,
  Page,
  PendingConfirmationItem,
  PendingConfirmationSort,
} from "../../shared/types/domain";

export interface PendingConfirmationParams {
  search: string;
  mode: "" | "IN_PERSON" | "ONLINE";
  from: string;
  to: string;
  sort: PendingConfirmationSort;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface DashboardRepository {
  getManagementDashboard(tenantSlug: string): Promise<DashboardData>;
  getPendingConfirmations(
    tenantSlug: string,
    params: PendingConfirmationParams,
  ): Promise<Page<PendingConfirmationItem>>;
}

const pendingConfirmationQuery = (params: PendingConfirmationParams): string => {
  const query = new URLSearchParams({
    sort: params.sort,
    direction: params.direction,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);
  if (params.mode) query.set("mode", params.mode);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return query.toString();
};

export const dashboardRepository: DashboardRepository = {
  getManagementDashboard: (tenantSlug) => apiRequest<DashboardData>("dashboard", { tenantSlug }),
  getPendingConfirmations: (tenantSlug, params) =>
    apiRequest<Page<PendingConfirmationItem>>(
      `dashboard/pending-confirmations?${pendingConfirmationQuery(params)}`,
      { tenantSlug },
    ),
};
