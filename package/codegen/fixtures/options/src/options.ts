/** @schema strict-thing construct=StrictThing strict */
export interface StrictThingData {
  name: string
}

/** @schema loose-thing no-strict */
export interface LooseThingData {
  name: string
}

/** @schema plain-thing */
export interface PlainThingData {
  name: string
}
