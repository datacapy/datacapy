import ObjectID from 'bson-objectid'

class Mixed {}

export const SchemaTypes = {
  String: String,
  Number: Number,
  Boolean: Boolean,
  Array: Array,
  Object: Object,
  Date: Date,
  // cspell:ignore bson
  // bson-objectid v2 does not export its constructor type so cast to avoid TS4023
  ObjectID: ObjectID as any,
  Mixed: Mixed,
}

export default SchemaTypes
