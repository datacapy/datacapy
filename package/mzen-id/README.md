<!-- cspell:ignore bson -->

# mzen-id

Short, time-ordered string IDs for relational databases.

`mzen-id` generates a 12-byte value (the same size as a MongoDB ObjectId) and
encodes it in Base62, so the ID is 15 alphanumeric characters instead of 24 hex
characters. It has no runtime dependencies.

```ts
import genUniqueId from 'mzen-id'

genUniqueId() // 'ecrDWdCQCiXSrf6'
```

## Why

- **Compact.** 15 characters against 24 for hex, and against 36 for a UUID.
- **URL and index friendly.** Only `0-9`, `A-Z` and `a-z`. No hyphens, no
  escaping.
- **Roughly time-ordered.** New IDs sort after older ones, which keeps B-tree
  primary keys append-mostly.
- **Lossless conversion to and from a 24-character hex ObjectId-style string**,
  so data can move between the two forms.

## Requirements

- BigInt support (ES2020).
- `globalThis.crypto.getRandomValues`: Node 19 or later, or any current browser.

## Usage

```ts
import genUniqueId, { uniqueIdToBsonId, bsonIdToUniqueId } from 'mzen-id'

const id = genUniqueId() // 'ecrDWdCQCiXSrf6'

uniqueIdToBsonId('ecrDWdCQCiXSrf6') // '01a0c50600995e64661d1978'
bsonIdToUniqueId('01a0c50600995e64661d1978') // 'ecrDWdCQCiXSrf6'
```

The default export is `genUniqueId`, so `import { genUniqueId } from 'mzen-id'`
is equivalent.

## API

| Export                           | Description                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `genUniqueId()` (default export) | New Base62 ID                                                                  |
| `genBsonId()`                    | New 24-character lowercase hex string, before Base62 encoding                  |
| `uniqueIdToBsonId(id)`           | Base62 ID to 24-character hex string                                           |
| `bsonIdToUniqueId(hex)`          | 24-character hex string to Base62 ID                                           |
| `base62Encode(n: bigint)`        | Encode a non-negative BigInt                                                   |
| `base62Decode(s)`                | Decode a Base62 string to a BigInt. Throws on a character outside the alphabet |
| `base62EncodeBsonId(hex)`        | Hex string to Base62, same as `bsonIdToUniqueId`                               |
| `base62DecodeBsonId(s)`          | Base62 to a 24-character hex string, same as `uniqueIdToBsonId`                |
| `hexToBigInt(hex)`               | Hex string to BigInt                                                           |
| `bigIntToHex(n, byteLength)`     | BigInt to hex, left-padded to `byteLength` bytes                               |

### Encoding a BigInt

The alphabet is
`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`, in that order.

```ts
import { base62Encode, base62Decode } from 'mzen-id'

base62Encode(0n) // '0'
base62Encode(61n) // 'z'
base62Encode(62n) // '10'
base62Decode('10') // 62n
base62Decode('a-b') // throws: Invalid character '-' in base62 string
```

## ID structure

An ID is 12 bytes, encoded as Base62:

| Bytes | Content                                                                |
| ----- | ---------------------------------------------------------------------- |
| 0-5   | Creation time, milliseconds since the Unix epoch (48 bits, big-endian) |
| 6-11  | 48 random bits from `crypto.getRandomValues`                           |

Consequences:

- **Length.** IDs are 15 characters today. They become 16 characters in
  July 2056.
- **Ordering.** The alphabet is in ASCII order and the timestamp is in the high
  bits, so IDs of equal length sort lexicographically by creation time. IDs
  generated within the same millisecond sort in random order relative to each
  other. There is no counter, so ordering within a millisecond is not
  guaranteed.
- **Uniqueness.** Two IDs collide only if they share a millisecond and all 48
  random bits. That is negligible for ordinary write rates, but the library does
  not check for it. Keep a unique index on the column.
- **Not an ObjectId.** The size and hex representation match, but the layout
  does not. An ObjectId uses a 4-byte seconds timestamp, 5 random bytes and a
  3-byte counter. Do not pass these IDs to code that parses the ObjectId fields.
- **Not secret.** The timestamp is readable from the ID. Do not use it as a
  token or a link that must be hard to guess.

## Related packages

- [`mzen-schema`](../mzen-schema/README.md) uses it to default a `String` field
  named `_id`.
- `mzen-migrate` uses it to generate the IDs of its metadata-table rows.
