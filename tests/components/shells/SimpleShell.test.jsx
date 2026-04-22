/* eslint-disable react/prop-types */
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { SimpleShell } from "../../../src/components/shells/SimpleShell";
import { AuthContext } from "../../../src/contexts/AuthContext";

let mock;
beforeEach(() => {
  mock = new MockAdapter(axios);
  mock.onGet("/api/v1/ui-preferences").reply(200, {});
  // Snapshots page requires sources & repo status to render without throwing
  mock.onGet("/api/v1/sources").reply(200, { sources: [] });
  mock.onGet("/api/v1/repo/status").reply(200, { connected: true });
  mock.onAny().reply(200, {});
});
afterEach(() => mock.restore());

it("renders the sidebar (Snapshots + Tasks links)", () => {
  const auth = {
    status: "authenticated", simplifyMode: true, isRepositoryConnected: true,
    repoDescription: "", runningTaskCount: 0, userEmail: "u@e",
    setRepositoryConnected: vi.fn(), setRepoDescription: vi.fn(), logout: vi.fn(),
  };
  render(<AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={["/tasks"]}><SimpleShell /></MemoryRouter>
  </AuthContext.Provider>);

  // Sidebar renders the two simple-mode links and omits hidden ones
  expect(screen.getAllByText(/Snapshots/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Tasks/i).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Policies/i)).toBeNull();
  expect(screen.queryByText(/Preferences/i)).toBeNull();
  expect(screen.queryByText(/Repository/i)).toBeNull();
});
