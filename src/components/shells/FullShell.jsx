import React, { useContext, useMemo } from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Policy } from "../../pages/Policy";
import { Preferences } from "../../pages/Preferences";
import { Policies } from "../../pages/Policies";
import { Repository } from "../../pages/Repository";
import { Task } from "../../pages/Task";
import { Tasks } from "../../pages/Tasks";
import { Snapshots } from "../../pages/Snapshots";
import { SnapshotCreate } from "../../pages/SnapshotCreate";
import { SnapshotDirectory } from "../../pages/SnapshotDirectory";
import { SnapshotHistory } from "../../pages/SnapshotHistory";
import { SnapshotRestore } from "../../pages/SnapshotRestore";
import { AppContext } from "../../contexts/AppContext";
import { UIPreferenceProvider } from "../../contexts/UIPreferencesContext";
import { AuthContext } from "../../contexts/AuthContext";

export function FullShell() {
  const auth = useContext(AuthContext);

  const appAdapter = useMemo(() => ({
    repositoryUpdated: (connected) => {
      auth.setRepositoryConnected(connected);
      window.location.replace(connected ? "/snapshots" : "/repo");
    },
    repositoryDescriptionUpdated: (desc) => auth.setRepoDescription(desc),
    runningTaskCount: auth.runningTaskCount,
    isRepositoryConnected: auth.isRepositoryConnected,
    logout: auth.logout,
  }), [auth]);

  return (
    <AppContext.Provider value={appAdapter}>
      <UIPreferenceProvider>
        <Navbar expand="sm" variant="light">
          <Navbar.Brand href="/">
            <img src="/kopia-flat.svg" className="App-logo" alt="logo" />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <NavLink data-testid="tab-snapshots"
                className={auth.isRepositoryConnected ? "nav-link" : "nav-link disabled"}
                to="/snapshots">Snapshots</NavLink>
              <NavLink data-testid="tab-policies"
                className={auth.isRepositoryConnected ? "nav-link" : "nav-link disabled"}
                to="/policies">Policies</NavLink>
              <NavLink data-testid="tab-tasks"
                className={auth.isRepositoryConnected ? "nav-link" : "nav-link disabled"}
                to="/tasks">
                Tasks{auth.runningTaskCount > 0 ? ` (${auth.runningTaskCount})` : ""}
              </NavLink>
              <NavLink data-testid="tab-repo" className="nav-link" to="/repo">Repository</NavLink>
              <NavLink data-testid="tab-preferences" className="nav-link" to="/preferences">Preferences</NavLink>
            </Nav>
            <Nav>
              {auth.userEmail && <Navbar.Text className="me-2">{auth.userEmail}</Navbar.Text>}
              <Button size="sm" variant="outline-secondary" onClick={() => auth.logout()}>Sign out</Button>
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        <Container fluid>
          <NavLink to="/repo" style={{ color: "inherit", textDecoration: "inherit" }}>
            <h5 className="mb-4">{auth.repoDescription}</h5>
          </NavLink>
          <Routes>
            <Route path="snapshots" element={<Snapshots />} />
            <Route path="snapshots/new" element={<SnapshotCreate />} />
            <Route path="snapshots/single-source/" element={<SnapshotHistory />} />
            <Route path="snapshots/dir/:oid/restore" element={<SnapshotRestore />} />
            <Route path="snapshots/dir/:oid" element={<SnapshotDirectory />} />
            <Route path="policies/edit/" element={<Policy />} />
            <Route path="policies" element={<Policies />} />
            <Route path="tasks/:tid" element={<Task />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="repo" element={<Repository />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="/" element={<Navigate to="/snapshots" />} />
          </Routes>
        </Container>
      </UIPreferenceProvider>
    </AppContext.Provider>
  );
}
