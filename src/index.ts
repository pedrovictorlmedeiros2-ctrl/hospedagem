import { PrismaCareerRepository } from "./career/adapters/prismaCareerRepository.js";
import { PrismaTrainingRepository } from "./career/adapters/prismaTrainingRepository.js";
import { PrismaCardRepository } from "./cards/adapters/prismaCardRepository.js";
import { PrismaCompetitionRepository } from "./competitions/adapters/prismaCompetitionRepository.js";
import { loadEnv } from "./config/env.js";
import { getPrismaClient, disconnectPrisma } from "./database/prisma.js";
import { createDiscordClient } from "./discord/client.js";
import { PrismaMarketRepository } from "./economy/adapters/prismaMarketRepository.js";
import { PrismaWalletRepository } from "./economy/adapters/prismaWalletRepository.js";
import { PrismaMatchRepository } from "./game/adapters/prismaMatchRepository.js";
import { PrismaRecordRepository } from "./global/adapters/prismaRecordRepository.js";
import { PrismaRivalryRepository } from "./global/adapters/prismaRivalryRepository.js";
import { PrismaUserRepository } from "./identity/adapters/prismaUserRepository.js";
import { PrismaDuelRepository } from "./multiplayer/adapters/prismaDuelRepository.js";
import { PrismaPlayerRepository } from "./player/adapters/prismaPlayerRepository.js";
import { EventBus } from "./shared/eventBus.js";
import { createLogger } from "./shared/logger.js";

async function main() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const prisma = getPrismaClient();
  const events = new EventBus(logger);
  const userRepository = new PrismaUserRepository(prisma);
  const playerRepository = new PrismaPlayerRepository(prisma);
  const careerRepository = new PrismaCareerRepository(prisma);
  const trainingRepository = new PrismaTrainingRepository(prisma);
  const competitionRepository = new PrismaCompetitionRepository(prisma);
  const matchRepository = new PrismaMatchRepository(prisma);
  const walletRepository = new PrismaWalletRepository(prisma);
  const marketRepository = new PrismaMarketRepository(prisma);
  const cardRepository = new PrismaCardRepository(prisma);
  const duelRepository = new PrismaDuelRepository(prisma);
  const recordRepository = new PrismaRecordRepository(prisma);
  const rivalryRepository = new PrismaRivalryRepository(prisma);

  const client = createDiscordClient({
    prisma,
    logger,
    events,
    userRepository,
    playerRepository,
    careerRepository,
    trainingRepository,
    competitionRepository,
    matchRepository,
    walletRepository,
    marketRepository,
    cardRepository,
    duelRepository,
    recordRepository,
    rivalryRepository,
  });

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
