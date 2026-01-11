import { Schema } from './schema'

export const clone = require('clone')

// Re-export core classes (at root)
export * from './schema'
export * from './spec'
export * from './config'
export * from './manager'
export * from './iterator'
export * from './inquisitor'
export * from './types'

// Re-export all modules for backwards compatibility
export * from './processors'
export * from './utilities'
export * from './filter'
export * from './validator'
export * from './builder'
export * from './type'

export default Schema
