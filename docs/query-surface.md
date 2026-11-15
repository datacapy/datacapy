<!-- cspell:ignore elemMatch -->

# Query surface

Filters use MongoDB-style operators. This is the set that behaves the same on MySQL and MongoDB.
MongoDB also accepts its own native operators, but code that uses them is tied to that datasource.

| Group      | Operators                                                 |
| ---------- | --------------------------------------------------------- |
| Comparison | `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin` |
| Logical    | `$and`, `$or`, `$nor`, `$not`                             |
| Existence  | `$exists`, `$type`                                        |
| String     | `$regex` (with `$options`)                                |

`$like` is a MySQL-only operator. There is no `$elemMatch` in the portable set.

`repo.groupCount(fields, query)` and `repo.findGroup(fields, query)` are separate calls with their own
return shape: `{ _id, count }` rows and grouped rows. They group by top-level fields and take the same
filter as `find()`. They do not match inside nested arrays.
