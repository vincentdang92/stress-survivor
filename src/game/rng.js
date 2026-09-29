/** Seeded RNG — Mulberry32 algorithm */
export function createRNG(seed) {
  let s = seed >>> 0;
  return {
    next() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
    range(min, max) { return min + this.next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(arr) { return arr[this.int(0, arr.length - 1)]; },
    bool(p = 0.5) { return this.next() < p; }
  };
}

export function randomSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}
