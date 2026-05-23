export class Reflector {
  /**
   * Retrieve metadata for a specified key on a target (class or method).
   */
  public get<TValue = any, TResult = TValue>(metadataKey: any, target: any): TResult | undefined {
    if (!target) return undefined;
    if (target.__metadata__ && target.__metadata__[metadataKey] !== undefined) {
      return target.__metadata__[metadataKey] as TResult;
    }
    return undefined;
  }

  /**
   * Retrieve metadata for a specified key on a list of targets and return the first defined value.
   */
  public getAllAndOverride<TValue = any, TResult = TValue>(metadataKey: any, targets: any[]): TResult | undefined {
    for (const target of targets) {
      const value = this.get<TValue, TResult>(metadataKey, target);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Retrieve metadata for a specified key on a list of targets and merge their values.
   */
  public getAllAndMerge<TValue = any, TResult = TValue>(metadataKey: any, targets: any[]): TResult {
    const values = targets
      .map(target => this.get(metadataKey, target))
      .filter(value => value !== undefined);

    if (values.length === 0) {
      return [] as unknown as TResult;
    }

    const firstValue = values[0];
    if (Array.isArray(firstValue)) {
      return values.reduce((acc, val) => {
        if (Array.isArray(val)) {
          return acc.concat(val);
        }
        return acc.concat([val]);
      }, []) as unknown as TResult;
    }

    if (firstValue && typeof firstValue === 'object') {
      return values.reduceRight((acc, val) => {
        return Object.assign(acc, val);
      }, {}) as unknown as TResult;
    }

    return values as unknown as TResult;
  }
}
