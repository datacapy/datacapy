import { genBsonId } from "./bsonId";

describe("genBsonId", () => {
  it("should generate a valid 24 character hex string", () => {
    const bsonId = genBsonId();
    expect(bsonId).toMatch(/^[0-9a-f]{24}$/i);
  });

  it("should generate unique ids", () => {
    const bsonId1 = genBsonId();
    const bsonId2 = genBsonId();
    expect(bsonId1).not.toEqual(bsonId2);
  });

  it("should include a timestamp component", () => {
    const before = Date.now();
    const bsonId = genBsonId();
    const after = Date.now();

    const timestampHex = bsonId.slice(0, 12);
    const timestamp = parseInt(timestampHex, 16);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("should generate ids that are sortable by creation time", () => {
    jest.useFakeTimers();

    const bsonIds = [];
    for (let i = 0; i < 5; i++) {
      bsonIds.push(genBsonId());
      jest.advanceTimersByTime(1000);
    }

    const sortedBsonIds = [...bsonIds].sort();

    expect(sortedBsonIds).toEqual(bsonIds);

    jest.useRealTimers();
  });
});
