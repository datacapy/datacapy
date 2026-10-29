# Validation

## Overview

Datacapy provides comprehensive data validation and type-casting capabilities
for document schemas.

## Schema Definition

Define document structure as a set of fields and embedded documents with the
schema builder (`sb`). See the
[schema builder reference](../../schema/docs/builder.md) for every method.

```typescript
import { Schema, SchemaBuilder as sb } from '@datacapy/om'

const schema = new Schema(
  sb.schema('user').shape({
    name: sb.string().required(),
    email: sb.string().email(),
    age: sb.number(),
    status: sb.string().default('active'),
  })
)
```

## Built-in Validators

The snippets below show the field builder only; place each inside `shape()`.

### required

Field must be present:

```typescript
name: sb.string().required()
```

### notNull

Field must not be null:

```typescript
description: sb.string().notNull()
```

### notEmpty

Field must not be empty (for strings and arrays):

```typescript
tags: sb.array().notEmpty()
```

### length (min/max)

String length constraints:

```typescript
username: sb.string().minLength(3).maxLength(20)
```

### regex

Pattern matching:

```typescript
zipCode: sb.string().regex(/^\d{5}(-\d{4})?$/)
```

### equality

The builder has no method for comparing a field with another field. Use a custom
rule (below) or the plain `equality` option; see
[schema validation](../../schema/docs/validation.md#matching-another-field).

### email

Email format validation:

```typescript
email: sb.string().email()
```

## Custom Validators

Pass a function to `validate()`. It receives the value and `{ root, label }`,
and returns `true` when valid or an error message when not:

```typescript
const schema = new Schema(
  sb.schema('range').shape({
    value: sb
      .number()
      .validate((value, { root }) =>
        value < root.minValue ? 'Value must be greater than minValue' : true
      ),
    minValue: sb.number(),
  })
)
```

## Default Values

Default values are used when validating, inserting, or updating a field with an
undefined or null value:

```typescript
status: sb.string().default('pending'),
createdAt: sb.date().default('now'),
```

## Type-Casting

When a field type is configured, values are automatically cast to the required
type on validation, insert, or update.

### Supported Types

```typescript
name: sb.string(),     // Cast to string
age: sb.number(),      // Cast to number
active: sb.boolean(),  // Cast to boolean
createdAt: sb.date(),  // Cast to Date object
```

### Cast Failure

Cast failures produce validation errors:

```typescript
// Attempting to cast 'three' to Number results in NaN
// This produces a validation error
{
  age: 'three' // Error: Invalid number
}
```

## ObjectID Support

Datacapy supports MongoDB's BSON ObjectID type. The builder has no ObjectID
method, so declare the field with a plain spec option (`$type: ObjectID`, from
`@datacapy/schema`):

```typescript
{
  _id: { $type: ObjectID },
  userId: { $type: ObjectID, $validate: { required: true } }
}
```

## Validation Timing

Validation occurs at:

1. **Insert** - Before inserting a new document
2. **Update** - Before updating an existing document
3. **Manual** - Call `schema.validate(data)` explicitly

## Error Handling

Validation errors include:

- Field name
- Error message
- Validation rule that failed

```typescript
try {
  await repo.insert(data)
} catch (error) {
  if (error.isValidationError) {
    console.log(error.fields)
    // {
    //   email: 'Invalid email format',
    //   age: 'Must be between 0 and 120'
    // }
  }
}
```

## See Also

- [Architecture](architecture.md) - Overview of schemas in the system
- [Testing](testing.md) - Testing validation rules
