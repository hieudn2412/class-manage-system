import type { AuthSession } from "../types/domain";

const SESSION_KEY = "edu-ops:session";

const parseSession = (raw: string | null): AuthSession | null => {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
};

export const loadSession = (): AuthSession | null =>
  parseSession(localStorage.getItem(SESSION_KEY)) ??
  parseSession(sessionStorage.getItem(SESSION_KEY));

export const saveSession = (session: AuthSession, remember: boolean): void => {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
};
