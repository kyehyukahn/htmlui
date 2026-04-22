import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { AuthContext } from "../contexts/AuthContext";

export function LoginPage() {
  const ctx = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hostname, setHostname] = useState("");

  useEffect(() => {
    axios.get("/api/v1/repo/status")
      .then((r) => setHostname(r.data?.hostname || "unknown"))
      .catch(() => setHostname("unknown"));
  }, []);

  const isBootstrapping = ctx.status === "bootstrapping";

  const submit = async (e) => {
    e.preventDefault();
    try { await ctx.login({ email, password, hostname: hostname || "unknown" }); } catch { /* ctx sets error */ }
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
          <Button type="submit" variant="primary" className="w-100" disabled={isBootstrapping}>
            {isBootstrapping ? (<><Spinner size="sm" animation="border" /> 연결 중...</>) : "Sign in"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
