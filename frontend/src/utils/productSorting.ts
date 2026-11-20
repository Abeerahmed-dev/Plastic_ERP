/**
 * Natural dimensional parsing and sorting for products with sizes (e.g. 8x11, 9x11, 10x14, 9x15).
 * Ensures numerical sequence instead of lexical string sorting (so 8x11 comes before 9x11 and 10x14).
 */

export function parseDimension(sizeStr: string | null | undefined): [number, number, string] {
  if (!sizeStr || typeof sizeStr !== 'string') {
    return [Infinity, Infinity, ''];
  }
  const cleaned = sizeStr.trim();

  // Match standard dimensions: "8x11", "8*11", "8 x 11", "8.5x11", "8X11", "8×11"
  const dimMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/);
  if (dimMatch) {
    const width = parseFloat(dimMatch[1]);
    const length = parseFloat(dimMatch[2]);
    return [isNaN(width) ? Infinity : width, isNaN(length) ? Infinity : length, cleaned.toLowerCase()];
  }

  // Single number fallback: "25kg", "25", "100"
  const singleMatch = cleaned.match(/^(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const num = parseFloat(singleMatch[1]);
    return [isNaN(num) ? Infinity : num, Infinity, cleaned.toLowerCase()];
  }

  return [Infinity, Infinity, cleaned.toLowerCase()];
}

export function compareProductSizes(aSize: string | null | undefined, bSize: string | null | undefined): number {
  const [wA, hA, rawA] = parseDimension(aSize);
  const [wB, hB, rawB] = parseDimension(bSize);

  if (wA !== wB) return wA - wB;
  if (hA !== hB) return hA - hB;
  return rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: 'base' });
}

export function compareProducts<T extends { name: string; size?: string | null }>(a: T, b: T): number {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA !== nameB) {
    return nameA.localeCompare(nameB);
  }
  return compareProductSizes(a.size, b.size);
}

/**
 * Standard product title formatter matching:
 * Abid Gold(8x11)
 * Abid Gold(9x11)
 * Abid Gold(10x14)
 */
export function formatProductTitle(name: string, size?: string | null): string {
  const cleanName = (name || '').trim();
  const cleanSize = (size || '').trim();
  if (!cleanSize) return cleanName;
  return `${cleanName}(${cleanSize})`;
}

/**
 * Pick a clean canonical display label for a group of names sharing the same case-insensitive key.
 * Prefers an all-uppercase label (e.g. 'PP', 'HDPE', 'LDPE') if present,
 * then a Title Case / capitalized label (e.g. 'Abid Gold'),
 * falling back to the first non-empty trimmed name encountered.
 */
export function pickCanonicalGroupName(names: string[]): string {
  if (!names || names.length === 0) return '';
  const trimmed = names.map((n) => (n || '').trim()).filter(Boolean);
  if (trimmed.length === 0) return '';

  // 1. Prefer all-uppercase if it contains at least one letter (e.g. 'PP', 'HDPE')
  const allUpper = trimmed.find((n) => /[A-Z]/.test(n) && n === n.toUpperCase());
  if (allUpper) return allUpper;

  // 2. Prefer capitalized / Title Case (starts with capital letter)
  const titleCase = trimmed.find((n) => /^[A-Z]/.test(n));
  if (titleCase) return titleCase;

  // 3. Fallback to first encountered
  return trimmed[0];
}

export interface NormalizedProductGroup<T> {
  key: string;       // Normalized grouping key (e.g. "pp")
  name: string;      // Canonical display label (e.g. "PP")
  variants: T[];     // Dimensionally sorted variants
}

/**
 * Group products by their normalized (trimmed and case-insensitive) name.
 * Collapses variants such as 'pp', 'Pp', and 'PP' into a single canonical entry (e.g. 'PP')
 * while preserving all variant records and natural dimensional sorting.
 */
export function groupProductsByFamily<T extends { name: string; size?: string | null }>(
  products: T[]
): Record<string, NormalizedProductGroup<T>> {
  const map = new Map<string, { rawNames: string[]; variants: T[] }>();

  for (const p of products || []) {
    if (!p) continue;
    const rawName = (p.name || '').trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();

    let entry = map.get(key);
    if (!entry) {
      entry = { rawNames: [], variants: [] };
      map.set(key, entry);
    }
    entry.rawNames.push(rawName);
    entry.variants.push(p);
  }

  const result: Record<string, NormalizedProductGroup<T>> = {};
  for (const [key, entry] of map.entries()) {
    result[key] = {
      key,
      name: pickCanonicalGroupName(entry.rawNames),
      variants: [...entry.variants].sort(compareProducts),
    };
  }

  return result;
}
