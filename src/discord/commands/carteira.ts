import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import type { WalletTransactionRecord } from "../../economy/ports/walletRepository.js";
import { viewWallet } from "../../economy/services/viewWallet.js";
import type { Command } from "./types.js";

const REASON_LABELS: Record<string, string> = {
  MATCH_REWARD: "Recompensa de partida",
  INTENSIVE_TRAINING: "Treino intensivo",
  SALARY: "Salário",
  TRANSFER_SIGNING_BONUS: "Bônus de assinatura (transferência)",
  PACK_PURCHASE: "Compra de pacote",
};

function formatTransactionLine(tx: WalletTransactionRecord): string {
  const sign = tx.type === "SOURCE" ? "+" : "-";
  const label = REASON_LABELS[tx.reason] ?? tx.reason;
  return `${sign}${tx.amount} 🪙 — ${label}`;
}

export const carteiraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("carteira")
    .setDescription("Mostra seu saldo de coins e o histórico recente de movimentações."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewWallet(
      { userRepository: ctx.userRepository, walletRepository: ctx.walletRepository },
      { discordId: interaction.user.id },
    );

    const card = new ContainerBuilder()
      .setAccentColor(0xf39c12)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🪙 Carteira"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${view.coins} coins**`));

    if (view.recentTransactions.length > 0) {
      const lines = view.recentTransactions.map(formatTransactionLine);
      card
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(["**Últimas movimentações**", ...lines].join("\n")),
        );
    }

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
