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
  return `${cleanName} (${cleanSize})`;
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

/**
 * Formats a product's display size/variant for UI selectors by extracting only
 * the size/variant portion (e.g. "1x10" instead of "GGGG(1x10)").
 *
 * 1. Prefers dedicated `product.size` if present and non-empty.
 *    (Strips any wrapping parentheses e.g. "(1x10)" -> "1x10" or embedded name)
 * 2. Otherwise strips leading base/product name or group name from `product.name`
 *    and extracts the size within parentheses/brackets or trailing dimensions.
 * 3. Falls back to `product.name` only if no size can be extracted.
 */
export function formatSizeOnly(
  product?: { name?: string | null; size?: string | null; [key: string]: any } | null,
  groupName?: string | null
): string {
  if (!product) return '';

  // 1. First prefer dedicated product.size if it exists and is non-empty
  const rawSize = (product.size || '').trim();
  if (rawSize) {
    // If size contains parentheses (e.g. "(1x10)" or "GGGG(1x10)"), extract the inner size
    const parenInSize = rawSize.match(/\(([^)]+)\)/);
    if (parenInSize && parenInSize[1]?.trim()) {
      return parenInSize[1].trim();
    }
    // If group name is supplied and rawSize starts with it, strip it
    if (groupName && groupName.trim()) {
      const cleanGroup = groupName.trim().toLowerCase();
      if (rawSize.toLowerCase().startsWith(cleanGroup)) {
        const stripped = rawSize
          .slice(cleanGroup.length)
          .replace(/^[-–—:\s()]+/, '')
          .replace(/[-–—:\s()]+$/, '')
          .trim();
        if (stripped) return stripped;
      }
    }
    // Clean outer parentheses or quotes if any
    const cleanSize = rawSize.replace(/^\((.*)\)$/, '$1').trim();
    return cleanSize || rawSize;
  }

  // 2. Otherwise, strip leading product/base name from product.name
  const rawName = (product.name || '').trim();
  if (!rawName) return '';

  // Extract from parentheses: e.g. "GGGG(1x10)" -> "1x10", "Abid Gold (8x11)" -> "8x11"
  const parenMatch = rawName.match(/\(([^)]+)\)[^()]*$/);
  if (parenMatch && parenMatch[1]?.trim()) {
    return parenMatch[1].trim();
  }

  // Extract from square brackets: e.g. "GGGG[1x10]" -> "1x10"
  const bracketMatch = rawName.match(/\[([^\]]+)\][^[\]]*$/);
  if (bracketMatch && bracketMatch[1]?.trim()) {
    return bracketMatch[1].trim();
  }

  // If group name is supplied, strip it from the start of product.name
  if (groupName && groupName.trim()) {
    const cleanGroup = groupName.trim().toLowerCase();
    if (rawName.toLowerCase().startsWith(cleanGroup)) {
      const remainder = rawName
        .slice(cleanGroup.length)
        .replace(/^[-–—:\s()]+/, '')
        .replace(/[-–—:\s()]+$/, '')
        .trim();
      if (remainder) {
        return remainder;
      }
    }
  }

  // Check for trailing dimension or size pattern: e.g. "GGGG 1x10", "Poly 10 x 14", "Film 25kg"
  const dimMatch = rawName.match(/(\d+(?:\.\d+)?\s*[*xX×]\s*\d+(?:\.\d+)?(?:\s*[a-zA-Z]+)?)$/);
  if (dimMatch && dimMatch[1]?.trim()) {
    return dimMatch[1].trim();
  }

  // 3. Fallback to product.name only if no size can be extracted
  return rawName;
}

