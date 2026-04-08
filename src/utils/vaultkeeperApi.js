import axios from "axios";
import { APP_VERSION, APP_PLATFORM } from "../constants";

export function createVaultkeeperClient() {
  const endpoint = localStorage.getItem("vaultkeeper-endpoint") || "";
  const apiKey = localStorage.getItem("vaultkeeper-apiKey") || "";

  return axios.create({
    baseURL: endpoint,
    headers: {
      ...(apiKey && { "X-API-Key": apiKey }),
      "X-Client-Version": APP_VERSION,
      "X-Client-Platform": APP_PLATFORM,
    },
  });
}

export function createLoginClient(backendUrl) {
  return axios.create({
    baseURL: backendUrl.replace(/\/+$/, ""),
    headers: {
      "X-Client-Version": APP_VERSION,
      "X-Client-Platform": APP_PLATFORM,
    },
  });
}
