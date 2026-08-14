import type { ContractStatus, Prisma, PrismaClient, TransferType } from "@prisma/client";
import type {
  ContractRecord,
  CreateContractInput,
  MarketRepository,
  RecordTransferInput,
  TransferRecord,
} from "../ports/marketRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaMarketRepository implements MarketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveContract(playerId: string): Promise<ContractRecord | null> {
    const contract = await this.prisma.contract.findFirst({
      where: { playerId, status: "ACTIVE" },
      orderBy: { startsAt: "desc" },
    });
    return contract ? this.toContractDomain(contract) : null;
  }

  async createContract(input: CreateContractInput): Promise<ContractRecord> {
    const contract = await this.prisma.contract.create({
      data: {
        playerId: input.playerId,
        clubId: input.clubId,
        status: "ACTIVE",
        salary: input.salary,
        releaseClause: input.releaseClause,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });
    return this.toContractDomain(contract);
  }

  async terminateContract(contractId: string): Promise<void> {
    await this.prisma.contract.update({ where: { id: contractId }, data: { status: "TERMINATED" } });
  }

  async recordTransfer(input: RecordTransferInput): Promise<TransferRecord> {
    const transfer = await this.prisma.transfer.create({
      data: {
        playerId: input.playerId,
        fromClubId: input.fromClubId,
        toClubId: input.toClubId,
        seasonId: input.seasonId,
        type: input.type,
        fee: input.fee,
      },
    });
    return this.toTransferDomain(transfer);
  }

  async listRecentTransfers(playerId: string, limit: number): Promise<TransferRecord[]> {
    const rows = await this.prisma.transfer.findMany({
      where: { playerId },
      orderBy: { announcedAt: "desc" },
      take: limit,
    });
    return rows.map((row) => this.toTransferDomain(row));
  }

  private toContractDomain(contract: {
    id: string;
    playerId: string;
    clubId: string;
    status: ContractStatus;
    salary: Prisma.Decimal;
    releaseClause: Prisma.Decimal | null;
    startsAt: Date;
    endsAt: Date;
  }): ContractRecord {
    return {
      id: contract.id,
      playerId: contract.playerId,
      clubId: contract.clubId,
      status: contract.status,
      salary: contract.salary.toNumber(),
      releaseClause: contract.releaseClause?.toNumber() ?? 0,
      startsAt: contract.startsAt,
      endsAt: contract.endsAt,
    };
  }

  private toTransferDomain(transfer: {
    id: string;
    playerId: string;
    fromClubId: string | null;
    toClubId: string;
    seasonId: string;
    type: TransferType;
    fee: Prisma.Decimal;
    announcedAt: Date;
  }): TransferRecord {
    return {
      id: transfer.id,
      playerId: transfer.playerId,
      fromClubId: transfer.fromClubId,
      toClubId: transfer.toClubId,
      seasonId: transfer.seasonId,
      type: transfer.type,
      fee: transfer.fee.toNumber(),
      announcedAt: transfer.announcedAt,
    };
  }
}
