const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE = ALPHABET.length

export function base62Encode(num: bigint): string {
  if (num === 0n) return ALPHABET[0]
  let encoded = ''
  while (num > 0n) {
    const rem = num % BigInt(BASE)
    num = num / BigInt(BASE)
    encoded = ALPHABET[Number(rem)] + encoded
  }
  return encoded
}

export function base62Decode(str: string): bigint {
  let num = 0n
  for (const char of str) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`Invalid character '${char}' in base62 string`)
    }
    num = num * BigInt(BASE) + BigInt(index)
  }
  return num
}

export function uuidToBigInt(uuid: string): bigint {
  const hexStr = uuid.replace(/-/g, '')
  return BigInt(`0x${hexStr}`)
}

export function bigIntToUuid(num: bigint): string {
  const hex = num.toString(16).padStart(32, '0')
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  )
}

export function base62EncodeUuid(uuid: string): string {
  const num = uuidToBigInt(uuid)
  return base62Encode(num)
}

export function base62DecodeUuid(base62Str: string): string {
  const num = base62Decode(base62Str)
  return bigIntToUuid(num)
}

// Example usage
//const uuid = "123e4567-e89b-12d3-a456-426614174000";
//const encoded = base62EncodeUuid(uuid);
//const decoded = base62DecodeUuid(encoded);

//console.log("UUID:", uuid);
//console.log("Encoded base62:", encoded);
//console.log("Decoded UUID:", decoded);
