import axios from "axios";
import React, { Component } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { useNavigate, useLocation } from "react-router-dom";
import { handleChange } from "../forms";
import { PolicyEditor } from "../components/policy-editor/PolicyEditor";
import { SnapshotEstimation } from "../components/SnapshotEstimation";
import { RequiredDirectory } from "../forms/RequiredDirectory";
import { CLIEquivalent } from "../components/CLIEquivalent";
import { errorAlert, redirect } from "../utils/uiutil";
import { GoBackButton } from "../components/GoBackButton";
import { createVaultkeeperClient } from "../utils/vaultkeeperApi";
import PropTypes from "prop-types";

class SnapshotCreateInternal extends Component {
  constructor() {
    super();
    this.state = {
      path: "",
      estimateTaskID: null,
      estimateTaskVisible: false,
      lastEstimatedPath: "",
      policyEditorVisibleFor: "n/a",
      localUsername: null,
    };

    this.policyEditorRef = React.createRef();
    this.handleChange = handleChange.bind(this);
    this.estimate = this.estimate.bind(this);
    this.snapshotNow = this.snapshotNow.bind(this);
    this.maybeResolveCurrentPath = this.maybeResolveCurrentPath.bind(this);
  }

  componentDidMount() {
    axios
      .get("/api/v1/sources")
      .then((result) => {
        this.setState({
          localUsername: result.data.localUsername,
          localHost: result.data.localHost,
        });
      })
      .catch((error) => {
        redirect(error);
      });

    // Vaultkeeper 로그인 상태면 backend policy 조회
    const apiKey = localStorage.getItem("vaultkeeper-apiKey");
    const endpoint = localStorage.getItem("vaultkeeper-endpoint");
    if (apiKey && endpoint) {
      const vkClient = createVaultkeeperClient();
      vkClient
        .get("/policies")
        .then((result) => {
          const policies = result.data;
          const activePolicy = policies.find((p) => p.isActive);
          if (activePolicy) {
            this.setState({
              backendPolicy: activePolicy.kopiaPolicy,
              backendPolicyId: activePolicy.id,
            });
          }
        })
        .catch(() => {
          // best-effort — backend 미연결 시 기존 동작 유지
        });
    }
  }

  maybeResolveCurrentPath(lastResolvedPath) {
    const currentPath = this.state.path;

    if (lastResolvedPath !== currentPath) {
      if (this.state.path) {
        axios
          .post("/api/v1/paths/resolve", { path: currentPath })
          .then((result) => {
            this.setState({
              lastResolvedPath: currentPath,
              resolvedSource: result.data.source,
            });

            // check again, it's possible that this.state.path has changed
            // while we were resolving
            this.maybeResolveCurrentPath(currentPath);
          })
          .catch((error) => {
            redirect(error);
          });
      } else {
        this.setState({
          lastResolvedPath: currentPath,
          resolvedSource: "",
        });

        this.maybeResolveCurrentPath(currentPath);
      }
    }
  }

  componentDidUpdate() {
    this.maybeResolveCurrentPath(this.state.lastResolvedPath);

    if (this.state.estimateTaskVisible && this.state.lastEstimatedPath !== this.state.resolvedSource.path) {
      this.setState({
        estimateTaskVisible: false,
      });
    }
  }

  estimate(e) {
    e.preventDefault();

    if (!this.state.resolvedSource.path) {
      return;
    }

    const pe = this.policyEditorRef.current;
    if (!pe) {
      return;
    }

    try {
      let req = {
        root: this.state.resolvedSource.path,
        maxExamplesPerBucket: 10,
        policyOverride: pe.getAndValidatePolicy(),
      };

      axios
        .post("/api/v1/estimate", req)
        .then((result) => {
          this.setState({
            lastEstimatedPath: this.state.resolvedSource.path,
            estimateTaskID: result.data.id,
            estimatingPath: result.data.description,
            estimateTaskVisible: true,
            didEstimate: false,
          });
        })
        .catch((error) => {
          errorAlert(error);
        });
    } catch (e) {
      errorAlert(e);
    }
  }

