# Validation

## Overview

Mzen provides comprehensive data validation and type-casting capabilities for
document schemas.

## Schema Definition

Define document structure as a set of fields and embedded documents:

```typescript
const schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, validator: 'email' },
  age: { type: Number, min: 0, max: 120 },
  status: { type: String, default: 'active' },
})
```

## Built-in Validators

### required

Field must be present:

```typescript
{
  name: { type: String, required: true }
}
```

### notNull

Field must not be null:

```typescript
{
  description: { type: String, notNull: true }
}
```

### notEmpty

Field must not be empty (for strings and arrays):

```typescript
{
  tags: { type: Array, notEmpty: true }
}
```

### length (min/max)

String or array length constraints:

```typescript
{
  username: {
    type: String,
    minLength: 3,
    maxLength: 20
  },
  tags: {
    type: Array,
    minLength: 1,
    maxLength: 10
  }
}
```

### regex

Pattern matching:

```typescript
{
  zipCode: {
    type: String,
    regex: /^\d{5}(-\d{4})?$/
  }
}
```

### equality

Field must equal another field in the same object:

```typescript
{
  password: { type: String },
  confirmPassword: {
    type: String,
    equalTo: 'password'
  }
}
```

### email

Email format validation:

```typescript
{
  email: {
    type: String,
    validator: 'email'
  }
}
```

## Custom Validators

You can define custom validation logic:

```typescript
const customValidator = (value, doc) => {
  if (value < doc.minValue) {
    return 'Value must be greater than minValue'
  }
  return true
}

const schema = new Schema({
  value: { type: Number },
  minValue: { type: Number },
  customField: {
    type: Number,
    validator: customValidator,
  },
})
```

## Default Values

Default values are used when validating, inserting, or updating a field with an
undefined or null value:

```typescript
{
  status: {
    type: String,
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  }
}
```

## Type-Casting

When a field type is configured, values are automatically cast to the required
type on validation, insert, or update.

### Supported Types

```typescript
{
  name: { type: String },        // Cast to string
  age: { type: Number },         // Cast to number
  active: { type: Boolean },     // Cast to boolean
  createdAt: { type: Date },     // Cast to Date object
  userId: { type: ObjectID }     // Cast to BSON ObjectID (MongoDB)
}
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

Mzen supports MongoDB's BSON ObjectID type:

```typescript
{
  _id: { type: ObjectID },
  userId: { type: ObjectID, required: true }
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
