import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "../firebaseClient";
import { fetchMe } from "../api";
import type { UserRole } from "../types";

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const token = await nextUser.getIdToken();
          const profile = await fetchMe(token);
          setRole(profile.role);
        } catch {
          // Role defaults to "member" on the server, so if the lookup
          // fails just assume the non-privileged case rather than blocking.
          setRole("member");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    role,
    loading,
    signIn: async (email, password) => {
      if (!auth) {
        throw new Error(
          "Login isn't set up yet. Please try again once it's configured."
        );
      }
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async (email, password) => {
      if (!auth) {
        throw new Error(
          "Sign up isn't set up yet. Please try again once it's configured."
        );
      }
      await createUserWithEmailAndPassword(auth, email, password);
    },
    logOut: async () => {
      if (!auth) return;
      await signOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
