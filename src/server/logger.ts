import fs from "fs";
import path from "path";
import util from "util";

// Disable file logging on Vercel or when ENABLE_FILE_LOGGING is not 'true'
// On Vercel, process.env.VERCEL is automatically set to "1"
const isVercel = Boolean(process.env.VERCEL);
const fileLoggingEnabled = process.env.ENABLE_FILE_LOGGING === "true" && !isVercel;

// Ensure logs directory exists at the root of the project only if enabled
const logsDir = path.resolve(process.cwd(), "logs");
if (fileLoggingEnabled && !fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

// Log file named by date or single combined server log
const logFilePath = path.join(logsDir, "server.log");

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToLogFile(level: string, message: string) {
  if (!fileLoggingEnabled) return;
  try {
    const line = `[${formatTimestamp()}] [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, line, "utf8");
  } catch (err) {
    // Fail silently so logging never crashes server operations
  }
}

// Global flag to ensure we only monkey-patch console once across hot-reloads
const globalLogger = globalThis as unknown as { __server_logger_initialized__?: boolean };

export function initServerLogger() {
  if (!fileLoggingEnabled || globalLogger.__server_logger_initialized__) {
    return;
  }
  globalLogger.__server_logger_initialized__ = true;

  writeToLogFile("SYSTEM", `=======================================================`);
  writeToLogFile("SYSTEM", `Server logger initialized (PID: ${process.pid}, NODE_ENV: ${process.env.NODE_ENV || "development"})`);
  writeToLogFile("SYSTEM", `Log file location: ${logFilePath}`);
  writeToLogFile("SYSTEM", `=======================================================`);

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  console.log = function (...args: any[]) {
    writeToLogFile("INFO", util.format(...args));
    originalLog.apply(console, args);
  };

  console.info = function (...args: any[]) {
    writeToLogFile("INFO", util.format(...args));
    originalInfo.apply(console, args);
  };

  console.warn = function (...args: any[]) {
    writeToLogFile("WARN", util.format(...args));
    originalWarn.apply(console, args);
  };

  console.error = function (...args: any[]) {
    writeToLogFile("ERROR", util.format(...args));
    originalError.apply(console, args);
  };

  console.debug = function (...args: any[]) {
    writeToLogFile("DEBUG", util.format(...args));
    originalDebug.apply(console, args);
  };

  // Intercept uncaught exceptions and unhandled rejections to file
  process.on("uncaughtException", (err) => {
    writeToLogFile("FATAL", `Uncaught Exception: ${err?.stack || err}`);
  });

  process.on("unhandledRejection", (reason) => {
    writeToLogFile("FATAL", `Unhandled Rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  });
}

// Run immediately when imported on server
initServerLogger();

export { logFilePath };
