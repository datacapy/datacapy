// Generate v7 uuid
export function genUuid(): string {
  const timestamp = BigInt(Date.now());
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = crypto.getRandomValues(new Uint8Array(16))
    .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');

  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    '7' + randomHex.slice(0, 3),
    (8 + (Math.random() * 4 | 0)).toString(16) + randomHex.slice(3, 6),
    randomHex.slice(6, 18)
  ].join('-');
}