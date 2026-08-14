import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { WalletRepository, WalletTransactionRecord } from "../ports/walletRepository.js";

export interface ViewWalletDeps {
  userRepository: UserRepository;
  walletRepository: WalletRepository;
}

export interface ViewWalletInput {
  discordId: string;
}

export interface ViewWalletOutput {
  coins: bigint;
  tokens: bigint;
  recentTransactions: WalletTransactionRecord[];
}

const RECENT_TRANSACTIONS_LIMIT = 10;

export async function viewWallet(deps: ViewWalletDeps, input: ViewWalletInput): Promise<ViewWalletOutput> {
  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const wallet = await deps.walletRepository.getOrCreateWallet(user.id);
  const recentTransactions = await deps.walletRepository.listRecentTransactions(user.id, RECENT_TRANSACTIONS_LIMIT);

  return { coins: wallet.coins, tokens: wallet.tokens, recentTransactions };
}
