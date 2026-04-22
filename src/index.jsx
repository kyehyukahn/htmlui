import React from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import App from "./App";
import "./css/index.css";
import "./css/Shell.css";

const tok = document.head.querySelector('meta[name="kopia-csrf-token"]');
axios.defaults.headers.common["X-Kopia-Csrf-Token"] = tok?.content || "-";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
