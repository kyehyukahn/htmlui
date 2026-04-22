/* eslint-disable react/prop-types */
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { SimpleShell } from "../../../src/components/shells/SimpleShell";
import { AuthContext } from "../../../src/contexts/AuthContext";

let mock;
beforeEach(() => {
  mock = new MockAdapter(axios);
  mock.onGet("/api/v1/ui-preferences").reply(200, {});
  mock.onAny().reply(200, {});
});
afterEach(() => mock.restore());

it("redirects unknown paths to /snapshots", async () => {
  const auth = {
    status: "authenticated", simplifyMode: true, isRepositoryConnected: true,
    repoDescription: "", runningTaskCount: 0, userEmail: "u@e",
    setRepositoryConnected: vi.fn(), setRepoDescription: vi.fn(), logout: vi.fn(),
  };
  render(<AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={["/policies"]}><SimpleShell /></MemoryRouter>
  </AuthContext.Provider>);

  // Navigate redirect to /snapshots means Snapshots page renders,
  // or at minimum no "Policies" content appears
  await waitFor(() => expect(screen.queryByText(/Snapshots/i)).toBeTruthy());
});
