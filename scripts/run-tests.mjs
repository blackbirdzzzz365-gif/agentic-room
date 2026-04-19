import { spawn } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--runInBand");
const child = spawn("pnpm", ["exec", "vitest", "run", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => process.exit(code ?? 1));
