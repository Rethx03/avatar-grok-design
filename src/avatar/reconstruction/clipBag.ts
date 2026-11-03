import { createSeededRandom } from "./math";

const swap = <T>(values: T[], left: number, right: number): void => {
  const value = values[left];
  const other = values[right];
  if (value === undefined || other === undefined) return;
  values[left] = other;
  values[right] = value;
};

/**
 * Produces a shuffle bag so clips do not reveal an easy-to-follow cycle. The
 * first draw also avoids immediately replaying the previous clip.
 */
export class ClipBag {
  readonly #random: () => number;
  #queue: string[] = [];
  #source: readonly string[] = [];
  #previous: string | null = null;

  constructor(seed: number) {
    this.#random = createSeededRandom(seed);
  }

  reset(source: readonly string[]): void {
    this.#source = [...source];
    this.#queue = [];
  }

  next(): string | undefined {
    if (this.#source.length === 0) return undefined;
    if (this.#queue.length === 0) {
      const shuffled = [...this.#source];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        swap(
          shuffled,
          index,
          Math.floor(this.#random() * (index + 1)),
        );
      }

      const alternateIndex = shuffled.findIndex(
        (clip) => clip !== this.#previous,
      );
      if (alternateIndex > 0) swap(shuffled, 0, alternateIndex);
      this.#queue = shuffled;
    }

    const clip = this.#queue.shift();
    this.#previous = clip ?? null;
    return clip;
  }
}
