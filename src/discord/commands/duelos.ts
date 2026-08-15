import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type RepliableInteraction,
} from "discord.js";
import { DUEL_TIER_EMOJI } from "../../multiplayer/domain/labels.js";
import { listDuels } from "../../multiplayer/services/listDuels.js";
import type { Command, CommandContext } from "./types.js";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  FINISHED: "Finalizado",
  DECLINED: "Recusado",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em andamento",
  CANCELLED: "Cancelado",
};

export async function renderDuelos(interaction: RepliableInteraction, ctx: CommandContext): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const view = await listDuels(
    { userRepository: ctx.userRepository, duelRepository: ctx.duelRepository },
    { discordId: interaction.user.id },
  );

  const lines = await Promise.all(
    view.duels.slice(0, 10).map(async (duel) => {
      const counterpart = await interaction.client.users.fetch(duel.counterpartDiscordId).catch(() => null);
      const counterpartName = counterpart?.username ?? "usuário desconhecido";
      const direction = duel.role === "CHALLENGER" ? `você desafiou ${counterpartName}` : `${counterpartName} te desafiou`;
      const outcome =
        duel.status === "FINISHED" ? (duel.isWinner === null ? " — empate" : duel.isWinner ? " — você venceu" : " — você perdeu") : "";
      return `${DUEL_TIER_EMOJI[duel.tier]} ${direction} — ${STATUS_LABELS[duel.status] ?? duel.status}${outcome}`;
    }),
  );

  const card = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚔️ Seus duelos"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        lines.length > 0 ? lines.join("\n") : "Você ainda não tem nenhum duelo. Use /duelo-desafiar para começar.",
      ),
    );

  await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
}

export const duelosCommand: Command = {
  data: new SlashCommandBuilder().setName("duelos").setDescription("Mostra seus duelos recentes (enviados e recebidos)."),

  execute: renderDuelos,
};
