import { createContext, useContext, type ReactNode } from "react";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
} from "@workspace/api-client-react";
import type { Role } from "@/lib/roles";

type AuthEnvelope = {
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  role: Role | null;
  active: boolean;
};

type AuthContextValue = {
  data: AuthEnvelope | undefined;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useGetCurrentAuthUser({
    query: { queryKey: getGetCurrentAuthUserQueryKey() },
  });
  return (
    <AuthContext.Provider
      value={{ data: query.data, isLoading: query.isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
