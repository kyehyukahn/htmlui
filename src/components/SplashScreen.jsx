import React from "react";
import Spinner from "react-bootstrap/Spinner";

/**
 * Full-screen splash shown while AuthContext is restoring a persisted
 * session. Uses the same navy gradient as LoginPage so transitions between
 * the two do not flash a white background.
 */
export function SplashScreen() {
  return (
    <div className="vk-splash-root">
      <div className="vk-splash-brand">
        <span className="vk-brand-accent">Vault</span>Keeper
      </div>
      <Spinner animation="border" variant="primary" size="sm" />
    </div>
  );
}
