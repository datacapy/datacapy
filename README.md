<p align="center">
  <img src="asset/datacapy.png" alt="DataCapy: a capybara resting on curly and square brackets" width="420">
</p>

# DataCapy

**Define your data once, then use it everywhere.**

- One document query API, whichever database you choose to use.
- Relations between documents are declared once and loaded in a single call.
- The same schema validates in your browser and on your server.
- Your services become REST endpoints with a short config.

DataCapy is an object-document mapper (ODM) for Node.js and TypeScript, with four
companion libraries: `schema`, `server`, `migrate` and `id`.

## The problems it solves

### One document query API for every database

Whichever database you choose, you work with it the same way. Repositories give you
one set of methods and one MongoDB-style query language, so there is no separate
client library, query dialect or result shape to learn for each store. A project can
use several types of database server side by side and still read and write them all alike.

```ts
const artists = await artistRepo.find({
  name: { $in: ["Radiohead", "Portishead"] },
});
```

The datasource is configuration. The query above is the same on each of these:

```ts
modelManager.addDataSource(
  "db",
  new DataSourceMysql({ host, user, password, database }),
);
// or: new DataSourceMongodb({ url })   (also bundled: Redis, and an in-memory mock for tests)
```

MySQL, MongoDB, Redis and an in-memory mock ship with `@datacapy/om`. If your database
is not covered, write an adaptor that implements the
[`DataSource`](package/om/src/data-source/interface.ts) interface and it gets the same
API as the rest.

### Document relations, defined and queried

Declare how documents relate, then populate them in one call. No hand-written joins,
and a relation can span datasources, so a MySQL document can point at a MongoDB one.

```ts
relations: {
  albums: { type: "hasMany", repo: "album", key: "artistId" },
  label: { type: "belongsToOne", repo: "label", key: "labelId" },
}
```

```ts
const artist = await artistRepo.findOne(
  { _id: "7" },
  { populate: { albums: true, label: true } },
);
// { _id: '7', name: 'Radiohead', albums: [{ name: 'OK Computer' }, ...], label: { name: 'EMI' } }
```

Has-one, has-many, belongs-to-one, belongs-to-many, counts, embedded relations and
composite keys are supported. See [Relations](package/om/docs/relations.md).

### Share schemas between client and server

A schema is plain TypeScript with no server-only dependencies. Define it once in a
shared package. The server validates writes with it, and the browser runs the same
rules to show errors before anything is sent.

```ts
import { Schema, sb } from "@datacapy/schema";

export const personSchema = new Schema(
  sb
    .schema("person")
    .shape({
      name: sb.string().required().trim().length(2, 50),
      email: sb.string().email().lowercase(),
      age: sb.number(),
    })
    .build(),
);

const { isValid, errors } = await personSchema.validate({
  name: "  Paul ",
  age: "33",
});
// isValid: true, and the object is now { name: 'Paul', age: 33, ... }: cast, trimmed, defaulted
```

### Expose data over REST

Describe each endpoint in a config object. Nothing is reachable until you declare it.
DataCapy validates and casts the request, checks access rules, calls your service and
maps errors to HTTP statuses.

```ts
server.addApiConfig({
  service: "note",
  acl: { rules: [{ allow: true, role: "authed" }] },
  endpoints: {
    getOne: {
      path: "/:id",
      method: "get",
      verbs: ["get"],
      data: { id: { src: "param", type: Number, required: true } },
    },
  },
});
```

```
GET /api/note/1    (no credentials)  401
GET /api/note/99                     404 {"message":"No such note"}
GET /api/note/abc                    403 {"validationErrors":{"id":["'abc' of type String cannot be cast to type Number"]}}
GET /api/note/1                      200 {"id":1,"text":"Hello"}
```

