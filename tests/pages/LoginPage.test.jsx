/* eslint-disable react/prop-types */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { LoginPage } from "../../src/pages/LoginPage";
import { AuthContext } from "../../src/contexts/AuthContext";

let mock;
beforeEach(() => { mock = new MockAdapter(axios); localStorage.clear(); });
afterEach(() => mock.restore());

function renderWithCtx(ctxValue) {
  return render(<AuthContext.Provider value={ctxValue}><LoginPage /></AuthContext.Provider>);
}

describe("LoginPage", () => {
  it("renders email, password inputs and submit button", () => {
    mock.onGet("/api/v1/repo/status").reply(200, { hostname: "h" });
    renderWithCtx({ status: "unauthenticated", error: null, login: vi.fn() });
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /sign in|로그인/i })).toBeTruthy();
  });

  it("calls ctx.login with email, password, hostname on submit", async () => {
    mock.onGet("/api/v1/repo/status").reply(200, { hostname: "host-1" });
    const login = vi.fn().mockResolvedValue();
    renderWithCtx({ status: "unauthenticated", error: null, login });

    // Wait for hostname fetch to settle before submit
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/api/v1/repo/status")).toBe(true));

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in|로그인/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: "a@b.c", password: "pw", hostname: "host-1" }));
  });

  it("renders error message from ctx", () => {
    mock.onGet("/api/v1/repo/status").reply(200, {});
    renderWithCtx({ status: "error", error: "Bad credentials", login: vi.fn() });
    expect(screen.getByText(/bad credentials/i)).toBeTruthy();
  });

  it("disables submit button while bootstrapping", () => {
    mock.onGet("/api/v1/repo/status").reply(200, {});
    renderWithCtx({ status: "bootstrapping", error: null, login: vi.fn() });
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });
});
