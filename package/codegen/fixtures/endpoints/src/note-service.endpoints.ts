// Generated from note-service.ts by datacapy-gen. Do not edit.
// cspell:disable
import type { ServerApiConfig } from './server-types'

export const noteConfig = {
  service: 'note',
  enable: true,
  acl: { rules: [{ allow: false, role: 'all' }] },
  endpoints: {
    list: {
      method: 'list',
      verbs: ['get'],
      data: {
        projectId: { src: 'header', srcPath: 'X-Project-Id', required: true, type: String },
        page: { src: 'query', required: false, type: Number, defaultValue: 1 },
        sort: { src: 'query', required: false, type: String },
        done: { src: 'query', required: false, type: Boolean },
        ip: { src: 'request', required: false, type: String },
      },
      acl: { rules: [{ allow: true, role: 'projectAdmin' }] },
    },
    multi: {
      method: 'multi',
      verbs: ['get', 'head'],
      path: '/multi',
      data: {},
      acl: {
        rules: [
          { allow: true, role: 'projectAdmin' },
          { allow: true, role: 'projectOwner' },
        ],
      },
    },
    batchSave: {
      method: 'batchSave',
      verbs: ['patch'],
      path: '/:noteId',
      data: {
        noteId: { src: 'param', required: true, type: String },
        projectId: { src: 'header', srcPath: 'X-Project-Id', required: true, type: String },
        changes: { src: 'body', required: true, type: Array },
        tags: { src: 'body', required: false, type: Array },
        meta: { src: 'body', required: false },
      },
      acl: { rules: [{ allow: true, role: 'projectAdmin' }] },
      response: { error: { PlanLimitError: { http: { code: 402 } } } },
    },
    open: {
      method: 'open',
      verbs: ['get'],
      path: '/public',
      enable: false,
      data: {},
      acl: { rules: [{ allow: true, role: 'all' }] },
    },
    remove: {
      method: 'remove',
      verbs: ['delete'],
      path: '/:noteId',
      data: { noteId: { src: 'param', required: true, type: String } },
      acl: {
        rules: [
          { allow: true, role: 'projectAdmin' },
          { allow: false, role: 'guest' },
        ],
      },
    },
  },
} satisfies ServerApiConfig

export default noteConfig
