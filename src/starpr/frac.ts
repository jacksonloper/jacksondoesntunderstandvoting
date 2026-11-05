// Tiny exact rational type backed by BigInt.
//
// BetterVoting's STAR-PR tabulator does all of its arithmetic with
// fraction.js so that "is this ballot exactly on the split point?" checks are
// exact. Floats would break those equality checks, so the port uses exact
// fractions too.

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a
}

export class Frac {
  readonly n: bigint
  readonly d: bigint

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n)
    let dd = BigInt(d)
    if (dd === 0n) throw new Error('Frac: division by zero')
    if (dd < 0n) {
      nn = -nn
      dd = -dd
    }
    const g = gcd(nn, dd) || 1n
    this.n = nn / g
    this.d = dd / g
  }

  static readonly ZERO = new Frac(0)
  static readonly ONE = new Frac(1)

  add(o: Frac) {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d)
  }
  sub(o: Frac) {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d)
  }
  mul(o: Frac | number) {
    const f = typeof o === 'number' ? new Frac(o) : o
    return new Frac(this.n * f.n, this.d * f.d)
  }
  div(o: Frac | number) {
    const f = typeof o === 'number' ? new Frac(o) : o
    return new Frac(this.n * f.d, this.d * f.n)
  }
  /** -1, 0 or 1 */
  compare(o: Frac | number) {
    const f = typeof o === 'number' ? new Frac(o) : o
    const l = this.n * f.d
    const r = f.n * this.d
    return l < r ? -1 : l > r ? 1 : 0
  }
  equals(o: Frac | number) {
    return this.compare(o) === 0
  }
  valueOf() {
    return Number(this.n) / Number(this.d)
  }
  toNumber() {
    return this.valueOf()
  }
  toString() {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`
  }
}
