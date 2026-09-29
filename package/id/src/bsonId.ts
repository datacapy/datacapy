// Generate a 12-byte (24 hex char) value compatible with a BSON ObjectId hex string
export function genBsonId(): string {
  const timestamp = BigInt(Date.now());
  const timestampHex = timestamp.toString(16).padStart(12, "0");
  const randomHex = globalThis.crypto
    .getRandomValues(new Uint8Array(6))
    .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "");

  return timestampHex + randomHex;
}
