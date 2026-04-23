import "bootstrap/dist/css/bootstrap.min.css";
import "./css/Theme.css";
import "./css/App.css";
import React, { useContext } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { SplashScreen } from "./components/SplashScreen";
import { SimpleShell, FullShell } from "./components/shells";

function AuthGate() {
  const auth = useContext(AuthContext);

  // Session restoration in progress (from persisted localStorage) — do NOT
  // flash LoginPage. Show a neutral splash on the same navy background.
  if (auth.status === "uninitialized" || auth.status === "restoring") {
    return <SplashScreen />;
  }

  // Login attempt in progress (user pressed Sign in) — keep LoginPage so the
  // disabled/spinner button state is visible in the form.
  if (auth.status !== "authenticated") {
    return <LoginPage />;
  }

  return auth.simplifyMode ? <SimpleShell /> : <FullShell />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </Router>
  );
}
