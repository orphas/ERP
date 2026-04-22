import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function normalizeBasePath(input?: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}

const createNextConfig = (phase: string): NextConfig => {
  const appBasePath = normalizeBasePath(process.env.APP_BASE_PATH);

  return {
    reactStrictMode: true,
    ...(appBasePath ? { basePath: appBasePath } : {}),
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    typescript: {
      ignoreBuildErrors: false,
    },
    eslint: {
      ignoreDuringBuilds: false,
    },
    experimental: {
      cpus: 1,
      workerThreads: false,
    },
  };
};

export default createNextConfig;
