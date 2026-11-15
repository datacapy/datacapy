# Try it with no database

```bash
pnpm add @datacapy/om @datacapy/id
```

`@datacapy/om` re-exports `@datacapy/schema`, and `@datacapy/id` generates the `_id` values. Add
`@datacapy/server` for REST endpoints. To use a git checkout instead of npm, see [workspace install](workspace-install.md).

To generate schemas from your classes, add `@datacapy/codegen` as a dev dependency and set `schemaModule` in
`datacapy.config.json` so the generated files import from `@datacapy/om`:

```json
{ "schemaModule": "@datacapy/om", "strict": true }
```

Declare the constructors as classes, one file each. `Customer` has a method, and `orders` is related data:

```ts
// Order.ts
import { SchemaConstructor } from '@datacapy/om'

/** @schema order */
export class Order extends SchemaConstructor<Order> {
  _id?: string
  number!: string
  total!: number
  customerId!: string
}
```

```ts
// Customer.ts
import { SchemaConstructor } from '@datacapy/om'
import type { tags as t } from '@datacapy/om'

import type { Order } from './Order'

/** @schema customer */
export class Customer extends SchemaConstructor<Customer> {
  _id?: string
  name!: string & t.Trim
  orders?: Order[] & t.Relation

  greeting() {
    return `Hello, ${this.name}`
  }
}
```

Run `datacapy-gen` to write `Order.schema.ts` and `Customer.schema.ts` beside them, then run the constructors against an in-memory datasource
seeded with data:

```ts
import { ModelManager, Repo, DataSourceMock, RepoRelationBuilder as relb } from '@datacapy/om'
import genUniqueId from '@datacapy/id'

import { Customer } from './Customer'
import { SchemaCustomer } from './Customer.schema'
import { Order } from './Order'
import { SchemaOrder } from './Order.schema'

class RepoCustomer extends Repo<Customer> {
  constructor() {
    super({
      name: 'customer',
      dataSource: 'db',
      relations: {
        orders: relb.hasMany('order').key('customerId'),
      },
    })
  }
}

class RepoOrder extends Repo<Order> {
  constructor() {
    super({ name: 'order', dataSource: 'db' })
  }
}

const adaId = genUniqueId()

const modelManager = new ModelManager({
  schemas: [new SchemaCustomer(), new SchemaOrder()],
  constructors: [Customer, Order],
})
modelManager.addDataSource(
  'db',
  new DataSourceMock({
    customer: [{ _id: adaId, name: 'Ada Lovelace' }],
    order: [
      { _id: genUniqueId(), number: '#1001', total: 42, customerId: adaId },
      { _id: genUniqueId(), number: '#1002', total: 18, customerId: adaId },
    ],
  }),
)

const customers = new RepoCustomer()
modelManager.addRepo(customers)
modelManager.addRepo(new RepoOrder())
await modelManager.init()

const found = await customers.find({}, { populate: { orders: true } })
found[0].greeting() // 'Hello, Ada Lovelace'
found[0].orders?.[0] instanceof Order // true
```

Each constructor is declared once, as a class. The generated schema is checked against the class's data
fields, `orders` is a `Relation`: related data that a query populates, never stored on the customer, and
`Repo<Customer>` makes `find()` return `Customer[]`.

The link between a class and its schema is the name. The generated schema says `construct('Customer')`,
and the model manager's `constructors` hold the class of that name; `init()` hands them to every repo,
which turns each stored document into a `Customer` instance, populated `orders` included. The model
manager also assigns each schema to the repo of the same name, so the repos declare none. See
[Constructors and raw data](../package/schema/docs/constructors.md) and
[Composition](../package/schema/docs/composition.md#constructors).
