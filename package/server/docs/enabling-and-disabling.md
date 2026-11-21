# Enabling and disabling

```ts
{ service: 'note', enable: false, endpoints: { ... } }        // whole config
{ service: 'note', disable: { getOne: true }, endpoints: { ... } }  // by name
{ service: 'note', disableGroup: { write: true }, endpoints: {
  add: { groups: ['write'], ... },
} }                                                              // by group
{ getOne: { enable: false, ... } }                                // one endpoint
```

Use this to switch endpoints off per environment without editing the config.
