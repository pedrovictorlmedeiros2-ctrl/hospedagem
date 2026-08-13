import { REST, Routes } from "discord.js";
import { loadEnv } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { buildCommandRegistry } from "./commandRegistry.js";

/**
 * Registers slash commands with Discord. Run via `npm run deploy-commands`.
 *
 * Scoped to DISCORD_DEV_GUILD_ID when set (instant propagation — ideal
 * while iterating), otherwise registers globally (takes up to ~1h to
 * propagate to every guild).
 */
async function main() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  const commands = [...buildCommandRegistry().values()].map((command) => command.data.toJSON());
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);

  const route = env.DISCORD_DEV_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  await rest.put(route, { body: commands });

  logger.info(
    { count: commands.length, scope: env.DISCORD_DEV_GUILD_ID ? "guild" : "global" },
    "slash commands registered",
  );
}

main().catch((error: unknown) => {
  console.error("Failed to deploy commands:", error);
  process.exitCode = 1;
});
