import { base62EncodeBsonId, base62DecodeBsonId } from "./base62";
import { genBsonId } from "./bsonId";

export function genUniqueId(): string {
  return base62EncodeBsonId(genBsonId());
}

export function uniqueIdToBsonId(uniqueId: string): string {
  return base62DecodeBsonId(uniqueId);
}

export function bsonIdToUniqueId(bsonId: string): string {
  return base62EncodeBsonId(bsonId);
}

export default genUniqueId;
