import {
  faCalendarTimes,
  faClock,
  faExclamationTriangle,
  faFileAlt,
  faFileArchive,
  faFolderOpen,
  faMagic,
  faCog,
  faCogs,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import React, { Component } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";
import Accordion from "react-bootstrap/Accordion";
import { handleChange, stateProperty, valueToNumber } from "../../forms";
import { StringList } from "../../forms/StringList";
import { LogDetailSelector } from "../../forms/LogDetailSelector";
import { OptionalBoolean } from "../../forms/OptionalBoolean";
import { OptionalNumberField } from "../../forms/OptionalNumberField";
import { RequiredBoolean } from "../../forms/RequiredBoolean";
import { TimesOfDayList } from "../../forms/TimesOfDayList";
import { errorAlert, toAlgorithmOption } from "../../utils/uiutil";
import { sourceQueryStringParams } from "../../utils/policyutil";
import { PolicyEditorLink } from "../PolicyEditorLink";
import { LabelColumn } from "./LabelColumn";
import { ValueColumn } from "./ValueColumn";
import { WideValueColumn } from "./WideValueColumn";
import { EffectiveValue } from "./EffectiveValue";
import { EffectiveListValue } from "./EffectiveListValue";
import { EffectiveTextAreaValue } from "./EffectiveTextAreaValue";
import { EffectiveTimesOfDayValue } from "./EffectiveTimesOfDayValue";
import { EffectiveBooleanValue } from "./EffectiveBooleanValue";
import { EffectiveValueColumn } from "./EffectiveValueColumn";
import { UpcomingSnapshotTimes } from "./UpcomingSnapshotTimes";
import { SectionHeaderRow } from "./SectionHeaderRow";
import { ActionRowScript } from "./ActionRowScript";
import { ActionRowTimeout } from "./ActionRowTimeout";
import { ActionRowMode } from "./ActionRowMode";
import { useSimplifyMode } from "../../contexts/AuthContext";
import PropTypes from "prop-types";

export class PolicyEditorInner extends Component {
  constructor() {
    super();
    this.state = {
      items: [],
      isLoading: false,
      error: null,
    };

    this.fetchPolicy = this.fetchPolicy.bind(this);
    this.handleChange = handleChange.bind(this);
    this.saveChanges = this.saveChanges.bind(this);
    this.isGlobal = this.isGlobal.bind(this);
    this.deletePolicy = this.deletePolicy.bind(this);
    this.policyURL = this.policyURL.bind(this);
    this.resolvePolicy = this.resolvePolicy.bind(this);
    this.PolicyDefinitionPoint = this.PolicyDefinitionPoint.bind(this);
    this.getAndValidatePolicy = this.getAndValidatePolicy.bind(this);
  }

  componentDidMount() {
    axios.get("/api/v1/repo/algorithms").then((result) => {
      this.setState({
        algorithms: result.data,
      });

      this.fetchPolicy(this.props);
    });
  }

  componentDidUpdate(prevProps) {
    if (sourceQueryStringParams(this.props) !== sourceQueryStringParams(prevProps)) {
      this.fetchPolicy(this.props);
    }

    const pjs = JSON.stringify(this.state.policy);
    if (pjs !== this.lastResolvedPolicy) {
      this.resolvePolicy(this.props);
      this.lastResolvedPolicy = pjs;
    }
  }

  deepMerge(base, override) {
    if (!override) return base;
    if (!base) return override;
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (override[key] && typeof override[key] === "object" && !Array.isArray(override[key]) &&
          base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        result[key] = this.deepMerge(base[key], override[key]);
      } else if (override[key] !== undefined && override[key] !== null) {
        result[key] = override[key];
      }
    }
    return result;
  }

  // path 레벨에서 설정할 수 없는 필드 제거 (maxParallelSnapshots는 global/host/user@host 전용)
  stripNonPathFields(policy) {
    if (!policy) return policy;
    const result = { ...policy };
    if (result.upload) {
      const { maxParallelSnapshots: _mps, ...uploadRest } = result.upload;
      result.upload = Object.keys(uploadRest).length > 0 ? uploadRest : undefined;
      if (!result.upload) delete result.upload;
    }
    return result;
  }

  fetchPolicy(props) {
    axios
      .get(this.policyURL(props))
      .then((result) => {
        let kopiaPolicy = result.data;
        if (props.path) {
          kopiaPolicy = this.stripNonPathFields(kopiaPolicy);
        }
        const override = props.path ? this.stripNonPathFields(this.props.policyOverride) : this.props.policyOverride;
        const merged = override
          ? this.deepMerge(kopiaPolicy, override)
          : kopiaPolicy;
        this.setState({
          isLoading: false,
          policy: merged,
        });
      })
      .catch((error) => {
        if (error.response && error.response.data.code !== "NOT_FOUND") {
          this.setState({
            error: error,
            isLoading: false,
          });
        } else {
          const merged = this.props.policyOverride || {};
          this.setState({
            policy: merged,
            isNew: true,
            isLoading: false,
          });
        }
      });
  }

  resolvePolicy(props) {
    const u = "/api/v1/policy/resolve?" + sourceQueryStringParams(props);

    try {
      axios
        .post(u, {
          updates: this.getAndValidatePolicy(),
          numUpcomingSnapshotTimes: 5,
        })
        .then((result) => {
          this.setState({ resolved: result.data });
        })
        .catch((error) => {
          this.setState({ resolvedError: error });
        });
    } catch (e) {
      console.log("Error resolving policy: ", e);
    }
  }

  PolicyDefinitionPoint(p) {
    if (!p) {
      return "";
    }

    if (p.userName === this.props.userName && p.host === this.props.host && p.path === this.props.path) {
      return "(이 정책에서 설정)";
    }

    return <>{PolicyEditorLink(p)}에서 설정</>;
  }

  getAndValidatePolicy() {
    function removeEmpty(l) {
      if (!l) {
        return l;
      }

      let result = [];
      for (let i = 0; i < l.length; i++) {
        const s = l[i];
        if (s === "") {
          continue;
        }

        result.push(s);
      }

      return result;
    }

    function validateTimesOfDay(l) {
      for (const tod of l) {
        if (typeof tod !== "object") {
          // unparsed
          throw Error("invalid time of day: '" + tod + "'");
        }
      }

      return l;
    }

    // clone and clean up policy before saving
    let policy = JSON.parse(JSON.stringify(this.state.policy));
    if (policy.files) {
      if (policy.files.ignore) {
        policy.files.ignore = removeEmpty(policy.files.ignore);
      }
      if (policy.files.ignoreDotFiles) {
        policy.files.ignoreDotFiles = removeEmpty(policy.files.ignoreDotFiles);
      }
    }

    if (policy.compression) {
      if (policy.compression.onlyCompress) {
        policy.compression.onlyCompress = removeEmpty(policy.compression.onlyCompress);
      }
      if (policy.compression.neverCompress) {
        policy.compression.neverCompress = removeEmpty(policy.compression.neverCompress);
      }
    }

    if (policy.scheduling) {
      if (policy.scheduling.timeOfDay) {
        policy.scheduling.timeOfDay = validateTimesOfDay(removeEmpty(policy.scheduling.timeOfDay));
      }
    }

    if (policy.actions) {
      policy.actions = this.sanitizeActions(policy.actions, [
        "beforeSnapshotRoot",
        "afterSnapshotRoot",
        "beforeFolder",
        "afterFolder",
      ]);
    }

    // path 레벨에서 설정 불가능한 필드 제거
    if (this.props.path && policy.upload) {
      delete policy.upload.maxParallelSnapshots;
      if (Object.keys(policy.upload).length === 0) {
        delete policy.upload;
      }
    }

    return policy;
  }

  sanitizeActions(actions, actionTypes) {
    actionTypes.forEach((actionType) => {
      if (actions[actionType]) {
        if (actions[actionType].script === undefined || actions[actionType].script === "") {
          actions[actionType] = undefined;
        } else {
          if (actions[actionType].timeout === undefined) {
            actions[actionType].timeout = 300;
          }
        }
      }
    });
    return actions;
  }

  saveChanges(e) {
    e.preventDefault();

    try {
      const policy = this.getAndValidatePolicy();

      this.setState({ saving: true });
      axios
        .put(this.policyURL(this.props), policy)
        .then((_result) => {
          this.props.close();
        })
        .catch((error) => {
          this.setState({ saving: false });
          errorAlert(error, "Error saving policy");
        });
    } catch (e) {
      errorAlert(e);
      return;
    }
  }

  deletePolicy() {
    if (window.confirm("Are you sure you want to delete this policy?")) {
      this.setState({ saving: true });

      axios
        .delete(this.policyURL(this.props))
        .then((_result) => {
          this.props.close();
        })
        .catch((error) => {
          this.setState({ saving: false });
          errorAlert(error, "Error deleting policy");
        });
    }
  }

  policyURL(props) {
    return "/api/v1/policy?" + sourceQueryStringParams(props);
  }

  isGlobal() {
    return !this.props.host && !this.props.userName && !this.props.path;
  }

  render() {
    const { isLoading, error } = this.state;
    if (error) {
      return <p>{error.message}</p>;
    }

    if (isLoading) {
      return <p>Loading ...</p>;
    }

    return (
      <>
        <Form
          className={"policy-editor" + (this.props.simplifyMode ? " policy-editor-simple" : "")}
          onSubmit={this.saveChanges}
        >
          <Accordion defaultActiveKey="scheduling">
            <Accordion.Item eventKey="retention">
              <Accordion.Header>
                <FontAwesomeIcon icon={faCalendarTimes} />
                &nbsp;스냅샷 보존 정책
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                <Row>
                  <LabelColumn
                    name="최신 스냅샷"
                    help="소스별로 최근 스냅샷을 몇 개까지 보관할지 지정"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, null, "policy.retention.keepLatest", {
                      placeholder: "최신 스냅샷 개수",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.keepLatest")}
                </Row>
                <Row>
                  <LabelColumn
                    name="시간별"
                    help="시간대별로 몇 개까지 보관할지. 각 시간대에서 가장 최근 스냅샷 하나만 남깁니다"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, null, "policy.retention.keepHourly", {
                      placeholder: "시간별 개수",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.keepHourly")}
                </Row>
                <Row>
                  <LabelColumn
                    name="일별"
                    help="일별로 몇 개까지 보관할지. 매일 가장 최근 스냅샷 하나만 남깁니다"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, null, "policy.retention.keepDaily", {
                      placeholder: "일별 개수",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.keepDaily")}
                </Row>
                <Row>
                  <LabelColumn
                    name="주별"
                    help="주별로 몇 개까지 보관할지. 매주 가장 최근 스냅샷 하나만 남깁니다"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, null, "policy.retention.keepWeekly", {
                      placeholder: "주별 개수",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.keepWeekly")}
                </Row>
                <Row>
                  <LabelColumn
                    name="월별"
                    help="월별로 몇 개까지 보관할지. 매 달력 월마다 가장 최근 스냅샷 하나만 남깁니다"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, null, "policy.retention.keepMonthly", {
                      placeholder: "월별 개수",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.keepMonthly")}
                </Row>
                <Row>
                  <LabelColumn
                    name="연별"
                    help="연별로 몇 개까지 보관할지. 매 연도마다 가장 최근 스냅샷 하나만 남깁니다"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, null, "policy.retention.keepAnnual", {
                      placeholder: "연별 개수",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.keepAnnual")}
                </Row>
                <Row>
                  <LabelColumn
                    name="동일 스냅샷 건너뛰기"
                    help="파일 변경이 없을 때는 스냅샷을 저장하지 않음"
                  />
                  <ValueColumn>
                    {OptionalBoolean(this, null, "policy.retention.ignoreIdenticalSnapshots", "상위 정책 상속")}
                  </ValueColumn>
                  {EffectiveValue(this, "retention.ignoreIdenticalSnapshots")}
                </Row>
              </Accordion.Body>
            </Accordion.Item>
            {!this.props.simplifyMode && (<Accordion.Item eventKey="files">
              <Accordion.Header>
                <FontAwesomeIcon icon={faFolderOpen} />
                &nbsp;Files
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                <Row>
                  <LabelColumn
                    name="Ignore Files"
                    help={
                      <>
                        {" "}
                        List of file and directory names to ignore. <br /> (See{" "}
                        <a target="_blank" rel="noreferrer" href="https://kopia.io/docs/advanced/kopiaignore/">
                          documentation on ignoring files
                        </a>
                        ).
                      </>
                    }
                  />
                  <WideValueColumn>
                    {StringList(this, "policy.files.ignore", {
                      placeholder: "e.g. /file.txt",
                    })}
                  </WideValueColumn>
                  {EffectiveTextAreaValue(this, "files.ignore")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Ignore Rules From Parent Directories"
                    help="When set, ignore rules from the parent directory are ignored"
                  />
                  <ValueColumn>{RequiredBoolean(this, "", "policy.files.noParentIgnore")}</ValueColumn>
                  <EffectiveValueColumn />
                </Row>
                <Row>
                  <LabelColumn
                    name="Ignore Rule Files"
                    help="List of additional files containing ignore rules (each file configures ignore rules for the directory and its subdirectories)"
                  />
                  <ValueColumn>
                    {StringList(this, "policy.files.ignoreDotFiles", {
                      placeholder: "e.g. .kopiaignore",
                    })}
                  </ValueColumn>
                  {EffectiveTextAreaValue(this, "files.ignoreDotFiles")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Ignore Rule Files From Parent Directories"
                    help="When set, the files specifying ignore rules (.kopiaignore, etc.) from the parent directory are ignored"
                  />
                  <ValueColumn>{RequiredBoolean(this, "", "policy.files.noParentDotFiles")}</ValueColumn>
                  <EffectiveValueColumn />
                </Row>
                <Row>
                  <LabelColumn
                    name="Ignore Well-Known Cache Directories"
                    help="Ignore directories containing CACHEDIR.TAG and similar"
                  />
                  <ValueColumn>
                    {OptionalBoolean(this, null, "policy.files.ignoreCacheDirs", "inherit from parent")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "files.ignoreCacheDirs")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Ignore Files larger than"
                    help="When set, the files larger than the specified size are ignored (specified in bytes)"
                  />
                  <ValueColumn>{OptionalNumberField(this, "", "policy.files.maxFileSize")}</ValueColumn>
                  {EffectiveValue(this, "files.maxFileSize")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Scan only one filesystem"
                    help="Do not cross filesystem boundaries when creating a snapshot"
                  />
                  <ValueColumn>
                    {OptionalBoolean(this, null, "policy.files.oneFileSystem", "inherit from parent")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "files.oneFileSystem")}
                </Row>
              </Accordion.Body>
            </Accordion.Item>)}
            {!this.props.simplifyMode && (<Accordion.Item eventKey="errors">
              <Accordion.Header>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                &nbsp;Error Handling
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                <Row>
                  <LabelColumn name="Ignore Directory Errors" help="Treat directory read errors as non-fatal." />
                  <ValueColumn>
                    {OptionalBoolean(this, null, "policy.errorHandling.ignoreDirectoryErrors", "inherit from parent")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "errorHandling.ignoreDirectoryErrors")}
                </Row>
                <Row>
                  <LabelColumn name="Ignore File Errors" help="Treat file read errors as non-fatal." />
                  <ValueColumn>
                    {OptionalBoolean(this, null, "policy.errorHandling.ignoreFileErrors", "inherit from parent")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "errorHandling.ignoreFileErrors")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Ignore Unknown Directory Entries"
                    help="Treat unrecognized/unsupported directory entries as non-fatal errors."
                  />
                  <ValueColumn>
                    {OptionalBoolean(this, null, "policy.errorHandling.ignoreUnknownTypes", "inherit from parent")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "errorHandling.ignoreUnknownTypes")}
                </Row>
              </Accordion.Body>
            </Accordion.Item>)}
            {!this.props.simplifyMode && (<Accordion.Item eventKey="compression">
              <Accordion.Header>
                <FontAwesomeIcon icon={faFileArchive} />
                &nbsp;Compression
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                <Row>
                  <LabelColumn
                    name="Compression Algorithm"
                    help="Specify compression algorithm to use when snapshotting files in this directory and subdirectories"
                  />
                  <WideValueColumn>
                    <Form.Control
                      as="select"
                      size="sm"
                      name="policy.compression.compressorName"
                      onChange={this.handleChange}
                      value={stateProperty(this, "policy.compression.compressorName")}
                    >
                      <option value="">(없음)</option>
                      {this.state.algorithms && this.state.algorithms.compression.map((x) => toAlgorithmOption(x, ""))}
                    </Form.Control>
                  </WideValueColumn>
                  {EffectiveValue(this, "compression.compressorName")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Minimum File Size"
                    help="Files that are smaller than the provided value will not be compressed"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, "", "policy.compression.minSize", {
                      placeholder: "minimum file size in bytes",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "compression.minSize")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Max File Size"
                    help="Files whose size exceeds the provided value will not be compressed"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, "", "policy.compression.maxSize", {
                      placeholder: "maximum file size in bytes",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "compression.maxSize")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Only Compress Extensions"
                    help="Only compress files with the following file extensions (one extension per line)"
                  />
                  <WideValueColumn>
                    {StringList(this, "policy.compression.onlyCompress", {
                      placeholder: "e.g. .txt",
                    })}
                  </WideValueColumn>
                  {EffectiveTextAreaValue(this, "compression.onlyCompress")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Never Compress Extensions"
                    help="Never compress the following file extensions (one extension per line)"
                  />
                  <WideValueColumn>
                    {StringList(this, "policy.compression.neverCompress", {
                      placeholder: "e.g. .mp4",
                    })}
                  </WideValueColumn>
                  {EffectiveTextAreaValue(this, "compression.neverCompress")}
                </Row>
              </Accordion.Body>
            </Accordion.Item>)}
            <Accordion.Item eventKey="scheduling">
              <Accordion.Header>
                <FontAwesomeIcon icon={faClock} />
                &nbsp;백업 주기
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                {!this.props.simplifyMode && (<Row>
                  <LabelColumn
                    name="백업 주기"
                    help="Kopia 서버에서 얼마나 자주 스냅샷을 생성할지 (서버 모드에서만 유효)"
                  />
                  <WideValueColumn>
                    <Form.Control
                      as="select"
                      size="sm"
                      name="policy.scheduling.intervalSeconds"
                      onChange={(e) => this.handleChange(e, valueToNumber)}
                      value={stateProperty(this, "policy.scheduling.intervalSeconds")}
                    >
                      <option value="">(none)</option>
                      <option value="600">10분마다</option>
                      <option value="900">15분마다</option>
                      <option value="1200">20분마다</option>
                      <option value="1800">30분마다</option>
                      <option value="3600">1시간마다</option>
                      <option value="10800">3시간마다</option>
                      <option value="21600">6시간마다</option>
                      <option value="43200">12시간마다</option>
                    </Form.Control>
                  </WideValueColumn>
                  {EffectiveValue(this, "scheduling.intervalSeconds")}
                </Row>)}
                {!this.props.simplifyMode && (<Row>
                  <LabelColumn
                    name="특정 시각"
                    help="지정한 시각에 스냅샷 생성 (24시간 형식)"
                  />
                  <ValueColumn>
                    {TimesOfDayList(this, "policy.scheduling.timeOfDay", {
                      placeholder: "예: 17:00",
                    })}
                  </ValueColumn>
                  {EffectiveTimesOfDayValue(this, "scheduling.timeOfDay")}
                </Row>)}
                <Row>
                  <LabelColumn
                    name="Cron 식"
                    help={
                      <>
                        UNIX crontab 문법으로 스냅샷 일정을 지정합니다 (한 줄에 하나).
                        <br /> 지원되는 문법은{" "}
                        <a target="_blank" rel="noreferrer" href="https://github.com/hashicorp/cronexpr#implementation">
                          여기
                        </a>
                        에서 확인하세요.
                      </>
                    }
                  />
                  <ValueColumn>
                    {StringList(this, "policy.scheduling.cron", {
                      placeholder: "분 시 일 월 요일 #주석",
                    })}
                  </ValueColumn>
                  {EffectiveListValue(this, "scheduling.cron")}
                </Row>
                {!this.props.simplifyMode && (<Row>
                  <LabelColumn
                    name="시작 시 놓친 스냅샷 실행"
                    help="Kopia 시작 시 놓친 스냅샷을 즉시 실행 (특정 시각 스냅샷에만 해당)"
                  />
                  <ValueColumn>
                    {OptionalBoolean(this, "", "policy.scheduling.runMissed", "상위 정책 상속")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "scheduling.runMissed")}
                </Row>)}
                {!this.props.simplifyMode && (<Row>
                  <LabelColumn
                    name="수동 스냅샷만 허용"
                    help="스냅샷을 수동으로만 생성 (예약 스냅샷 비활성화)"
                  />
                  <ValueColumn>
                    {OptionalBoolean(this, "", "policy.scheduling.manual", "상위 정책 상속")}
                  </ValueColumn>
                  {EffectiveBooleanValue(this, "scheduling.manual")}
                </Row>)}
                {!this.props.simplifyMode && (<Row>
                  <LabelColumn
                    name="예정된 스냅샷"
                    help="현재 정책 기준으로 계산된 예정 스냅샷 시각"
                  />
                  <ValueColumn></ValueColumn>
                  <EffectiveValueColumn>{UpcomingSnapshotTimes(this.state?.resolved)}</EffectiveValueColumn>
                </Row>)}
              </Accordion.Body>
            </Accordion.Item>
            {!this.props.simplifyMode && (<Accordion.Item eventKey="upload">
              <Accordion.Header>
                <FontAwesomeIcon icon={faUpload} />
                &nbsp;Upload
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                <Row>
                  <LabelColumn
                    name="Maximum Parallel Snapshots"
                    help="Maximum number of snapshots that can be uploaded simultaneously"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, "", "policy.upload.maxParallelSnapshots", {
                      placeholder: !this.props.path
                        ? "max number of parallel snapshots"
                        : "must be specified using global, user, or host policy",
                      disabled: !!this.props.path,
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "upload.maxParallelSnapshots")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Maximum Parallel File Reads"
                    help="Maximum number of files that will be read in parallel (defaults to the number of logical processors)"
                  />
                  <ValueColumn>
                    {OptionalNumberField(this, "", "policy.upload.maxParallelFileReads", {
                      placeholder: "max number of parallel file reads",
                    })}
                  </ValueColumn>
                  {EffectiveValue(this, "upload.maxParallelFileReads")}
                </Row>
              </Accordion.Body>
            </Accordion.Item>)}
            {!this.props.simplifyMode && (<Accordion.Item eventKey="snapshot-actions">
              <Accordion.Header>
                <FontAwesomeIcon icon={faCogs} />
                &nbsp;Snapshot Actions
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                {ActionRowScript(
                  this,
                  "actions.beforeSnapshotRoot.script",
                  "Before Snapshot",
                  "Script to run before snapshot",
                )}
                {ActionRowTimeout(this, "actions.beforeSnapshotRoot.timeout")}
                {ActionRowMode(this, "actions.beforeSnapshotRoot.mode")}
                <hr />
                {ActionRowScript(
                  this,
                  "actions.afterSnapshotRoot.script",
                  "After Snapshot",
                  "Script to run after snapshot",
                )}
                {ActionRowTimeout(this, "actions.afterSnapshotRoot.timeout")}
                {ActionRowMode(this, "actions.afterSnapshotRoot.mode")}
              </Accordion.Body>
            </Accordion.Item>)}
            {!this.props.simplifyMode && (<Accordion.Item eventKey="folder-actions">
              <Accordion.Header>
                <FontAwesomeIcon icon={faCog} />
                &nbsp;Folder Actions
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                {ActionRowScript(this, "actions.beforeFolder.script", "Before Folder", "Script to run before folder")}
                {ActionRowTimeout(this, "actions.beforeFolder.timeout")}
                {ActionRowMode(this, "actions.beforeFolder.mode")}
                <hr />
                {ActionRowScript(this, "actions.afterFolder.script", "After Folder", "Script to run after folder")}
                {ActionRowTimeout(this, "actions.afterFolder.timeout")}
                {ActionRowMode(this, "actions.afterFolder.mode")}
              </Accordion.Body>
            </Accordion.Item>)}
            {!this.props.simplifyMode && (<Accordion.Item eventKey="logging">
              <Accordion.Header>
                <FontAwesomeIcon icon={faFileAlt} />
                &nbsp;Logging
              </Accordion.Header>
              <Accordion.Body>
                <SectionHeaderRow />
                <Row>
                  <LabelColumn name="Directory Snapshotted" help="Log verbosity when a directory is snapshotted" />
                  <WideValueColumn>{LogDetailSelector(this, "policy.logging.directories.snapshotted")}</WideValueColumn>
                  {EffectiveValue(this, "logging.directories.snapshotted")}
                </Row>
                <Row>
                  <LabelColumn name="Directory Ignored" help="Log verbosity when a directory is ignored" />
                  <WideValueColumn>{LogDetailSelector(this, "policy.logging.directories.ignored")}</WideValueColumn>
                  {EffectiveValue(this, "logging.directories.ignored")}
                </Row>
                <Row>
                  <LabelColumn
                    name="File Snapshotted"
                    help="Log verbosity when a file, symbolic link, etc. is snapshotted"
                  />
                  <WideValueColumn>{LogDetailSelector(this, "policy.logging.entries.snapshotted")}</WideValueColumn>
                  {EffectiveValue(this, "logging.entries.snapshotted")}
                </Row>
                <Row>
                  <LabelColumn name="File Ignored" help="Log verbosity when a file, symbolic link, etc. is ignored" />
                  <WideValueColumn>{LogDetailSelector(this, "policy.logging.entries.ignored")}</WideValueColumn>
                  {EffectiveValue(this, "logging.entries.ignored")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Cache Hit"
                    help="Log verbosity when a cache is used instead of uploading the file"
                  />
                  <WideValueColumn>{LogDetailSelector(this, "policy.logging.entries.cacheHit")}</WideValueColumn>
                  {EffectiveValue(this, "logging.entries.cacheHit")}
                </Row>
                <Row>
                  <LabelColumn
                    name="Cache Miss"
                    help="Log verbosity when a cache cannot be used and a file must be hashed"
                  />
                  <WideValueColumn>{LogDetailSelector(this, "policy.logging.entries.cacheMiss")}</WideValueColumn>
                  {EffectiveValue(this, "logging.entries.cacheMiss")}
                </Row>
              </Accordion.Body>
            </Accordion.Item>)}
            {!this.props.simplifyMode && (<Accordion.Item eventKey="other">
              <Accordion.Header>
                <FontAwesomeIcon icon={faMagic} />
                &nbsp;Other
              </Accordion.Header>
              <Accordion.Body>
                <Row>
                  <LabelColumn
                    name="Disable Parent Policy Evaluation"
                    help="Prevents any parent policies from affecting this directory and its subdirectories"
                  />
                  <ValueColumn>{RequiredBoolean(this, "", "policy.noParent")}</ValueColumn>
                </Row>
                <Row>
                  <LabelColumn name="JSON Representation" help="This is the internal representation of a policy" />
                  <WideValueColumn>
                    <pre className="debug-json">{JSON.stringify(this.state.policy, null, 4)}</pre>
                  </WideValueColumn>
                </Row>
              </Accordion.Body>
            </Accordion.Item>)}
          </Accordion>

          {!this.props.embedded && (
            <Button
              size="sm"
              variant="success"
              onClick={this.saveChanges}
              data-testid="button-save"
              disabled={this.state.saving}
            >
              Save Policy
            </Button>
          )}
          {!this.state.isNew && !this.props.embedded && (
            <>
              &nbsp;
              <Button
                size="sm"
                variant="danger"
                disabled={this.isGlobal() || this.state.saving}
                onClick={this.deletePolicy}
              >
                Delete Policy
              </Button>
            </>
          )}
          {this.state.saving && (
            <>
              &nbsp;
              <Spinner animation="border" variant="primary" size="sm" />
            </>
          )}
        </Form>
      </>
    );
  }
}

PolicyEditorInner.propTypes = {
  path: PropTypes.string,
  close: PropTypes.func,
  embedded: PropTypes.bool,
  isNew: PropTypes.bool,
  params: PropTypes.object.isRequired,
  navigate: PropTypes.func.isRequired,
  location: PropTypes.object.isRequired,
  userName: PropTypes.string,
  host: PropTypes.string,
  policyOverride: PropTypes.object,
  simplifyMode: PropTypes.bool,
};

/**
 * Functional wrapper that injects simplifyMode from AuthContext so the class
 * component above can hide non-essential Accordion sections in simple mode.
 * forwardRef preserves the ref pattern used by SnapshotCreate (calls
 * policyEditorRef.current.getAndValidatePolicy()).
 */
export const PolicyEditor = React.forwardRef(function PolicyEditor(props, ref) {
  const simplifyMode = useSimplifyMode();
  return <PolicyEditorInner ref={ref} {...props} simplifyMode={simplifyMode} />;
});
