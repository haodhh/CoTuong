export interface EngineRequest {
  id: number;
  /** Start position and the moves played since, so repetitions are known. */
  fen: string;
  moves: string[];
  depth?: number;
  timeMs?: number;
  /** Pick a move at random, weighted by exp(score / temperature), among all root moves. */
  temperature?: number;
  /** Stream intermediate results (analysis). */
  info?: boolean;
}

export interface EngineInfo {
  depth: number;
  /** Score in centipawns from the side to move's point of view. */
  score: number;
  /** Moves until mate (positive: side to move mates), when the score is a mate. */
  mate?: number;
  pv: string[];
  nodes: number;
  timeMs: number;
}

export type EngineResponse =
  | ({ id: number; type: 'info' } & EngineInfo)
  | ({ id: number; type: 'done'; move: string | null } & EngineInfo);
