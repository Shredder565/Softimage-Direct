// Softimage Application.Preferences.Categories — dump-backed FullName keys only.
// Sources: unlock_all_remaining.json (sample_keys) + si_menus_live.json (full list).
// No HWND / invent Parameters for categories Softimage did not expose under headless dump.
import dump from '../../data/dump/si_preference_categories.json';

/** Softimage Preference category node: FullName like `preferences.rendering`. */
export class PreferenceCategory {
  constructor(public readonly FullName: string) {}
  get Name(): string {
    const i = this.FullName.lastIndexOf('.');
    return i >= 0 ? this.FullName.slice(i + 1) : this.FullName;
  }
  toString(): string { return this.FullName; }
  valueOf(): string { return this.FullName; }
}

/**
 * Softimage-style Categories collection: enumerable + callable by FullName / Name / index.
 * Attested nesting is the `preferences.<leaf>` FullName path only.
 */
export type PreferenceCategories = ((key?: string | number) => PreferenceCategory | undefined) & {
  Count: number;
  Item(key: string | number): PreferenceCategory | undefined;
  [Symbol.iterator](): Iterator<PreferenceCategory>;
  toArray(): PreferenceCategory[];
};

export function makePreferenceCategories(keys: string[] = dump.categories as string[]): PreferenceCategories {
  const items = keys.map(k => new PreferenceCategory(k));
  const byFull = new Map(items.map(c => [c.FullName, c]));
  const byName = new Map(items.map(c => [c.Name, c]));
  // Softimage Category lookup is case-sensitive on attested FullName; also accept leaf Name.
  const resolve = (key: string | number): PreferenceCategory | undefined => {
    if (typeof key === 'number') return items[key];
    return byFull.get(key) ?? byName.get(key) ?? byFull.get(`preferences.${key}`);
  };
  const coll = ((key?: string | number) => {
    if (key === undefined) return undefined;
    return resolve(key);
  }) as PreferenceCategories;
  Object.defineProperties(coll, {
    Count: { get: () => items.length, enumerable: true },
    Item: { value: resolve, enumerable: false },
    toArray: { value: () => items.slice(), enumerable: false },
    [Symbol.iterator]: { value: function* () { yield* items; }, enumerable: false },
  });
  return coll;
}

/** Softimage Application.Preferences facade (Categories collection only — dump attestation). */
export class Preferences {
  readonly Categories: PreferenceCategories;
  constructor(keys?: string[]) {
    this.Categories = makePreferenceCategories(keys);
  }
}

export const PREFERENCE_CATEGORY_KEYS: readonly string[] = dump.categories as string[];
export const PREFERENCE_CATEGORY_SAMPLE_KEYS: readonly string[] = dump.sample_keys as string[];
