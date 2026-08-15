import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { MENU_ACTION_METADATA } from "../menuActionMetadata.js";
import { menuButtonCustomId } from "../menuButtonId.js";

const BUTTONS_PER_ROW = 4;

/** Chunks a flat list into fixed-size groups — Discord caps an ActionRow at 5 components, so more than 5 buttons needs more than one row. */
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export function buildMenuCard(): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🎮 Menu"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Clica num botão pra ir direto — sem precisar digitar o comando."),
    );

  const panelActions = MENU_ACTION_METADATA.filter((action) => action.key !== "menu");
  for (const row of chunk(panelActions, BUTTONS_PER_ROW)) {
    const buttons = row.map((action) =>
      new ButtonBuilder()
        .setCustomId(menuButtonCustomId(action.key))
        .setLabel(`${action.emoji} ${action.label}`)
        .setStyle(ButtonStyle.Secondary),
    );
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
  }

  return container;
}
