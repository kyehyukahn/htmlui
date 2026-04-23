import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";

export function SimpleHeader() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const email = auth.userEmail || "Signed in";

  return (
    <header className="vk-header">
      <div className="vk-header-spacer" />
      <button
        type="button"
        className="vk-header-email"
        onClick={() => navigate("/dashboard")}
        title="Dashboard"
      >
        {email}
      </button>
      <button
        type="button"
        className="vk-header-logout"
        onClick={() => auth.logout()}
      >
        Logout
      </button>
    </header>
  );
}
