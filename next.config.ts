import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't emit AGENTS.md / CLAUDE.md into the repo on dev/build.
  agentRules: false,
};

export default nextConfig;
