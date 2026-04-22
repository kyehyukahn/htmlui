import React, { Component } from "react";
import { createLoginClient } from "../utils/vaultkeeperApi";
import { saveVaultkeeperSession } from "../utils/vaultkeeperBootstrap";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";
import PropTypes from "prop-types";


export class SetupRepositoryVaultkeeper extends Component {
  constructor(props) {
    super(props);

    const savedConfig = localStorage.getItem("vaultkeeper-storageConfig");
    this.state = {
      backendUrl: localStorage.getItem("vaultkeeper-endpoint") || import.meta.env.VITE_VAULTKEEPER_BACKEND_URL || "",
      email: "",
      password: "",
      loggedIn: !!savedConfig,
      isLoading: false,
      error: null,
      storageConfig: savedConfig ? JSON.parse(savedConfig) : null,
    };
  }

  handleLogin = async (e) => {
    e.preventDefault();
    this.setState({ isLoading: true, error: null });

    const { backendUrl, email, password } = this.state;
    const url = backendUrl.replace(/\/+$/, "");

    try {
      const response = await createLoginClient(backendUrl).post("/auth/client-login", {
        email,
        password,
        hostname: this.props.hostname || "unknown",
      });

      const data = response.data;

      if (data.status === "pending") {
        this.setState({ isLoading: false, error: "관리자 승인 대기 중입니다." });
        return;
      }

      if (data.status === "suspended") {
        this.setState({ isLoading: false, error: "계정이 일시 정지되었습니다. 관리자에게 문의하세요." });
        return;
      }

      if (data.status !== "active") {
        this.setState({ isLoading: false, error: "로그인할 수 없습니다." });
        return;
      }

      if (!data.storageConfig) {
        this.setState({ isLoading: false, error: "저장소 설정이 아직 할당되지 않았습니다. 관리자에게 문의하세요." });
        return;
      }

      // Save credentials for future API calls
      saveVaultkeeperSession({
        endpoint: url,
        apiKey: data.apiKey,
        clientId: data.clientId,
        storageConfig: data.storageConfig,
        simplifyMode: data.simplifyMode,
      });

      this.setState({
        isLoading: false,
        loggedIn: true,
        storageConfig: data.storageConfig,
      });
    } catch (err) {
      let errorMessage = "Vaultkeeper 서버에 연결할 수 없습니다. URL을 확인하세요.";
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        }
      }
      this.setState({ isLoading: false, error: errorMessage });
    }
  };

  handleNext = () => {
    const { storageConfig } = this.state;
    const s3Settings = {
      endpoint: storageConfig.endpoint || "",
      bucket: storageConfig.bucketName || "",
      accessKeyID: storageConfig.accessKey || "",
      secretAccessKey: storageConfig.secretAccessKey || "",
      region: storageConfig.region || "",
      prefix: storageConfig.prefix || "",
    };
    this.props.onStorageConfigured(s3Settings, storageConfig.dataProtectionKey || "");
  };

  renderLoginForm() {
    return (
      <Form onSubmit={this.handleLogin}>
        <h3>Vaultkeeper Login</h3>
        <p className="text-muted">Vaultkeeper 계정으로 로그인하면 저장소 설정이 자동으로 채워집니다.</p>
        <Row>
          <Form.Group as={Col}>
            <Form.Label className="required">Backend URL</Form.Label>
            <Form.Control
              size="sm"
              type="url"
              placeholder="https://backend.example.com"
              value={this.state.backendUrl}
              onChange={(e) => this.setState({ backendUrl: e.target.value })}
              required
              autoFocus
            />
          </Form.Group>
        </Row>
        <Row>
          <Form.Group as={Col}>
            <Form.Label className="required">Email</Form.Label>
            <Form.Control
              size="sm"
              type="email"
              placeholder="enter email"
              value={this.state.email}
              onChange={(e) => this.setState({ email: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group as={Col}>
            <Form.Label className="required">Password</Form.Label>
            <Form.Control
              size="sm"
              type="password"
              placeholder="enter password"
              value={this.state.password}
              onChange={(e) => this.setState({ password: e.target.value })}
              required
            />
          </Form.Group>
        </Row>
        {this.state.error && (
          <Row>
            <Form.Group as={Col}>
              <Form.Text className="error">{this.state.error}</Form.Text>
            </Form.Group>
          </Row>
        )}
        <hr />
        <Button variant="warning" onClick={this.props.onBack}>
          Back
        </Button>
        &nbsp;
        <Button variant="primary" type="submit" disabled={this.state.isLoading}>
          Login
        </Button>
        {this.state.isLoading && <Spinner animation="border" variant="primary" size="sm" style={{ marginLeft: 8 }} />}
      </Form>
    );
  }

  renderStorageConfig() {
    const { storageConfig } = this.state;

    const ReadOnlyField = (label, value, masked) => (
      <Form.Group as={Col}>
        <Form.Label>{label}</Form.Label>
        <Form.Control size="sm" value={masked ? "••••••••••••••••" : (value || "")} readOnly plaintext />
      </Form.Group>
    );

    return (
      <Form onSubmit={(e) => { e.preventDefault(); this.handleNext(); }}>
        <h3>Storage Configuration</h3>
        <div className="alert alert-success" style={{ fontSize: "0.9em" }}>
          ✓ Vaultkeeper 로그인 완료 — 설정이 자동으로 채워졌습니다.
        </div>
        <Row>
          {ReadOnlyField("Endpoint", storageConfig.endpoint)}
          {ReadOnlyField("Bucket", storageConfig.bucketName)}
        </Row>
        <Row>
          {ReadOnlyField("Access Key ID", storageConfig.accessKey)}
          {ReadOnlyField("Secret Access Key", null, true)}
        </Row>
        <Row>
          {ReadOnlyField("Region", storageConfig.region)}
          {ReadOnlyField("Prefix", storageConfig.prefix)}
        </Row>
        <hr />
        <Button variant="warning" onClick={this.props.onBack}>
          Back
        </Button>
        &nbsp;
        <Button variant="primary" type="submit">
          Next
        </Button>
      </Form>
    );
  }

  render() {
    if (this.state.loggedIn) {
      return this.renderStorageConfig();
    }
    return this.renderLoginForm();
  }
}

SetupRepositoryVaultkeeper.propTypes = {
  hostname: PropTypes.string.isRequired,
  onStorageConfigured: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
