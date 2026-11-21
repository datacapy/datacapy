# Access control

An endpoint is denied unless a rule allows it. Each rule names a role and says
whether that role is `allow: true` or `allow: false`.

```ts
acl: {
  rules: [
    { allow: true, role: 'authed' },
    { allow: false, role: 'suspended' },
  ],
}
```

**How rules combine.** The config's rules are followed by the endpoint's rules,
and they are evaluated in order. A rule only counts if the caller holds its
role. When it does, it sets the outcome to its `allow` value, so **later rules
override earlier ones**. The built-in `all` role is held by every request.

```ts
// Anyone authed may call, unless they are suspended, but admins always may
rules: [
  { allow: true, role: 'authed' },
  { allow: false, role: 'suspended' },
  { allow: true, role: 'admin' },
]
```

A denied request throws `ServerErrorUnauthorized` (401).

## Role assessors

A role is defined by a class extending `ServerAclRoleAssessor`. Register it with
`server.addRoleAssessor()` or `addRoleAssessors([...])`.

| Member                                        | Purpose                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `super(name)`                                 | The role name used in rules                                                                                 |
| `priority`                                    | Assessors with a higher priority run `initContext` first. Same-priority assessors run together. Default `0` |
| `initContext(request, context, remoteObject)` | Runs once per request before any rule. Read the credential and store what `hasRole` needs on `context`      |
| `hasRole(context)`                            | Return `true`, `false`, or an object of conditions                                                          |
| `this.repos`                                  | The model's repositories, for lookups                                                                       |

```ts
class WorkspaceAdmin extends ServerAclRoleAssessor {
  constructor() {
    super('workspaceAdmin')
  }

  async hasRole({ jwt, workspaceId }) {
    const ids: string[] = jwt?.adminOf ?? []
    return ids.includes(workspaceId)
  }
}
```

An assessor that reads context filled in by another (a decoded token, say) needs
a lower `priority` than the assessor that fills it in. Give the
credential-reading assessor the higher number.

## Conditions

`hasRole` may return an object instead of `true`. The request is allowed, and
the object is passed to your method as `aclConditions`, so the method can limit
what it returns, for example to one team's rows.

```ts
async hasRole({ jwt }) {
  return jwt?.teamId ? { teamId: jwt.teamId } : false
}
```

A role that returns conditions is always treated as a grant, whatever its rule's
`allow` says. Once one has granted access, later deny rules do not revoke it.
Use conditions only for roles you allow, and put them last.

## Security notes

- `context` starts as a copy of the request data you declared, so a caller
  controls those keys. Always overwrite the keys your assessor uses in
  `initContext`, and never declare request data whose name matches an ACL
  context key.
- Scope by role, not by a check inside the method. For an endpoint that acts on
  one workspace, use a role that checks the caller's rights on the `workspaceId`
  argument, rather than a generic role plus a lookup.
