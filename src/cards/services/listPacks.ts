import type { CardPackRecord, CardRepository } from "../ports/cardRepository.js";
import { ensureCatalog } from "./ensureCatalog.js";

export interface ListPacksDeps {
  cardRepository: CardRepository;
}

export interface ListPacksOutput {
  packs: CardPackRecord[];
}

export async function listPacks(deps: ListPacksDeps): Promise<ListPacksOutput> {
  await ensureCatalog(deps.cardRepository);
  const packs = await deps.cardRepository.listActivePacks();
  return { packs };
}
