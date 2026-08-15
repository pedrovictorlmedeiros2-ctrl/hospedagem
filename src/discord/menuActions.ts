import { Collection, type RepliableInteraction } from "discord.js";
import { renderCareira } from "./commands/carreira.js";
import { renderCarteira } from "./commands/carteira.js";
import { renderClassificacao } from "./commands/classificacao.js";
import { renderColecao } from "./commands/colecao.js";
import { renderConquistas } from "./commands/conquistas.js";
import { renderCopa } from "./commands/copa.js";
import { renderDuelos } from "./commands/duelos.js";
import { renderJogarCarreira } from "./commands/jogarCarreira.js";
import { renderMenu } from "./commands/menu.js";
import { renderRanking } from "./commands/ranking.js";
import type { CommandContext } from "./commands/types.js";
import { MENU_ACTION_METADATA } from "./menuActionMetadata.js";

export { MENU_BUTTON_PREFIX, menuButtonCustomId } from "./menuButtonId.js";

export type MenuActionHandler = (interaction: RepliableInteraction, ctx: CommandContext) => Promise<void>;

export interface MenuActionDefinition {
  key: string;
  emoji: string;
  label: string;
  handler: MenuActionHandler;
}

/** Every key in MENU_ACTION_METADATA must have exactly one handler here — see the build-time check right below this. */
const HANDLERS: Record<string, MenuActionHandler> = {
  menu: renderMenu,
  career: renderCareira,
  play: renderJogarCarreira,
  cup: renderCopa,
  standings: renderClassificacao,
  wallet: renderCarteira,
  collection: renderColecao,
  duels: renderDuelos,
  ranking: (interaction, ctx) => renderRanking(interaction, ctx),
  achievements: renderConquistas,
};

/**
 * The subset of the bot's commands reachable from a button instead of
 * typing a slash command — deliberately only the parameterless ones
 * (see discord/ui/menuCard.ts and README's command table for what's
 * NOT here, e.g. /treinar needs a required "foco" option a button can't
 * supply). Shared by /menu (discord/commands/menu.ts) and any shortcut
 * button embedded in another card (e.g. careerCard.ts, careerMatchResultCard.ts).
 *
 * Built from MENU_ACTION_METADATA (key/emoji/label only) plus HANDLERS
 * above, rather than declared as one literal list here — menuCard.ts
 * needs the display metadata to build the /menu grid, but must NOT
 * import this file to get it: this file imports every single command
 * (that's the whole point), and commands/menu.ts imports menuCard.ts, so
 * menuCard.ts importing back from here would be a real circular import
 * (menuActions → commands/menu → ui/menuCard → menuActions), not just a
 * type-level one — `tsc` stays quiet about it, but Node's ESM loader can
 * hand one side of the cycle a still-empty module. See menuActionMetadata.ts.
 */
export const MENU_ACTION_DEFINITIONS: MenuActionDefinition[] = MENU_ACTION_METADATA.map((meta) => {
  const handler = HANDLERS[meta.key];
  if (!handler) {
    throw new Error(`Internal error: no handler registered in menuActions.ts for menu action "${meta.key}"`);
  }
  return { ...meta, handler };
});

export function buildMenuActionRegistry(): Collection<string, MenuActionDefinition> {
  const actions = new Collection<string, MenuActionDefinition>();
  for (const action of MENU_ACTION_DEFINITIONS) {
    actions.set(action.key, action);
  }
  return actions;
}