  snapshotNow(e) {
    e.preventDefault();

    if (!this.state.resolvedSource.path) {
      alert("Must specify directory to snapshot.");
      return;
    }

    const pe = this.policyEditorRef.current;
    if (!pe) {
      return;
    }

    try {
      axios
        .post("/api/v1/sources", {
          path: this.state.resolvedSource.path,
          createSnapshot: true,
          policy: pe.getAndValidatePolicy(),
        })
        .then(async (_result) => {
          console.log("[vaultkeeper] POST /api/v1/sources 성공, backend 보고 시작");
          // Vaultkeeper backend에 스냅샷 보고 (best-effort)
          const apiKey = localStorage.getItem("vaultkeeper-apiKey");
          const endpoint = localStorage.getItem("vaultkeeper-endpoint");
          console.log("[vaultkeeper] apiKey:", apiKey ? "있음" : "없음", "endpoint:", endpoint);
          if (apiKey && endpoint) {
            try {
              const vkClient = createVaultkeeperClient();
              const snapshotRes = await vkClient.post(
                "/snapshots",
                {
                  sourcePath: this.state.resolvedSource.path,
                  status: "uploading",
                  startTime: new Date().toISOString(),
                },
              );

              // path 레벨 policy 신규 생성 (snapshotId 연결)
              if (snapshotRes.data?.id) {
                const clientId = localStorage.getItem("vaultkeeper-clientId");
                await vkClient.post(
                  "/policies",
                  {
                    clientId,
                    snapshotId: snapshotRes.data.id,
                    name: `${this.state.resolvedSource.path} snapshot policy`,
                    policyLevel: "path",
                    kopiaPolicy: pe.getAndValidatePolicy(),
                  },
                );
              }
            } catch (err) {
              console.warn("[vaultkeeper] backend 보고 실패:", err);
            }
          }

          this.props.navigate(-1);
        })
        .catch((error) => {
          console.error("[vaultkeeper] POST /api/v1/sources 실패:", error);
          errorAlert(error);

          this.setState({
            error,
            isLoading: false,
          });
        });
    } catch (e) {
      errorAlert(e);
    }
  }

  render() {
    return (
      <>
        <Form.Group>
          <GoBackButton />
        </Form.Group>
        <br />
        <h4>New Snapshot</h4>
        <br />
        <Row>
          <Col>
            {RequiredDirectory(this, null, "path", {
              autoFocus: true,
              placeholder: "enter path to snapshot",
            })}
          </Col>
          <Col xs="auto">
            <Button
              data-testid="estimate-now"
              size="sm"
              disabled={!this.state.resolvedSource?.path}
              title="Estimate"
              variant="secondary"
              onClick={this.estimate}
            >
              Estimate
            </Button>
            <Button
              data-testid="snapshot-now"
              size="sm"
              disabled={!this.state.resolvedSource?.path}
              title="Snapshot Now"
              variant="primary"
              onClick={this.snapshotNow}
            >
              Snapshot Now
            </Button>
          </Col>
        </Row>
        {this.state.estimateTaskID && this.state.estimateTaskVisible && (
          <SnapshotEstimation taskID={this.state.estimateTaskID} hideDescription={true} showZeroCounters={true} />
        )}
        <br />
        {this.state.resolvedSource && (
          <Row>
            <Col xs={12}>
              <Form.Text>{this.state.resolvedSource ? this.state.resolvedSource.path : this.state.path}</Form.Text>
              <PolicyEditor
                ref={this.policyEditorRef}
                embedded
                host={this.state.resolvedSource.host}
                userName={this.state.resolvedSource.userName}
                path={this.state.resolvedSource.path}
                policyOverride={this.state.backendPolicy}
              />
            </Col>
          </Row>
        )}
        <br />
        <CLIEquivalent
          command={`snapshot create ${this.state.resolvedSource ? this.state.resolvedSource.path : this.state.path}`}
        />
      </>
    );
  }
}

SnapshotCreateInternal.propTypes = {
  navigate: PropTypes.func,
  location: PropTypes.object,
};

export function SnapshotCreate(props) {
  const navigate = useNavigate();
  const location = useLocation();

  return <SnapshotCreateInternal navigate={navigate} location={location} {...props} />;
}
