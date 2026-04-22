/* eslint-disable react/prop-types */
import { it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import App from "../src/App";

let mock;
beforeEach(() => { mock = new MockAdapter(axios); localStorage.clear(); mock.onAny().reply(200, {}); });
afterEach(() => mock.restore());

it("renders LoginPage when unauthenticated", async () => {
  const { container } = render(<App />);
  await waitFor(() => expect(container.querySelector(".vk-login-card")).toBeTruthy());
});
