import { it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SimpleSidebar } from "../../../src/components/shells/SimpleSidebar";
import { AuthContext } from "../../../src/contexts/AuthContext";

it("renders only Snapshots and Tasks links", () => {
  render(<AuthContext.Provider value={{ runningTaskCount: 2 }}>
    <MemoryRouter><SimpleSidebar /></MemoryRouter>
  </AuthContext.Provider>);
  expect(screen.getByText(/Snapshots/)).toBeTruthy();
  expect(screen.getByText(/Tasks \(2\)/)).toBeTruthy();
  expect(screen.queryByText(/Repository/)).toBeNull();
  expect(screen.queryByText(/Policies/)).toBeNull();
  expect(screen.queryByText(/Preferences/)).toBeNull();
});
