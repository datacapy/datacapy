# Request data

`data` maps each argument name to where it comes from and how to check it. The
values arrive on the single object passed to your method.

```ts
data: {
  id: { src: 'param', type: Number, required: true },
  page: { src: 'query', type: Number, defaultValue: 1 },
  token: { src: 'header', srcPath: 'X-Token' },
  city: { src: 'body', srcPath: 'address.city' },
}
```

| Option                            | Meaning                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src`                             | `query` (default), `param`, `body`, `header`, `aclContext`, `aclConditions`, or `container`    |
| `srcPath`                         | Name or dotted path to read. Defaults to the argument name. For `header` it is the header name |
| `type`                            | Type to cast to (`String`, `Number`, `Boolean`, `Date`, ...)                                   |
| `required`, `notNull`, `notEmpty` | Validation rules                                                                               |
| `defaultValue`                    | Used when the value is absent                                                                  |

`container` reads from the whole request context (`request`, `response`,
`config`, `param`, `query`, `body` and the ACL values), so
`{ src: 'container', srcPath: 'response' }` gives your method the Express
response object.

Validation uses [@datacapy/schema](../../schema/README.md). A failure returns
**403** with `{ "validationErrors": { field: [messages] } }`. This check runs
before the access rules, so an unauthorised caller who sends invalid data sees
the validation error, not a 401.
