import { MessageFlags, SlashCommandBuilder } from "discord.js";
import {
  BACKGROUND_LABELS,
  CARD_STYLE_LABELS,
  FRAME_LABELS,
  THEME_LABELS,
} from "../../player/domain/labels.js";
import {
  updatePlayerProfile,
  type RawProfilePatch,
} from "../../player/services/updatePlayerProfile.js";
import { buildProfileCard } from "../ui/profileCard.js";
import type { Command } from "./types.js";

const themeChoices = Object.entries(THEME_LABELS).map(([value, name]) => ({ name, value }));
const cardStyleChoices = Object.entries(CARD_STYLE_LABELS).map(([value, name]) => ({
  name,
  value,
}));
const frameChoices = Object.entries(FRAME_LABELS).map(([value, name]) => ({ name, value }));
const backgroundChoices = Object.entries(BACKGROUND_LABELS).map(([value, name]) => ({
  name,
  value,
}));

export const personalizarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("personalizar")
    .setDescription("Personaliza a identidade e o visual do seu jogador.")
    .addSubcommand((sub) =>
      sub
        .setName("identidade")
        .setDescription("Nome, apelido, número, frase e comemoração.")
        .addStringOption((opt) => opt.setName("nome").setDescription("Novo nome").setMaxLength(40))
        .addStringOption((opt) =>
          opt.setName("apelido").setDescription("Novo apelido").setMaxLength(20),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("numero")
            .setDescription("Novo número da camisa (1 a 99)")
            .setMinValue(1)
            .setMaxValue(99),
        )
        .addStringOption((opt) =>
          opt.setName("frase").setDescription("Frase de perfil").setMaxLength(140),
        )
        .addStringOption((opt) =>
          opt.setName("comemoracao").setDescription("Comemoração de gol").setMaxLength(60),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("visual")
        .setDescription("Cores, tema, moldura e fundo.")
        .addStringOption((opt) =>
          opt.setName("cor-principal").setDescription("Cor principal (#RRGGBB)"),
        )
        .addStringOption((opt) =>
          opt.setName("cor-secundaria").setDescription("Cor secundária (#RRGGBB)"),
        )
        .addStringOption((opt) =>
          opt
            .setName("tema")
            .setDescription("Tema do perfil")
            .addChoices(...themeChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("estilo-carta")
            .setDescription("Estilo visual da carta")
            .addChoices(...cardStyleChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("moldura")
            .setDescription("Moldura do perfil")
            .addChoices(...frameChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("fundo")
            .setDescription("Fundo do perfil")
            .addChoices(...backgroundChoices),
        ),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand(true);
    const discordId = interaction.user.id;

    const patch: RawProfilePatch =
      subcommand === "identidade"
        ? {
            name: interaction.options.getString("nome") ?? undefined,
            nickname: interaction.options.getString("apelido") ?? undefined,
            shirtNumber: interaction.options.getInteger("numero") ?? undefined,
            bio: interaction.options.getString("frase") ?? undefined,
            celebration: interaction.options.getString("comemoracao") ?? undefined,
          }
        : {
            primaryColor: interaction.options.getString("cor-principal") ?? undefined,
            secondaryColor: interaction.options.getString("cor-secundaria") ?? undefined,
            theme: interaction.options.getString("tema") ?? undefined,
            cardStyle: interaction.options.getString("estilo-carta") ?? undefined,
            profileFrame: interaction.options.getString("moldura") ?? undefined,
            profileBackground: interaction.options.getString("fundo") ?? undefined,
          };

    const player = await updatePlayerProfile(
      { userRepository: ctx.userRepository, playerRepository: ctx.playerRepository },
      { requesterDiscordId: discordId, targetDiscordId: discordId, patch },
    );

    const card = buildProfileCard(player, {
      title: "🎨 Perfil atualizado!",
      accentColor: 0x3498db,
    });
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info({ discordId, playerId: player.id, subcommand }, "player profile updated");
  },
};