The full example is in the [`server` quick start](package/server/README.md#quick-start).

## Also included

- **Field-level encryption**: mark a schema field and it is encrypted at rest, with your own encryption service.
- **Multi-tenant datasources**: route each request to a different database at runtime.
- **Migrations**: versioned patches with dry-run and multi-datasource support.
- **Time-ordered IDs**: short Base62 strings, friendlier to relational indexes than ObjectId.

## Quick start

```bash
pnpm add @datacapy/om mysql2
```

`@datacapy/om` re-exports everything from `@datacapy/schema`, so one package is
enough to start. `mysql2` is a peer dependency; add `mongodb` instead if you use
MongoDB. Add `@datacapy/server` for REST endpoints (it re-exports `@datacapy/om`),
and `@datacapy/migrate` for database migrations.

### Use from a git checkout

To use Datacapy straight from source in your own pnpm workspace, without
installing it from the npm registry, add the checkout as a submodule:

```bash
git submodule add https://github.com/datacapy/datacapy external/datacapy
```

List its packages in your `pnpm-workspace.yaml`:

```yaml
packages:
  - "package/*"
  - "external/datacapy/package/*"
```

Depend on them with the workspace protocol in your `package.json`:

```json
{
  "dependencies": {
    "@datacapy/om": "workspace:*",
    "mysql2": "^3.0.0"
  }
}
```

Then install and build once, because each package's `main` points at `dist/`:

```bash
pnpm install
pnpm --filter "@datacapy/*" build
```

Run `pnpm install` from your own workspace root only; it installs the checkout's
dependencies too, so there is no separate install inside `external/datacapy`.
Rebuild a package after changing its source.

The example below runs against an in-memory datasource, so it needs no database.

```ts
import { ModelManager, Repo, DataSourceMock, sb } from "@datacapy/om";

class ArtistRepo extends Repo<unknown> {
  constructor() {
    super({
      name: "artist",
      dataSource: "db",
      schema: sb
        .schema("artist")
        .shape({
          _id: sb.string(),
          name: sb.string().required().trim(),
        })
        .build(),
      relations: {
        albums: { type: "hasMany", repo: "album", key: "artistId" },
      },
    });
  }
}

class AlbumRepo extends Repo<unknown> {
  constructor() {
    super({ name: "album", dataSource: "db" });
  }
}

const modelManager = new ModelManager();

// Swap in DataSourceMysql or DataSourceMongodb for a real database
modelManager.addDataSource(
  "db",
  new DataSourceMock({
    artist: [{ _id: "7", name: "Radiohead" }],
    album: [
      { _id: "1", name: "The Bends", artistId: "7" },
      { _id: "2", name: "OK Computer", artistId: "7" },
    ],
  }),
);

const artists = new ArtistRepo();
modelManager.addRepo(artists);
modelManager.addRepo(new AlbumRepo());
await modelManager.init();

const found = await artists.find({}, { populate: { albums: true } });
// [{ _id: '7', name: 'Radiohead', albums: [{ name: 'The Bends', ... }, ...] }]
```

## Packages

| Package                                          | What it does                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`@datacapy/om`](package/om/README.md)           | The mapper: repositories, relations and population, encryption, multi-tenant datasources, adaptors |
| [`@datacapy/schema`](package/schema/README.md)   | Define, cast, filter and validate data. Runs in Node and the browser                               |
| [`@datacapy/server`](package/server/README.md)   | Config-driven Express endpoints with request validation and access control                         |
| [`@datacapy/migrate`](package/migrate/README.md) | Database migration runner with versioned patches and dry-run mode                                  |
| [`@datacapy/id`](package/id/README.md)           | Short, time-ordered Base62 IDs (15 characters)                                                     |

### Guides

- **om**: [Architecture](package/om/docs/architecture.md), [Relations](package/om/docs/relations.md), [Composite Keys](package/om/docs/composite-keys.md), [Validation](package/om/docs/validation.md), [Encryption](package/om/docs/encryption.md), [DataSource Context](package/om/docs/dynamic-datasource.md), [MySQL Indexes](package/om/docs/mysql-indexes.md), [Update Operators](package/om/docs/update-operators.md), [Upsert](package/om/docs/upsert.md), [Performance](package/om/docs/performance.md), [Testing](package/om/docs/testing.md), [Debugging](package/om/docs/debugging.md)
- **schema**: [Builder](package/schema/docs/builder.md), [Validation](package/schema/docs/validation.md), [Filtering](package/schema/docs/filtering.md), [Encryption](package/schema/docs/encryption.md), [Composition](package/schema/docs/composition.md)
- **migrate**: [Architecture](package/migrate/docs/architecture/index.md), [Best Practices](package/migrate/docs/best-practices/index.md), [Advanced Usage](package/migrate/docs/advanced-usage/index.md)

## Development

This is a pnpm monorepo.

```bash
# Install dependencies
pnpm install

# Build and test everything
pnpm build
pnpm test

# Build or test one package (id, schema, om, server, migrate)
pnpm build:om
pnpm test:om

# Format and clean
pnpm format
pnpm clean
```

## License

[BSD 3-Clause](LICENSE)
