import { PulseApiClient } from "@pulse/api-client";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export const apiClient = new PulseApiClient({
  baseUrl: getBaseUrl(),
});
