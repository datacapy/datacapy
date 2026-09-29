const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;

export function base62Encode(num: bigint): string {
  if (num === 0n) return ALPHABET[0];
  let encoded = "";
  while (num > 0n) {
    const rem = num % BigInt(BASE);
    num = num / BigInt(BASE);
    encoded = ALPHABET[Number(rem)] + encoded;
  }
  return encoded;
}

export function base62Decode(str: string): bigint {
  let num = 0n;
  for (const char of str) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid character '${char}' in base62 string`);
    }
    num = num * BigInt(BASE) + BigInt(index);
  }
  return num;
}

export function hexToBigInt(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

export function bigIntToHex(num: bigint, byteLength: number): string {
  return num.toString(16).padStart(byteLength * 2, "0");
}

export function base62EncodeBsonId(bsonId: string): string {
  return base62Encode(hexToBigInt(bsonId));
}

export function base62DecodeBsonId(base62Str: string): string {
  return bigIntToHex(base62Decode(base62Str), 12);
}
