type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const isDev = process.env.NODE_ENV === "development";

export function logger(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (isDev && (level === "debug" || level === "info")) {
    console.log(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  }
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => logger("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => logger("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => logger("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => logger("error", msg, meta),
};
