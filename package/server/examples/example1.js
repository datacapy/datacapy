'use strict'

// A small notes API. Build the package first (`pnpm build`), then run:
//
//   node examples/example1.js
//
// and try it with curl:
//
//   curl -i localhost:3838/api/note/1
//   curl -i -H 'X-User: sam' localhost:3838/api/note/1
//   curl -i -H 'X-User: sam' localhost:3838/api/note/99
//   curl -i -H 'X-User: sam' -H 'Content-Type: application/json' \
//     -d '{"text":"hi"}' localhost:3838/api/note
//
// Inside your own project, require '@datacapy/server' instead of '../dist'.
const {
  default: Server,
  Service,
  ServerAclRoleAssessor,
  ServerErrorNotFound,
} = require('../dist')

class NoteService extends Service {
  notes = [{ id: 1, text: 'Hello', owner: 'kevin' }]

  constructor() {
    super({ name: 'note' })
  }

  // Every endpoint method receives one object holding the request data
  // declared for the endpoint, plus aclContext and aclConditions.
  async get({ id }) {
    const note = this.notes.find((n) => n.id === id)
    if (!note) throw new ServerErrorNotFound({ message: 'No such note' })
    return note
  }

  async add({ text, aclContext }) {
    const note = { id: this.notes.length + 1, text, owner: aclContext.user }
    this.notes.push(note)
    return note
  }
}

// Demo only: trusts a header. A real role assessor verifies a token or session.
class Authed extends ServerAclRoleAssessor {
  constructor() {
    super('authed')
  }

  async initContext(request, context) {
    context.user = request.get('X-User') ?? null
  }

  async hasRole(context) {
    return !!context.user
  }
}

const server = new Server({
  port: Number(process.env.PORT ?? 3838),
  path: '/api',
})

server.modelManager.addService(new NoteService())
server.addRoleAssessor(new Authed())

server.addApiConfig({
  service: 'note',
  acl: { rules: [{ allow: true, role: 'authed' }] },
  endpoints: {
    getOne: {
      path: '/:id',
      method: 'get',
      verbs: ['get'],
      data: { id: { src: 'param', type: Number, required: true } },
    },
    add: {
      path: '/',
      method: 'add',
      verbs: ['post'],
      data: {
        text: { src: 'body', type: String, required: true, notEmpty: true },
      },
      response: { success: { http: { code: 201 } } },
    },
  },
})
;(async () => {
  try {
    await server.init()
    await server.start()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
})()
