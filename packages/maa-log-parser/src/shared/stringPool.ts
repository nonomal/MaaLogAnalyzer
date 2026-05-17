/**
 * String pool used for tracking unique strings while returning original values.
 */
export class StringPool {
  private pool = new Set<string>()

  /**
   * Record and return the original string value.
   */
  intern(str: string | undefined | null): string {
    if (str === undefined || str === null) {
      return ''
    }

    this.pool.add(str)
    return str
  }

  /**
   * Clear pooled strings.
   */
  clear(): void {
    this.pool.clear()
  }

  /**
   * Get unique string count.
   */
  size(): number {
    return this.pool.size
  }
}
