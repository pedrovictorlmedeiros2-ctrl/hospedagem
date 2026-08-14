import type { PrismaClient } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import type { CareerRepository } from "../../career/ports/careerRepository.js";
import type { TrainingRepository } from "../../career/ports/trainingRepository.js";
import type { CardRepository } from "../../cards/ports/cardRepository.js";
import type { CompetitionRepository } from "../../competitions/ports/competitionRepository.js";
import type { MarketRepository } from "../../economy/ports/marketRepository.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import type { Logger } from "../../shared/logger.js";

export interface CommandContext {
  prisma: PrismaClient;
  logger: Logger;
  events: EventBus;
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  trainingRepository: TrainingRepository;
  competitionRepository: CompetitionRepository;
  matchRepository: MatchRepository;
  walletRepository: WalletRepository;
  marketRepository: MarketRepository;
  cardRepository: CardRepository;
}

/**
 * Deliberately loose about which SlashCommandBuilder variant `data` is:
 * discord.js narrows the builder's TYPE based on which methods you call
 * (e.g. `addStringOption` returns `SlashCommandOptionsOnlyBuilder`, which
 * no longer has `addSubcommand`, enforcing Discord's "options XOR
 * subcommands" rule at compile time). A command only needs `name` (for
 * dispatch) and `toJSON` (for registration) — every builder variant has
 * both, so this interface is the least common denominator instead of
 * fighting the union.
 */
export interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
}
