import type { AclContext, Body, Default, Header, Param, Query, Request } from './tags'

interface Change {
  id: string
}

/** @endpoints note */
export class ServiceNote {
  /**
   * @route get
   * @acl projectAdmin
   */
  async list(args: {
    projectId: string & Header<'X-Project-Id'>
    page?: number & Query & Default<1>
    sort?: ('asc' | 'desc') & Query
    done?: boolean & Query
    ip?: string & Request<'ip'>
    aclContext?: AclContext
  }): Promise<string[]> {
    return [args.projectId]
  }

  /**
   * @route get,head /multi
   * @acl projectAdmin,projectOwner
   */
  async multi(): Promise<boolean> {
    return true
  }

  /**
   * @route patch /:noteId
   * @acl projectAdmin
   * @error PlanLimitError 402
   */
  async batchSave(args: {
    noteId: string & Param
    projectId: string & Header<'X-Project-Id'>
    changes: Change[] & Body
    tags?: string[] & Body
    meta?: unknown & Body
  }): Promise<boolean> {
    return args.changes.length > 0
  }

  /**
   * @route get /public
   * @acl public
   * @enable false
   */
  async open(): Promise<boolean> {
    return true
  }

  /**
   * @route delete /:noteId
   * @acl projectAdmin
   * @acl allow=false guest
   */
  async remove(args: { noteId: string & Param }): Promise<boolean> {
    return args.noteId.length > 0
  }
}
