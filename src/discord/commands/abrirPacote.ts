import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { PACKS } from "../../cards/domain/catalog.js";
import { CARD_RARITY_EMOJI, CARD_RARITY_LABELS } from "../../cards/domain/labels.js";
import { openPack } from "../../cards/services/openPack.js";
import { achievementUnlockLines } from "../ui/achievementUnlockLines.js";
import { buildCardAttachment } from "../ui/cardImage.js";
import type { Command } from "./types.js";

const packChoices = PACKS.map((pack) => ({ name: pack.name, value: pack.id }));

export const abrirPacoteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("abrir-pacote")
    .setDescription("Compra e abre um pacote de cartas.")
    .addStringOption((opt) =>
      opt.setName("pacote").setDescription("Qual pacote comprar").setRequired(true).addChoices(...packChoices),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const packId = interaction.options.getString("pacote", true);

    const result = await openPack(
      {
        userRepository: ctx.userRepository,
        cardRepository: ctx.cardRepository,
        walletRepository: ctx.walletRepository,
        achievementRepository: ctx.achievementRepository,
      },
      { discordId: interaction.user.id, packId, requestId: interaction.id },
    );

    const cardLines = result.cards.map((c) => {
      const base = `${CARD_RARITY_EMOJI[c.rarity]} **${c.name}** (${c.position}, OVR ${c.overall}) — ${CARD_RARITY_LABELS[c.rarity]}`;
      return c.ability ? `${base}\n   ✨ ${c.ability}` : base;
    });

    // One filename per drawn card, not per card id — the same card can be
    // drawn more than once in a single pack, and attachment filenames must
    // be unique within one message.
    const attachments = result.cards.map((c, i) => buildCardAttachment(c, `card-${i}.png`));
    const gallery = new MediaGalleryBuilder().addItems(
      ...result.cards.map(
        (c, i) => (item: MediaGalleryItemBuilder) => item.setURL(`attachment://card-${i}.png`).setDescription(c.name),
      ),
    );

    const card = new ContainerBuilder()
      .setAccentColor(0xf1c40f)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🎴 ${result.packName} aberto!`))
      .addMediaGalleryComponents(gallery)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(cardLines.join("\n")))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`🪙 -${result.coinsSpent} coins • Saldo: ${result.walletBalance} coins`),
      );

    const unlockLines = achievementUnlockLines(result.achievementsUnlocked);
    if (unlockLines.length > 0) {
      card.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent(unlockLines.join("\n")));
    }

    await interaction.editReply({ components: [card], files: attachments, flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      { discordId: interaction.user.id, packId, cards: result.cards.map((c) => c.id) },
      "pack opened",
    );
  },
};
