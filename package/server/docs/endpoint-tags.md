# Endpoint tags

Type-only tags that say where a service method parameter comes from. They are
the vocabulary the endpoint generator reads; they add nothing at runtime and a
plain value stays assignable (`const id: string & e.Param = 'x'`).

```ts
import type { tagsEndpoint as e } from '@datacapy/server'

async batchSave(args: {
  surveyId: string & e.Param
  projectId: string & e.Header<'X-Project-Id'>
  changes: Change[] & e.Body
  page?: number & e.Query & e.Default<1>
  aclContext?: e.AclContext
}): Promise<boolean>
```

The namespace is `tagsEndpoint`, not `tags`, because `@datacapy/server` already
re-exports the schema package's `tags`.

| Tag                           | Endpoint `data` entry                        |
| ----------------------------- | -------------------------------------------- |
| `Param`                       | `src: 'param'`                               |
| `Query`                       | `src: 'query'` (the default source)          |
| `Body`                        | `src: 'body'`                                |
| `Header<'Name'>`              | `src: 'header'`, `srcPath: 'Name'`           |
| `Config<'a.b'>`               | `src: 'config'`, `srcPath: 'a.b'`            |
| `Request<'ip'>`               | `src: 'request'`, `srcPath: 'ip'`            |
| `Container<'a.b'>`            | `src: 'container'`, `srcPath: 'a.b'`         |
| `Default<V>`                  | `defaultValue: V`                            |
| `AclContext`, `AclConditions` | none: the framework sets these after parsing |

An optional property gives `required: false`; the property name is the `data`
key.
