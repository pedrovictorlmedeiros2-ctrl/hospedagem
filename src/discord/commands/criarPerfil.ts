import type { PlayStyle, Position, PreferredFoot } from "@prisma/client";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { FOOT_LABELS, PLAYSTYLE_LABELS, POSITION_LABELS } from "../../player/domain/labels.js";
import { createPlayerProfile } from "../../player/services/createPlayerProfile.js";
import { buildProfileCard } from "../ui/profileCard.js";
import type { Command } from "./types.js";

const positionChoices = Object.entries(POSITION_LABELS).map(([value, name]) => ({ name, value }));
const footChoices = Object.entries(FOOT_LABELS).map(([value, name]) => ({ name, value }));
const playStyleChoices = Object.entries(PLAYSTYLE_LABELS).map(([value, name]) => ({ name, value }));

export const criarPerfilCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("criar-perfil")
    .setDescription("Cria o seu jogador no Football Game.")
    .addStringOption((opt) =>
      opt.setName("nome").setDescription("Nome do jogador").setRequired(true).setMaxLength(40),
    )
    .addStringOption((opt) =>
      opt
        .setName("apelido")
        .setDescription("Apelido exibido nas partidas")
        .setRequired(true)
        .setMaxLength(20),
    )
    .addStringOption((opt) =>
      opt
        .setName("nacionalidade")
        .setDescription("Código do país (ex.: BR, AR, PT)")
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(2),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("idade")
        .setDescription("Idade (15 a 45)")
        .setRequired(true)
        .setMinValue(15)
        .setMaxValue(45),
    )
    .addStringOption((opt) =>
      opt
        .setName("posicao")
        .setDescription("Posição em campo")
        .setRequired(true)
        .addChoices(...positionChoices),
    )
    .addStringOption((opt) =>
      opt
        .setName("pe")
        .setDescription("Pé dominante")
        .setRequired(true)
        .addChoices(...footChoices),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("altura")
        .setDescription("Altura em cm (140 a 210)")
        .setRequired(true)
        .setMinValue(140)
        .setMaxValue(210),
    )
    .addStringOption((opt) =>
      opt
        .setName("estilo")
        .setDescription("Estilo de jogo")
        .setRequired(true)
        .addChoices(...playStyleChoices),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("numero")
        .setDescription("Número da camisa (1 a 99)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(99),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const player = await createPlayerProfile(
      { userRepository: ctx.userRepository, playerRepository: ctx.playerRepository },
      {
        discordId: interaction.user.id,
        name: interaction.options.getString("nome", true),
        nickname: interaction.options.getString("apelido", true),
        nationality: interaction.options.getString("nacionalidade", true).toUpperCase(),
        age: interaction.options.getInteger("idade", true),
        position: interaction.options.getString("posicao", true) as Position,
        preferredFoot: interaction.options.getString("pe", true) as PreferredFoot,
        heightCm: interaction.options.getInteger("altura", true),
        playStyle: interaction.options.getString("estilo", true) as PlayStyle,
        shirtNumber: interaction.options.getInteger("numero"),
      },
    );

    const card = buildProfileCard(player, { title: "✅ Perfil criado!", accentColor: 0x2ecc71 });
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      { discordId: interaction.user.id, playerId: player.id },
      "player profile created",
    );
  },
};
