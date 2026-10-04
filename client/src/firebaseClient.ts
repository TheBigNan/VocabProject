import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let firebaseApp: FirebaseApp | undefined;
let authInstance: Auth | undefined;

if (isFirebaseConfigured) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    authInstance = getAuth(firebaseApp);
  } catch (err) {
    console.error("Failed to initialize Firebase:", err);
  }
} else {
  console.warn(
    "Firebase isn't configured (missing VITE_FIREBASE_* env vars) — login/signup will be disabled until client/.env is filled in."
  );
}

// null when Firebase Auth isn't configured/initialized, so the rest of the
// app can render normally and only login/signup need to handle this case.
export const auth: Auth | null = authInstance ?? null;
