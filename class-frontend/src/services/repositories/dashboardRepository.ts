import { apiRequest } from "../api/apiClient";
import type { DashboardData } from "../../shared/types/domain";

export interface DashboardRepository {
  getManagementDashboard(tenantSlug: string): Promise<DashboardData>;
}

export const dashboardRepository: DashboardRepository = {
  getManagementDashboard: (tenantSlug) => apiRequest<DashboardData>("dashboard", { tenantSlug }),
};
