import React, { useContext } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserCircle } from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../../contexts/AuthContext";

export function SimpleHeader() {
  const auth = useContext(AuthContext);
  const email = auth.userEmail || "";
  const connected = !!auth.isRepositoryConnected;

  return (
    <header className="vk-header">
      <div className="vk-header-spacer" />
      <Dropdown align="end">
        <Dropdown.Toggle variant="link" className="vk-header-avatar" id="vk-user-menu">
          <FontAwesomeIcon icon={faUserCircle} size="lg" />
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Header>{email}</Dropdown.Header>
          <Dropdown.Divider />
          <Dropdown.ItemText className="vk-conn-status">
            <span className={connected ? "vk-dot vk-dot-ok" : "vk-dot vk-dot-bad"} />
            연결 상태: {connected ? "정상" : "끊김"}
          </Dropdown.ItemText>
          <Dropdown.Divider />
          <Dropdown.Item onClick={() => auth.logout()}>Sign out</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </header>
  );
}
