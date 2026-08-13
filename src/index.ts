import { loadEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";
import { EventBus } from "./shared/eventBus.js";
import { getPrismaClient, disconnectPrisma } from "./database/prisma.js";
import { createDiscordClient } from "./discord/client.js";

async function main() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const prisma = getPrismaClient();
  const events = new EventBus(logger);

  const client = createDiscordClient({ prisma, logger, events });

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    client.destroy();
    await disconnectPrisma();
    process.exit(0);
  }
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("unhandledRejection", (error) => {
    logger.error({ error }, "unhandled rejection");
  });

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch((error: unknown) => {
  console.error("Fatal error during startup:", error);
  process.exitCode = 1;
});
