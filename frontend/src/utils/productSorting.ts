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
