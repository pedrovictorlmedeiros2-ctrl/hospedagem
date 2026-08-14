import Groq from "groq-sdk";
import { PrismaAchievementRepository } from "./achievements/adapters/prismaAchievementRepository.js";
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
import type { RecordCategory } from "./global/domain/records.js";
import { PrismaUserRepository } from "./identity/adapters/prismaUserRepository.js";
import { PrismaDuelRepository } from "./multiplayer/adapters/prismaDuelRepository.js";
import { FallbackNarrativeGenerator } from "./narrative/adapters/fallbackNarrativeGenerator.js";
import { GroqNarrativeGenerator } from "./narrative/adapters/groqNarrativeGenerator.js";
import { PrismaNewsRepository } from "./narrative/adapters/prismaNewsRepository.js";
import { TemplateNarrativeGenerator } from "./narrative/adapters/templateNarrativeGenerator.js";
import type { NarrativeGenerator } from "./narrative/ports/narrativeGenerator.js";
import { publishRecordNews } from "./narrative/services/publishRecordNews.js";
import { PrismaPlayerRepository } from "./player/adapters/prismaPlayerRepository.js";
import { EventBus } from "./shared/eventBus.js";
import { createLogger } from "./shared/logger.js";
import { redactError } from "./shared/redact.js";

// Read directly from process.env (not the parsed/validated `env`) so a
// leak can be scrubbed even if the failure happened before/while loading
// env — e.g. loadEnv() itself throwing, or a startup crash outside main().
// See RISK_REGISTER.md risco #9.
function knownSecrets(): string[] {
  return [process.env["DATABASE_URL"], process.env["DISCORD_BOT_TOKEN"], process.env["GROQ_API_KEY"]].filter(
    (value): value is string => Boolean(value),
  );
}

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
  const newsRepository = new PrismaNewsRepository(prisma);
  const achievementRepository = new PrismaAchievementRepository(prisma);

  // Groq is purely the narrative layer's primary text source — never in
  // the gameplay-critical path (see ADR 0001, adenda Fase 10). Without a
  // key, the template fallback IS the generator, not a degraded mode.
  const templateNarrativeGenerator = new TemplateNarrativeGenerator();
  const narrativeGenerator: NarrativeGenerator = env.GROQ_API_KEY
    ? new FallbackNarrativeGenerator(
        new GroqNarrativeGenerator(new Groq({ apiKey: env.GROQ_API_KEY })),
        templateNarrativeGenerator,
        logger,
      )
    : templateNarrativeGenerator;

  // Fire-and-forget subscriber: turns a broken world record into a
  // published News article without ever blocking the match/duel flow that
  // emitted the event (EventBus never awaits handlers — see
  // shared/eventBus.ts).
  events.on("RECORD_BROKEN", async (payload) => {
    await publishRecordNews(
      { narrativeGenerator, newsRepository, playerRepository, logger },
      {
        category: payload.category as RecordCategory,
        playerId: payload.playerId,
        previousHolderId: payload.previousHolderId,
        previousValue: payload.previousValue,
        value: payload.value,
        now: new Date(),
      },
    );
  });

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
    narrativeGenerator,
    newsRepository,
    achievementRepository,
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
    logger.error({ error: redactError(error, knownSecrets()) }, "unhandled rejection");
  });

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch((error: unknown) => {
  console.error("Fatal error during startup:", redactError(error, knownSecrets()));
  process.exitCode = 1;
});
