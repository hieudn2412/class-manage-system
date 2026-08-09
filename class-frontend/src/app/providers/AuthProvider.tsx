import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { authRepository, type LoginInput } from "../../services/repositories/authRepository";
import { clearSession, loadSession, saveSession } from "../../shared/lib/sessionStorage";
import type { AuthSession } from "../../shared/types/domain";

interface AuthContextValue {
  session: AuthSession | null;
  login: (input: LoginInput, remember: boolean) => Promise<AuthSession>;
  platformLogin: (username: string, password: string, remember: boolean) => Promise<AuthSession>;
  setChangedPasswordSession: (session: AuthSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());

  useEffect(() => {
    const handleUnauthenticated = () => {
      clearSession();
      setSession(null);
    };
    window.addEventListener("edu-ops:unauthenticated", handleUnauthenticated);
    return () => window.removeEventListener("edu-ops:unauthenticated", handleUnauthenticated);
  }, []);

  const login = useCallback(async (input: LoginInput, remember: boolean) => {
    const nextSession = await authRepository.login(input);
    saveSession(nextSession, remember);
    setSession(nextSession);
    return nextSession;
  }, []);

  const setChangedPasswordSession = useCallback((nextSession: AuthSession) => {
    const remembered = Boolean(localStorage.getItem("edu-ops:session"));
    saveSession(nextSession, remembered);
    setSession(nextSession);
  }, []);

  const platformLogin = useCallback(async (username: string, password: string, remember: boolean) => {
    const nextSession = await authRepository.platformLogin(username, password);
    saveSession(nextSession, remember);
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, login, platformLogin, setChangedPasswordSession, logout }),
    [session, login, platformLogin, setChangedPasswordSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
