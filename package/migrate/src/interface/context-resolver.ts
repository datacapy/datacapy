/**
 * ContextResolver
 *
 * Resolves a pattern string into a list of context values.
 * This is distinct from DataSourceLookup, which converts context values
 * into DataSource connection objects.
 *
 * Example flow:
 *   Pattern "*" → ContextResolver → ["projectId1", "projectId2", ...]
 *   "projectId1" → DataSourceLookup → DataSource connection object
 */
export interface ContextResolver {
  /**
   * Resolve a pattern into a list of context values
   * @param pattern - Lookup pattern (e.g., "*" for all, "ownerId=xyz" for filtered)
   * @returns Array of context objects (e.g., [{projectId: "abc"}, {projectId: "xyz"}])
   */
  resolve(pattern: string): Promise<Array<Record<string, string>>>;
}
