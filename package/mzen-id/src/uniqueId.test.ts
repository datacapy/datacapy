import { genUniqueId, uniqueIdToBsonId, bsonIdToUniqueId } from "./uniqueId";

describe("genUniqueId", () => {
  it("should generate unique IDs on multiple calls", () => {
    const uniqueIds = new Set<string>();
    const numberOfIds = 100; // Number of IDs to generate for the test

    for (let i = 0; i < numberOfIds; i++) {
      const id = genUniqueId();
      expect(uniqueIds.has(id)).toBe(false); // Ensure the ID is not already in the set
      uniqueIds.add(id);
    }

    expect(uniqueIds.size).toBe(numberOfIds); // Ensure all generated IDs are unique
  });

  it("should generate unique IDs that are sortable by creation time", () => {
    jest.useFakeTimers();

    const uniqueIds = [];
    for (let i = 0; i < 5; i++) {
      uniqueIds.push(genUniqueId());
      jest.advanceTimersByTime(100);
    }

    // Sort the unique IDs as strings
    const sortedUniqueIds = [...uniqueIds].sort();

    // Verify that the sorted unique IDs are in the same order as they were generated
    expect(sortedUniqueIds).toEqual(uniqueIds);

    jest.useRealTimers();
  });
});

describe("uniqueId / bsonId conversion", () => {
  it("should convert a uniqueId to a 24 character bsonId hex string", () => {
    const uniqueId = genUniqueId();
    const bsonId = uniqueIdToBsonId(uniqueId);
    expect(bsonId).toMatch(/^[0-9a-f]{24}$/i);
  });

  it("should round-trip uniqueId -> bsonId -> uniqueId", () => {
    const uniqueId = genUniqueId();
    const bsonId = uniqueIdToBsonId(uniqueId);
    expect(bsonIdToUniqueId(bsonId)).toBe(uniqueId);
  });

  it("should round-trip bsonId -> uniqueId -> bsonId", () => {
    const bsonId = "507f1f77bcf86cd799439011";
    const uniqueId = bsonIdToUniqueId(bsonId);
    expect(uniqueIdToBsonId(uniqueId)).toBe(bsonId);
  });
});
