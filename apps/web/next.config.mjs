/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@agentic-room/contracts"]
};

export default nextConfig;
