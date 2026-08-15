import { Collection, type RepliableInteraction } from "discord.js";
import { renderCareira } from "./commands/carreira.js";
import { renderCarteira } from "./commands/carteira.js";
import { renderClassificacao } from "./commands/classificacao.js";
import { renderColecao } from "./commands/colecao.js";
import { renderConquistas } from "./commands/conquistas.js";
import { renderDuelos } from "./commands/duelos.js";
import { renderJogarCarreira } from "./commands/jogarCarreira.js";
import { renderRanking } from "./commands/ranking.js";
import type { CommandContext } from "./commands/types.js";

export { MENU_BUTTON_PREFIX, menuButtonCustomId } from "./menuButtonId.js";

export type MenuActionHandler = (interaction: RepliableInteraction, ctx: CommandContext) => Promise<void>;

export interface MenuActionDefinition {
  key: string;
  emoji: string;
  label: string;
  handler: MenuActionHandler;
}

/**
 * The subset of the bot's commands reachable from a button instead of
 * typing a slash command — deliberately only the parameterless ones
 * (see discord/ui/menuCard.ts and README's command table for what's
 * NOT here, e.g. /treinar needs a required "foco" option a button can't
 * supply). Shared by /menu (discord/commands/menu.ts) and any shortcut
 * button embedded in another card (e.g. careerCard.ts, careerMatchResultCard.ts).
 */
export const MENU_ACTION_DEFINITIONS: MenuActionDefinition[] = [
  { key: "career", emoji: "📋", label: "Carreira", handler: renderCareira },
  { key: "play", emoji: "⚽", label: "Jogar partida", handler: renderJogarCarreira },
  { key: "standings", emoji: "🏆", label: "Classificação", handler: renderClassificacao },
  { key: "wallet", emoji: "🪙", label: "Carteira", handler: renderCarteira },
  { key: "collection", emoji: "🗂️", label: "Coleção", handler: renderColecao },
  { key: "duels", emoji: "⚔️", label: "Duelos", handler: renderDuelos },
  { key: "ranking", emoji: "📊", label: "Ranking", handler: (interaction, ctx) => renderRanking(interaction, ctx) },
  { key: "achievements", emoji: "🏅", label: "Conquistas", handler: renderConquistas },
];

export function buildMenuActionRegistry(): Collection<string, MenuActionDefinition> {
  const actions = new Collection<string, MenuActionDefinition>();
  for (const action of MENU_ACTION_DEFINITIONS) {
    actions.set(action.key, action);
  }
  return actions;
}
