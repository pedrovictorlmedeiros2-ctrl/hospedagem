export interface MenuActionMetadata {
  key: string;
  emoji: string;
  label: string;
}

/**
 * Ordering + display metadata for every button-reachable action —
 * deliberately kept separate from menuActions.ts (which pairs each entry
 * with its handler function, importing every single command to do so) so
 * menuCard.ts can build the /menu grid without pulling in the whole
 * command graph. Zero-dependency leaf module, same reasoning as
 * menuButtonId.ts: menuActions.ts → commands/menu.ts → ui/menuCard.ts
 * would otherwise cycle straight back to menuActions.ts the moment the
 * menu action itself (key "menu") got added.
 */
export const MENU_ACTION_METADATA: MenuActionMetadata[] = [
  { key: "menu", emoji: "🏠", label: "Menu" },
  { key: "career", emoji: "📋", label: "Carreira" },
  { key: "play", emoji: "⚽", label: "Jogar partida" },
  { key: "cup", emoji: "🏆", label: "Copa" },
  { key: "standings", emoji: "📊", label: "Classificação" },
  { key: "wallet", emoji: "🪙", label: "Carteira" },
  { key: "collection", emoji: "🗂️", label: "Coleção" },
  { key: "duels", emoji: "⚔️", label: "Duelos" },
  { key: "ranking", emoji: "📊", label: "Ranking" },
  { key: "achievements", emoji: "🏅", label: "Conquistas" },
];
