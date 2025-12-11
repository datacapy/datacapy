/**
 * Pure utility functions for MySQL SQL generation
 * These functions have no dependencies on class state and can be used independently
 */

/**
 * Converts a Date object to MySQL datetime string format
 */
export function dateToMysqlString(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19)
}

/**
 * Converts values to MySQL-compatible format (primarily dates)
 */
export function convertValue(value: any): any {
  return value instanceof Date ? dateToMysqlString(value) : value
}

/**
 * Formats nested field names for use in generated column names
 * Example: 'address.city' -> 'address_city'
 */
export function formatNestedColumnName(field: string): string {
  return field.replace(/\./g, '_')
}

/**
 * Removes extra whitespace from SQL strings
 */
export function stripWhitespace(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

/**
 * Safely quotes MySQL identifiers (table names, column names)
 */
export function quoteIdentifier(identifier: string): string {
  return '`' + identifier + '`'
}

/**
 * Sanitizes and optionally quotes MySQL identifiers
 */
export function sanitizeIdentifier(identifier: string, quote = false): string {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`)
  }
  return quote ? quoteIdentifier(identifier) : identifier
}

/**
 * Generates LEFT() function SQL
 */
export function left(sql: string, length: number): string {
  return `LEFT(${sql}, ${length})`
}

/**
 * Generates STR_TO_DATE() function SQL
 */
export function strToDate(date: string, format: string): string {
  return `STR_TO_DATE(${date}, '${format}')`
}

/**
 * Generates JSON_EXTRACT() function SQL
 */
export function jsonExtract(doc: string, path: string): string {
  return `JSON_EXTRACT(${doc}, ${path})`
}

/**
 * Generates JSON_VALUE() function SQL
 */
export function jsonValue(doc: string, path: string): string {
  return `JSON_VALUE(${doc}, ${path})`
}

/**
 * Generates JSON_UNQUOTE() function SQL
 */
export function jsonUnquote(sql: string): string {
  return `JSON_UNQUOTE(${sql})`
}
