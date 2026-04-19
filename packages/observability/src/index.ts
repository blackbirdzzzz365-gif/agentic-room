type LogMethod = (message: string, detail?: unknown) => void;

function log(level: string, message: string, detail?: unknown) {
  const prefix = `[agentic-room][${level}]`;
  if (detail === undefined) {
    console.log(prefix, message);
    return;
  }

  console.log(prefix, message, detail);
}

export const logger: Record<"info" | "warn" | "error", LogMethod> = {
  info: (message, detail) => log("info", message, detail),
  warn: (message, detail) => log("warn", message, detail),
  error: (message, detail) => log("error", message, detail)
};
