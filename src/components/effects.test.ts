import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });

describe('effects', () => {
  // React calls whatever an effect returns as its cleanup. An expression body such as
  // `useEffect(() => window.scrollTo(0, 0))` returns the call's result, which browsers may change
  // (Chrome 150 made scrollTo return a Promise), and leaving the page then throws.
  it('return nothing or a cleanup function', () => {
    const bad = files('src').flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/use(?:Layout)?Effect\(\s*\(\)\s*=>\s*(?![{\s]|\(\)\s*=>)/g)].map(
        (m) => `${f}:${readFileSync(f, 'utf8').slice(0, m.index).split('\n').length}`,
      ),
    );
    expect(bad).toEqual([]);
  });
});
