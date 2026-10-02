/**
 * ContextResolver
 *
 * Resolves a pattern string into a list of context values.
 * This is distinct from DataSourceLookup, which converts context values
 * into DataSource connection objects.
 *
 * Example flow:
 *   Pattern "*" → ContextResolver → ["workspaceId1", "workspaceId2", ...]
 *   "workspaceId1" → DataSourceLookup → DataSource connection object
 */
export interface ContextResolver {
  /**
   * Resolve a pattern into a list of context values
   * @param pattern - Lookup pattern (e.g., "*" for all, "ownerId=xyz" for filtered)
   * @returns Array of context objects (e.g., [{workspaceId: "abc"}, {workspaceId: "xyz"}])
   */
  resolve(pattern: string): Promise<Array<Record<string, string>>>;
}
