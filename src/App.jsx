import "bootstrap/dist/css/bootstrap.min.css";
import "./css/Theme.css";
import "./css/App.css";
import React, { useContext } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { SimpleShell, FullShell } from "./components/shells";

function AuthGate() {
  const auth = useContext(AuthContext);
  if (auth.status === "uninitialized" || auth.status === "bootstrapping") {
    // Bootstrapping still shows LoginPage (with disabled/spinner button)
    return <LoginPage />;
  }
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
