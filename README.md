![DataCapy logo](https://avatars.githubusercontent.com/u/335510707?s=400&u=c6a305817c43d305a8340061261e48cd2a0ca3d8&v=4 "DataCapy")

# Datacapy

An object mapper for Node.js and TypeScript. Describe your data with schemas, map
it to repositories with relations, and read and write it on MySQL or MongoDB
without hand-writing queries. Two companion libraries cover validation
(`@datacapy/schema`) and exposing your services over HTTP (`@datacapy/server`).

- **[`@datacapy/om`](package/om/README.md)**: the object mapper. Repositories,
  relations and population, field-level encryption, multi-tenant datasources.
- **[`@datacapy/schema`](package/schema/README.md)**: define, cast, filter and
  validate data. Used by `om` for repositories and by `server` for requests.
- **[`@datacapy/server`](package/server/README.md)**: config-driven Express
  endpoints with access control, over your services and repositories.

`@datacapy/id` (short, time-ordered IDs) and `@datacapy/migrate` (database
migrations) support them.

## Quick start

### 1. Install

```bash
npm install @datacapy/om mysql2
```

`@datacapy/om` re-exports everything from `@datacapy/schema`, so one package is
enough to start. `mysql2` is a peer dependency; add `mongodb` instead if you use
MongoDB. Add `@datacapy/server` for REST endpoints (it re-exports
`@datacapy/om`), and `@datacapy/migrate` for database migrations.

### 2. Define and query

The example below runs against an in-memory datasource, so it needs no database.

```ts
import { ModelManager, Repo, DataSourceMock, sb } from "@datacapy/om";

class ArtistRepo extends Repo {
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

class AlbumRepo extends Repo {
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

### 3. Next steps

- Swap `DataSourceMock` for `DataSourceMysql` or `DataSourceMongodb`; see the
  [`om` README](package/om/README.md).
- Expose the same services and repositories over REST with `@datacapy/server`;
  see its [quick start](package/server/README.md#quick-start).

## Packages

### @datacapy/om

Repositories, relations (has-one, has-many, belongs-to), query population,
field-level at-rest encryption and dynamic datasource routing. See the
[README](package/om/README.md), or a guide:

- [Architecture](package/om/docs/architecture.md): system design and components
- [Relations](package/om/docs/relations.md) and [Composite Keys](package/om/docs/composite-keys.md)
- [Validation](package/om/docs/validation.md): data validation and type-casting
- [Encryption](package/om/docs/encryption.md): field-level at-rest encryption
- [DataSource Context](package/om/docs/dynamic-datasource.md), with [advanced](package/om/docs/dynamic-datasource-advanced.md) and [multiple](package/om/docs/dynamic-datasource-multiple.md) usage
- [MySQL Indexes](package/om/docs/mysql-indexes.md) and [Update Operators](package/om/docs/update-operators.md) (MySQL)
- [Upsert Operations](package/om/docs/upsert.md)
- [Performance](package/om/docs/performance.md), [Testing](package/om/docs/testing.md) and [Debugging](package/om/docs/debugging.md)

### @datacapy/schema

A fluent builder (`sb`) for defining schemas, with validation, type-casting,
filtering, private fields and encryption marking. See the
[README](package/schema/README.md), or a guide:

- [Builder](package/schema/docs/builder.md): every builder and method, and the equivalent plain spec
- [Validation](package/schema/docs/validation.md): rules, error messages, strict mode, casting, query validation
- [Filtering](package/schema/docs/filtering.md): defaults, string filters, conditional and custom filters, private fields
- [Encryption](package/schema/docs/encryption.md): marking fields and the encryption service interface
- [Composition](package/schema/docs/composition.md): schema references, arrays, `$or`, dynamic keys, constructors

### @datacapy/server

Maps a config object per service or repository to an Express route, with
request validation, ordered allow and deny rules, and error-to-status mapping.
See the [README](package/server/README.md) and the runnable
[`example1.js`](package/server/examples/example1.js).

### @datacapy/id

Short, time-ordered Base62 string IDs (15 characters), a relational-friendly
alternative to MongoDB's ObjectId. Schemas use it to default `_id` fields. See
the [README](package/id/README.md).

### @datacapy/migrate

Database migration runner with versioned patches, dry-run mode and
multi-datasource support. See the [README](package/migrate/README.md), or a
guide:

- [Architecture](package/migrate/docs/architecture/index.md): components, execution flow, runtime safety
- [Best Practices](package/migrate/docs/best-practices/index.md): dos and don'ts, testing and rollback, common patterns
- [Advanced Usage](package/migrate/docs/advanced-usage/index.md): multi-datasource migrations, custom workflows, troubleshooting

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
