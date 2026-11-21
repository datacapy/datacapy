# Body parsing

JSON bodies are parsed by default, limited to `100kb`. Enable other parsers or
change the limit per endpoint:

```ts
bodyParser: {
  json: { limit: '2mb' },
  urlencoded: { enable: true },
  text: { enable: true, type: 'text/csv' },
}
```
