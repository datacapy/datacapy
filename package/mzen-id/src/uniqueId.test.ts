import { genUniqueId } from "./uniqueId";

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
