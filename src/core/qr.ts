// Minimal, dependency-free QR encoder for LogTogether invitation URLs.
// Fixed to QR version 6 / error-correction level M (up to 106 UTF-8 bytes),
// which is comfortably above the current invite URL length.

const VERSION = 6;
const SIZE = 17 + VERSION * 4; // 41
const DATA_CODEWORDS = 108;
const BLOCK_COUNT = 4;
const DATA_PER_BLOCK = 27;
const EC_PER_BLOCK = 16;
const FORMAT_G15 = 0x537;
const FORMAT_MASK = 0x5412;

const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < EXP.length; i += 1) EXP[i] = EXP[i - 255]!;
})();

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

function polyMultiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) out[i + j] = out[i + j]! ^ gfMultiply(a[i]!, b[j]!);
  }
  return out;
}

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) poly = polyMultiply(poly, [1, EXP[i]!]);
  return poly;
}

const EC_GENERATOR = rsGenerator(EC_PER_BLOCK);

function rsRemainder(data: number[]): number[] {
  const work = [...data, ...new Array<number>(EC_PER_BLOCK).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = work[i] ?? 0;
    if (!factor) continue;
    for (let j = 0; j < EC_GENERATOR.length; j += 1) work[i + j] = work[i + j]! ^ gfMultiply(EC_GENERATOR[j]!, factor);
  }
  return work.slice(data.length);
}

function appendBits(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function dataCodewords(text: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 106) throw new Error("Invite link is too long to render as an offline QR code.");
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, bytes.length, 8); // versions 1-9 use an 8-bit byte count
  bytes.forEach(byte => appendBits(bits, byte, 8));
  const capacity = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | bits[i + bit]!;
    out.push(byte);
  }
  let pad = 0;
  while (out.length < DATA_CODEWORDS) {
    out.push(pad % 2 === 0 ? 0xec : 0x11);
    pad += 1;
  }
  return out;
}

function interleavedCodewords(text: string): number[] {
  const data = dataCodewords(text);
  const blocks = Array.from({ length: BLOCK_COUNT }, (_, index) => data.slice(index * DATA_PER_BLOCK, (index + 1) * DATA_PER_BLOCK));
  const ec = blocks.map(rsRemainder);
  const out: number[] = [];
  for (let i = 0; i < DATA_PER_BLOCK; i += 1) blocks.forEach(block => out.push(block[i]!));
  for (let i = 0; i < EC_PER_BLOCK; i += 1) ec.forEach(block => out.push(block[i]!));
  return out;
}

function bchDigit(value: number): number {
  let digit = 0;
  for (let v = value; v !== 0; v >>>= 1) digit += 1;
  return digit;
}

function formatBits(data: number): number {
  let value = data << 10;
  while (bchDigit(value) - bchDigit(FORMAT_G15) >= 0) value ^= FORMAT_G15 << (bchDigit(value) - bchDigit(FORMAT_G15));
  return ((data << 10) | value) ^ FORMAT_MASK;
}

function mask0(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

function qrMatrix(text: string): boolean[][] {
  const modules: Array<Array<boolean | null>> = Array.from({ length: SIZE }, () => new Array<boolean | null>(SIZE).fill(null));

  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const dark = (r >= 0 && r <= 6 && (c === 0 || c === 6))
          || (c >= 0 && c <= 6 && (r === 0 || r === 6))
          || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        modules[rr]![cc] = dark;
      }
    }
  };
  finder(0, 0);
  finder(SIZE - 7, 0);
  finder(0, SIZE - 7);

  for (let i = 8; i < SIZE - 8; i += 1) {
    if (modules[i]![6] === null) modules[i]![6] = i % 2 === 0;
    if (modules[6]![i] === null) modules[6]![i] = i % 2 === 0;
  }

  // Version 6 alignment centers are [6, 34]. Only the bottom-right one does
  // not overlap a finder pattern.
  const center = 34;
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const rr = center + r, cc = center + c;
      if (modules[rr]![cc] !== null) continue;
      modules[rr]![cc] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
    }
  }

  // Error correction level M = 0, mask 0 = 0, so format data value is 0.
  const format = formatBits(0);
  for (let i = 0; i < 15; i += 1) {
    const dark = ((format >>> i) & 1) === 1;
    if (i < 6) modules[i]![8] = dark;
    else if (i < 8) modules[i + 1]![8] = dark;
    else modules[SIZE - 15 + i]![8] = dark;

    if (i < 8) modules[8]![SIZE - i - 1] = dark;
    else if (i < 9) modules[8]![15 - i] = dark;
    else modules[8]![15 - i - 1] = dark;
  }
  modules[SIZE - 8]![8] = true;

  const codewords = interleavedCodewords(text);
  let byteIndex = 0, bitIndex = 7, row = SIZE - 1, direction = -1;
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let c = 0; c < 2; c += 1) {
        const targetCol = col - c;
        if (modules[row]![targetCol] !== null) continue;
        let dark = byteIndex < codewords.length ? ((codewords[byteIndex]! >>> bitIndex) & 1) === 1 : false;
        if (mask0(row, targetCol)) dark = !dark;
        modules[row]![targetCol] = dark;
        bitIndex -= 1;
        if (bitIndex < 0) { byteIndex += 1; bitIndex = 7; }
      }
      row += direction;
      if (row < 0 || row >= SIZE) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  return modules.map(rowModules => rowModules.map(value => Boolean(value)));
}

export function qrSvg(text: string): string {
  const modules = qrMatrix(text);
  const quiet = 4;
  const view = SIZE + quiet * 2;
  let path = "";
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  }));
  return `<svg class="invite-qr-svg" viewBox="0 0 ${view} ${view}" role="img" aria-label="QR code"><rect width="${view}" height="${view}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
