import type { ContractStatus, TransferType } from "@prisma/client";

export interface ContractRecord {
  id: string;
  playerId: string;
  clubId: string;
  status: ContractStatus;
  /** Coins paid per match played — see economy/domain/contract.ts. */
  salary: number;
  releaseClause: number;
  startsAt: Date;
  endsAt: Date;
}

export interface CreateContractInput {
  playerId: string;
  clubId: string;
  salary: number;
  releaseClause: number;
  startsAt: Date;
  endsAt: Date;
}

export interface TransferRecord {
  id: string;
  playerId: string;
  fromClubId: string | null;
  toClubId: string;
  seasonId: string;
  type: TransferType;
  fee: number;
  announcedAt: Date;
}

export interface RecordTransferInput {
  playerId: string;
  fromClubId: string | null;
  toClubId: string;
  seasonId: string;
  type: TransferType;
  fee: number;
}

/**
 * Contracts and transfers together — both are "the market" side of the
 * economy, as opposed to WalletRepository's pure coin ledger. Kept as one
 * cohesive port rather than two, same reasoning as CareerRepository
 * bundling season/club/team/roster (see career/ports/careerRepository.ts).
 */
export interface MarketRepository {
  /** Only ever returns a contract whose status is ACTIVE — a terminated/expired one is not "the" active contract anymore. */
  getActiveContract(playerId: string): Promise<ContractRecord | null>;
  createContract(input: CreateContractInput): Promise<ContractRecord>;
  terminateContract(contractId: string): Promise<void>;
  recordTransfer(input: RecordTransferInput): Promise<TransferRecord>;
  /** Newest first. */
  listRecentTransfers(playerId: string, limit: number): Promise<TransferRecord[]>;
}
