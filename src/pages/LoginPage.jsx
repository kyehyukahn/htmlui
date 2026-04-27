import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { AuthContext } from "../contexts/AuthContext";
import { APP_VERSION } from "../constants";

export function LoginPage() {
  const ctx = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hostname, setHostname] = useState("");

  useEffect(() => {
    // GET /current-user returns OS hostname regardless of repo connection
    // state. /repo/status only has hostname when connected, so using that
    // meant a logout-then-login cycle (repo disconnected in between) could
    // resolve to "unknown" and spawn a duplicate backend client record.
    axios.get("/api/v1/current-user")
      .then((r) => setHostname(r.data?.hostname || ""))
      .catch(() => setHostname(""));
  }, []);

  const isBootstrapping = ctx.status === "bootstrapping";
  const hostnameReady = !!hostname;

  const submit = async (e) => {
    e.preventDefault();
    if (!hostnameReady) return; // guard: never submit with empty/unknown hostname
    try { await ctx.login({ email, password, hostname }); } catch { /* ctx sets error */ }
  };

  return (
    <div className="vk-login-root">
      <div className="vk-login-card">
        <img src="/kopia-flat.svg" alt="VaultKeeper" className="vk-login-logo" />
        <div className="vk-login-brand">
          <span className="vk-brand-accent">Vault</span>Keeper
        </div>
        <h4 className="vk-login-title">Sign in</h4>

        {ctx.error && <Alert variant="danger">{ctx.error}</Alert>}

        <Form onSubmit={submit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="vk-login-email">Email</Form.Label>
            <Form.Control
              id="vk-login-email" type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={isBootstrapping}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="vk-login-pw">Password</Form.Label>
            <Form.Control
              id="vk-login-pw" type="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={isBootstrapping}
            />
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100" disabled={isBootstrapping || !hostnameReady}>
            {isBootstrapping
              ? (<><Spinner size="sm" animation="border" /> 연결 중...</>)
              : !hostnameReady
                ? (<><Spinner size="sm" animation="border" /> 호스트 정보 확인 중...</>)
                : "Sign in"}
          </Button>
        </Form>

        <div
          className="vk-login-version"
          title={import.meta.env.VITE_FULL_VERSION_INFO || ""}
        >
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
