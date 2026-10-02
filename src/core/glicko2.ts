// Glicko-2 rating system (Glickman, 2012), one game per rating period.
// Puzzles are treated as opponents with a fixed rating and deviation.

export interface Glicko {
  rating: number;
  rd: number;
  vol: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;
export const MIN_RD = 45;
export const MAX_RD = 350;
export const PROVISIONAL_RD = 110;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Deviation grows while a player is inactive: one rating period per day. */
export function decayRd(player: Glicko, days: number): Glicko {
  if (days <= 0) return player;
  const phi = player.rd / SCALE;
  const grown = Math.sqrt(phi * phi + days * player.vol * player.vol) * SCALE;
  return { ...player, rd: Math.min(MAX_RD, grown) };
}

/** Updates `player` after one game against `opponent`; score is 1 for a win and 0 for a loss. */
export function updateGlicko(player: Glicko, opponent: { rating: number; rd: number }, score: number): Glicko {
  return updateGlickoPeriod(player, [{ ...opponent, score }]);
}

/** Updates `player` after a rating period containing `games`. */
export function updateGlickoPeriod(
  player: Glicko,
  games: { rating: number; rd: number; score: number }[],
): Glicko {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.vol;

  let vInv = 0;
  let sum = 0;
  for (const game of games) {
    const muJ = (game.rating - 1500) / SCALE;
    const gJ = g(game.rd / SCALE);
    const e = expected(mu, muJ, game.rd / SCALE);
    vInv += gJ * gJ * e * (1 - e);
    sum += gJ * (game.score - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;

  // Volatility update (Illinois algorithm, step 5 of the paper).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPSILON; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * sum;

  return {
    rating: newMu * SCALE + 1500,
    rd: Math.min(MAX_RD, Math.max(MIN_RD, newPhi * SCALE)),
    vol: newSigma,
  };
}

export const isProvisional = (p: Glicko) => p.rd > PROVISIONAL_RD;
