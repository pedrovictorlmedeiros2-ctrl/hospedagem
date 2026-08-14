import type {
  ContractRecord,
  CreateContractInput,
  MarketRepository,
  RecordTransferInput,
  TransferRecord,
} from "../ports/marketRepository.js";

/** Test double mirroring PrismaMarketRepository's contract. */
export class InMemoryMarketRepository implements MarketRepository {
  private readonly contracts = new Map<string, ContractRecord>();
  private readonly transfersByPlayerId = new Map<string, TransferRecord[]>();
  private nextId = 1;

  async getActiveContract(playerId: string): Promise<ContractRecord | null> {
    for (const contract of this.contracts.values()) {
      if (contract.playerId === playerId && contract.status === "ACTIVE") {
        return { ...contract };
      }
    }
    return null;
  }

  async createContract(input: CreateContractInput): Promise<ContractRecord> {
    const contract: ContractRecord = {
      id: `contract-${this.nextId++}`,
      playerId: input.playerId,
      clubId: input.clubId,
      status: "ACTIVE",
      salary: input.salary,
      releaseClause: input.releaseClause,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    };
    this.contracts.set(contract.id, contract);
    return { ...contract };
  }

  async terminateContract(contractId: string): Promise<void> {
    const contract = this.contracts.get(contractId);
    if (contract) {
      contract.status = "TERMINATED";
    }
  }

  async recordTransfer(input: RecordTransferInput): Promise<TransferRecord> {
    const transfer: TransferRecord = {
      id: `transfer-${this.nextId++}`,
      playerId: input.playerId,
      fromClubId: input.fromClubId,
      toClubId: input.toClubId,
      seasonId: input.seasonId,
      type: input.type,
      fee: input.fee,
      announcedAt: new Date(),
    };
    const list = this.transfersByPlayerId.get(input.playerId) ?? [];
    list.unshift(transfer);
    this.transfersByPlayerId.set(input.playerId, list);
    return { ...transfer };
  }

  async listRecentTransfers(playerId: string, limit: number): Promise<TransferRecord[]> {
    return (this.transfersByPlayerId.get(playerId) ?? []).slice(0, limit);
  }
}
