/** ISO 3166-1 alpha-2 → flag emoji via the standard regional-indicator codepoint offset (0x1F1E6 - 'A'.charCodeAt(0)). */
export function countryCodeToFlagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}
