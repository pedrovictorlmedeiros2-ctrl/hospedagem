import pino from "pino";

export function createLogger(level: string) {
  const isProduction = process.env["NODE_ENV"] === "production";

  return isProduction
    ? pino({ level })
    : pino({
        level,
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      });
}

export type Logger = ReturnType<typeof createLogger>;
