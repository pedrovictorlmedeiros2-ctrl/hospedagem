/**
 * The state set the product spec requires the game AI to move through.
 * Attack decisions land on ATTACKING/MOVING/DRIBBLING/PASSING/SHOOTING;
 * defense reactions land on DEFENDING/PRESSING/RECOVERING; IDLE is the
 * kickoff/dead-ball resting state. See decide.ts for the perception →
 * context → decision → action pipeline that produces these.
 */
export type AIState =
  | "IDLE"
  | "MOVING"
  | "ATTACKING"
  | "DEFENDING"
  | "PRESSING"
  | "DRIBBLING"
  | "PASSING"
  | "SHOOTING"
  | "RECOVERING";
