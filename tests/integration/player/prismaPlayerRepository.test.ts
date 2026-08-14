import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaUserRepository } from "../../../src/identity/adapters/prismaUserRepository.js";
import { calculateInitialAttributes, calculateOverall } from "../../../src/player/domain/attributes.js";
import { PrismaPlayerRepository } from "../../../src/player/adapters/prismaPlayerRepository.js";

/**
 * This suite is honest about what it is: it only runs against a real,
 * reachable Postgres database (DATABASE_URL pointing at one with the
 * schema already migrated). No such database was available in the
 * environment these tests were written in — `npm test` here SKIPS this
 * file rather than faking a pass. See docs/ROADMAP.md.
 *
 * To actually run it: provide a real DATABASE_URL, run
 * `npx prisma migrate deploy`, then `npm test`.
 */
async function isDatabaseReachable(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

const reachable = await isDatabaseReachable(process.env["DATABASE_URL"]);

if (!reachable) {
  console.warn(
    "[integration] DATABASE_URL not set or unreachable — PrismaPlayerRepository integration tests were SKIPPED, not run. This is not the same as passing.",
  );
}

describe.skipIf(!reachable)("PrismaPlayerRepository (integration)", () => {
  const prisma = new PrismaClient();
  const userRepository = new PrismaUserRepository(prisma);
  const playerRepository = new PrismaPlayerRepository(prisma);
  const discordId = `integration-test-${Date.now()}`;

  afterAll(async () => {
    await prisma.player.deleteMany({ where: { user: { discordId } } });
    await prisma.user.deleteMany({ where: { discordId } });
    await prisma.$disconnect();
  });

  it("creates, finds and updates a player profile round-trip", async () => {
    const user = await userRepository.ensureUserForDiscordId(discordId);

    const attributes = calculateInitialAttributes("ST");
    const created = await playerRepository.create({
      userId: user.id,
      name: "Integration Test Player",
      nickname: "IntTest",
      nationality: "BR",
      birthDate: new Date("2000-01-01"),
      position: "ST",
      preferredFoot: "RIGHT",
      heightCm: 180,
      playStyle: "POACHER",
      shirtNumber: 77,
      ...attributes,
      overall: calculateOverall("ST", attributes),
    });

    expect(created.id).toBeTruthy();
    expect(created.overall).toBe(50);

    const found = await playerRepository.findByUserId(user.id);
    expect(found?.nickname).toBe("IntTest");

    const updated = await playerRepository.update(user.id, { nickname: "Updated" });
    expect(updated.nickname).toBe("Updated");
  });

  it("rejects a second profile for the same user via the DB unique constraint", async () => {
    const user = await userRepository.ensureUserForDiscordId(discordId);
    const attributes = calculateInitialAttributes("GK");

    await expect(
      playerRepository.create({
        userId: user.id,
        name: "Duplicate",
        nickname: "Dup",
        nationality: "BR",
        birthDate: new Date("2000-01-01"),
        position: "GK",
        preferredFoot: "RIGHT",
        heightCm: 190,
        playStyle: "SHOT_STOPPER",
        shirtNumber: 1,
        ...attributes,
        overall: calculateOverall("GK", attributes),
      }),
    ).rejects.toThrow();
  });
});
