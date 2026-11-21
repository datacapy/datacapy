<!-- cspell:ignore noteget -->

# API configs

```ts
server.addApiConfig(config)
server.addApiConfigs([configA, configB])
```

| Option                        | Meaning                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `service` / `repo` / `object` | The remote object: a service name, a repository name (both looked up in the `ModelManager`), or an object instance  |
| `path`                        | Root path for this config. Defaults to `/` plus the kebab-case service or repo name. `''` mounts at the server root |
| `acl.rules`                   | Rules applied to every endpoint in this config                                                                      |
| `endpoints`                   | Map of endpoint name to endpoint config                                                                             |
| `enable`                      | `false` skips the whole config                                                                                      |
| `disable`                     | `{ endpointName: true }` removes named endpoints                                                                    |
| `disableGroup`                | `{ groupName: true }` removes endpoints listing that group in `groups`                                              |

## Endpoints

| Option                        | Meaning                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `method`                      | Name of the method to call on the remote object. The server throws at request time if it does not exist                       |
| `path`                        | Path under the config's root. **Start it with `/`**: a missing slash is concatenated as-is (`/note` + `get` gives `/noteget`) |
| `verbs`                       | HTTP verbs, for example `['get']` or `['get', 'head']`. Default `['get']`                                                     |
| `data`                        | Request data to extract and validate. See [Request data](request-data.md)                                                     |
| `acl.rules`                   | Rules added after the config's rules. See [Access control](access-control.md)                                                 |
| `response`                    | Success status and content type, and error mapping. See [Responses and errors](responses-and-errors.md)                       |
| `service` / `repo` / `object` | Override the remote object for this endpoint only                                                                             |
| `groups`                      | Labels for `disableGroup`                                                                                                     |
| `enable`                      | `false` removes this endpoint                                                                                                 |
| `priority`                    | Higher priority routes register first. Default `0`                                                                            |
| `bodyParser`                  | Per-endpoint body parsing. See [Body parsing](body-parsing.md)                                                                |

**Route order matters.** Express matches in registration order, so a fixed path
must come before a parameter that would swallow it. Give `/stats` a higher
`priority` than `/:id`.
