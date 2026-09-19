import { apiRequest } from "../api/apiClient";
import type { AuthSession, SelfProfile } from "../../shared/types/domain";

export interface OwnPasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export const profileRepository = {
  me: () => apiRequest<SelfProfile>("profile/me"),
  changePassword: (input: OwnPasswordChangeInput) =>
    apiRequest<AuthSession>("profile/me/password", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
