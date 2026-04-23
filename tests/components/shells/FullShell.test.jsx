import { it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { FullShell } from "../../../src/components/shells/FullShell";
import { AuthContext } from "../../../src/contexts/AuthContext";

let mock;
beforeEach(() => {
  mock = new MockAdapter(axios);
  mock.onGet("/api/v1/ui-preferences").reply(200, {});
  mock.onGet("/api/v1/repo/status").reply(200, { connected: true, description: "d" });
  mock.onGet("/api/v1/sources").reply(200, { sources: [] });
  mock.onAny().reply(200, {});
});
afterEach(() => mock.restore());

it("renders the full sidebar (5 nav items) and Logout button", () => {
  const auth = {
    status: "authenticated", isRepositoryConnected: true,
    repoDescription: "repo-desc", runningTaskCount: 0,
    userEmail: "u@e", logout: vi.fn(),
    setRepositoryConnected: vi.fn(), setRepoDescription: vi.fn(),
  };
  render(<AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={["/snapshots"]}><FullShell /></MemoryRouter>
  </AuthContext.Provider>);

  expect(screen.getByTestId("nav-snapshots")).toBeTruthy();
  expect(screen.getByTestId("nav-policies")).toBeTruthy();
  expect(screen.getByTestId("nav-tasks")).toBeTruthy();
  expect(screen.getByTestId("nav-repo")).toBeTruthy();
  expect(screen.getByTestId("nav-preferences")).toBeTruthy();
  expect(screen.getByRole("button", { name: /logout/i })).toBeTruthy();
});
