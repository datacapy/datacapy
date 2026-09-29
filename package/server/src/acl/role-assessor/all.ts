import ServerAclRoleAssessor from '../role-assessor'

export class ServerAclRoleAssessorAll extends ServerAclRoleAssessor {
  constructor() {
    super('all')
  }

  async hasRole(_user, _context?) {
    return true
  }
}

export default ServerAclRoleAssessorAll
