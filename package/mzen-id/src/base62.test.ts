import {
  base62Encode,
  base62Decode,
  uuidToBigInt,
  bigIntToUuid,
  base62EncodeUuid,
  base62DecodeUuid,
} from "./base62";

describe("base62 encoding and decoding", () => {
  test("base62Encode and base62Decode should be inverses", () => {
    const num = 123456789n;
    const encoded = base62Encode(num);
    const decoded = base62Decode(encoded);
    expect(decoded).toBe(num);
  });

  test("base62Encode should handle zero", () => {
    const num = 0n;
    const encoded = base62Encode(num);
    expect(encoded).toBe("0");
  });

  test("base62Decode should throw error on invalid character", () => {
    expect(() => base62Decode("!")).toThrow("Invalid character");
  });
});

describe("UUID to BigInt conversion", () => {
  test("uuidToBigInt should convert UUID to BigInt correctly", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const expectedBigInt = BigInt("0x123e4567e89b12d3a456426614174000");
    const result = uuidToBigInt(uuid);
    expect(result).toBe(expectedBigInt);
  });

  test("bigIntToUuid should convert BigInt to UUID correctly", () => {
    const bigInt = BigInt("0x123e4567e89b12d3a456426614174000");
    const expectedUuid = "123e4567-e89b-12d3-a456-426614174000";
    const result = bigIntToUuid(bigInt);
    expect(result).toBe(expectedUuid);
  });

  test("uuidToBigInt and bigIntToUuid should be inverses", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const bigInt = uuidToBigInt(uuid);
    const convertedUuid = bigIntToUuid(bigInt);
    expect(convertedUuid).toBe(uuid);
  });
});

describe("UUID conversion", () => {
  test("encodeUuid and decodeUuid should be inverses", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const encoded = base62EncodeUuid(uuid);
    const decoded = base62DecodeUuid(encoded);
    expect(decoded).toBe(uuid);
  });
});
