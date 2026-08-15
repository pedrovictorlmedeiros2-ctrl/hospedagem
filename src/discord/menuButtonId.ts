/**
 * Deliberately its own tiny file with zero dependencies: menuActions.ts
 * pulls in every command's render function (carreira.ts, carteira.ts,
 * etc.), and some of THOSE cards (careerCard.ts, careerMatchResultCard.ts)
 * embed menu shortcut buttons — importing the prefix straight from
 * menuActions.ts there would be a real import cycle
 * (card → menuActions → command → card). Both menuActions.ts and every
 * card builder import from here instead, so neither side of that cycle
 * ever exists.
 */
export const MENU_BUTTON_PREFIX = "menu:";

export function menuButtonCustomId(key: string): string {
  return `${MENU_BUTTON_PREFIX}${key}`;
}
