import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@agentic-room/auth": resolve(__dirname, "packages/auth/src/index.ts"),
      "@agentic-room/contracts": resolve(__dirname, "packages/contracts/src/index.ts"),
      "@agentic-room/db": resolve(__dirname, "packages/db/src/index.ts"),
      "@agentic-room/domain": resolve(__dirname, "packages/domain/src/index.ts"),
      "@agentic-room/integrations": resolve(__dirname, "packages/integrations/src/index.ts"),
      "@agentic-room/ledger": resolve(__dirname, "packages/ledger/src/index.ts"),
      "@agentic-room/observability": resolve(__dirname, "packages/observability/src/index.ts"),
      "@agentic-room/settlement": resolve(__dirname, "packages/settlement/src/index.ts"),
      "@agentic-room/testkit": resolve(__dirname, "packages/testkit/src/index.ts"),
      "@agentic-room/ui": resolve(__dirname, "packages/ui/src/index.ts")
    }
  }
});
