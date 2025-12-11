import { genUuid } from './uuid'

describe('genUuid', () => {
  it('should generate a valid UUID v7', () => {
    const uuid = genUuid()
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('should generate unique UUIDs', () => {
    const uuid1 = genUuid()
    const uuid2 = genUuid()
    expect(uuid1).not.toEqual(uuid2)
  })

  it('should include a timestamp component', () => {
    const before = Date.now()
    const uuid = genUuid()
    const after = Date.now()

    const timestampHex = uuid.split('-')[0] + uuid.split('-')[1]
    const timestamp = parseInt(timestampHex, 16)

    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('should generate UUIDs in chronological order', () => {
    const uuid1 = genUuid()
    // Ensure some time passes between generations
    jest.advanceTimersByTime(1)
    const uuid2 = genUuid()

    const timestamp1Hex = uuid1.replace(/-/g, '').slice(0, 12)
    const timestamp2Hex = uuid2.replace(/-/g, '').slice(0, 12)

    const timestamp1 = parseInt(timestamp1Hex, 16)
    const timestamp2 = parseInt(timestamp2Hex, 16)

    expect(timestamp2).toBeGreaterThan(timestamp1)
  })

  it('should generate UUIDs that are sortable by creation time', () => {
    jest.useFakeTimers()

    const uuids = []
    for (let i = 0; i < 5; i++) {
      uuids.push(genUuid())
      jest.advanceTimersByTime(1000) // Advance time by 1 second
    }

    // Sort the UUIDs as strings
    const sortedUuids = [...uuids].sort()

    // Verify that the sorted UUIDs are in the same order as they were generated
    expect(sortedUuids).toEqual(uuids)

    jest.useRealTimers()
  })
})
