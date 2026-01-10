import { base62EncodeUuid } from "./base62";
import { genUuid } from "./uuid";

export function genUniqueId(): string {
  return base62EncodeUuid(genUuid());
}

export default genUniqueId;
