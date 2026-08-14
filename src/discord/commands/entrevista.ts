import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { answerInterviewQuestion } from "../../narrative/services/answerInterviewQuestion.js";
import type { Command } from "./types.js";

export const entrevistaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("entrevista")
    .setDescription("Faz uma pergunta de entrevista pro seu jogador responder.")
    .addStringOption((opt) =>
      opt.setName("pergunta").setDescription("O que o repórter quer saber").setRequired(true).setMaxLength(300),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const question = interaction.options.getString("pergunta", true);

    const { answer } = await answerInterviewQuestion(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        matchRepository: ctx.matchRepository,
        narrativeGenerator: ctx.narrativeGenerator,
      },
      { discordId: interaction.user.id, question },
    );

    const card = new ContainerBuilder()
      .setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🎤 Entrevista"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(answer));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
