# Responses and errors

A method's return value is sent as JSON with status 200. Override that per
endpoint:

```ts
response: { success: { http: { code: 201 } } }
response: { success: { http: { code: 200, contentType: 'text/csv' } } }
```

Any `contentType` other than `json` sets the `Content-Type` header and sends the
value as-is.

Throw one of the built-in errors to choose the status. Extra properties you pass
are included in the response body.

| Error                         | Status |
| ----------------------------- | ------ |
| `ServerErrorBadRequest`       | 400    |
| `ServerErrorUnauthorized`     | 401    |
| `ServerErrorForbidden`        | 403    |
| `ServerErrorNotFound`         | 404    |
| `ServerErrorMethodNotAllowed` | 405    |
| `ServerErrorTooManyRequests`  | 429    |
| `ServerErrorInternal`         | 500    |

```ts
throw new ServerErrorForbidden({ message: 'Not your note', reason: 'owner' })
// 403 {"message":"Not your note","reason":"owner","name":"ServerErrorForbidden"}
```

To map your own error classes, list them by class name in the endpoint's
`response.error`. The first matching entry wins. A `schema` narrows the match to
errors whose properties validate.

```ts
class OutOfStockError extends ServerError {}

response: {
  error: {
    OutOfStockError: { http: { code: 409 } },
  },
}
```

The response body is the error serialised as JSON, so only its own enumerable
properties appear. `ServerError` subclasses include `message`
(`new OutOfStockError('none left')` sends
`{"message":"none left","name":"ServerError"}`). A plain `Error` subclass sends
only the properties you assign to it, and no message.

An error with no matching entry becomes a 500 with
`{ error: "InternalServerError", message, endpoint, method }`.

To rewrite errors globally, for example to translate messages into the caller's
language, set a translator. It runs on every thrown error before matching and
can be async.

```ts
server.setErrorTranslator(async (err, req) => translate(err, req.aclContext))
```

## Sending your own response

For downloads, streams or anything that is not a return value, take the response
object as request data and call `res.stream(readable, options)`. The server sees
the response is handled and sends nothing more.

```ts
files: {
  path: '/:name',
  method: 'download',
  data: {
    name: { src: 'param' },
    res: { src: 'container', srcPath: 'response' },
  },
}
```
