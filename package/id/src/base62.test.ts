import {
  base62Encode,
  base62Decode,
  hexToBigInt,
  bigIntToHex,
  base62EncodeBsonId,
  base62DecodeBsonId,
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

describe("hex to BigInt conversion", () => {
  test("hexToBigInt should convert hex to BigInt correctly", () => {
    const hex = "507f1f77bcf86cd799439011";
    const expectedBigInt = BigInt("0x507f1f77bcf86cd799439011");
    const result = hexToBigInt(hex);
    expect(result).toBe(expectedBigInt);
  });

  test("bigIntToHex should convert BigInt to hex correctly", () => {
    const bigInt = BigInt("0x507f1f77bcf86cd799439011");
    const expectedHex = "507f1f77bcf86cd799439011";
    const result = bigIntToHex(bigInt, 12);
    expect(result).toBe(expectedHex);
  });

  test("bigIntToHex should pad to the requested byte length", () => {
    const bigInt = BigInt("0x1");
    const result = bigIntToHex(bigInt, 12);
    expect(result).toBe("000000000000000000000001");
  });

  test("hexToBigInt and bigIntToHex should be inverses", () => {
    const hex = "507f1f77bcf86cd799439011";
    const bigInt = hexToBigInt(hex);
    const convertedHex = bigIntToHex(bigInt, 12);
    expect(convertedHex).toBe(hex);
  });
});

describe("BSON id conversion", () => {
  test("base62EncodeBsonId and base62DecodeBsonId should be inverses", () => {
    const bsonId = "507f1f77bcf86cd799439011";
    const encoded = base62EncodeBsonId(bsonId);
    const decoded = base62DecodeBsonId(encoded);
    expect(decoded).toBe(bsonId);
  });
});
