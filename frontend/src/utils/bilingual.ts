/**
 * Bilingual Urdu-English product names and financial helpers
 */

const URDU_DICTIONARY: Record<string, string> = {
  // Poly & Bags
  '30/s poly': '۳۰/ایس پولی بیگ',
  '50/s poly': '۵۰/ایس پولی بیگ',
  'plastic bag': 'پلاسٹک بیگ',
  'shopping bag': 'شاپنگ بیگ / تھیلی',
  'poly bag': 'پولی بیگ',
  'd-cut': 'ڈی کٹ بیگ',
  'w-cut': 'ڈبلیو کٹ بیگ',
  'garbage bag': 'کچرا بیگ / ڈسٹ بن بیگ',
  'zipper bag': 'زپر بیگ',
  'zipper': 'زپر بیگ',
  'shopper': 'شاپر / شاپنگ بیگ',
  'lifafa': 'لفافہ',
  'karela': 'کریلا بیگ',

  // Rolls & Sheets
  'plastic roll': 'پلاسٹک رول',
  'roll': 'پلاسٹک رول',
  'plastic sheet': 'پلاسٹک شیٹ',
  'sheet': 'پلاسٹک شیٹ',

  // Bottles, Jars & Containers
  'mayo bottle': 'میو بوتل',
  'mayo': 'میو بوتل',
  'bottle': 'پلاسٹک بوتل',
  'plastic bottle': 'پلاسٹک بوتل',
  'jar': 'پلاسٹک جار',
  'plastic jar': 'پلاسٹک جار',
  'cup': 'پلاسٹک کپ',
  'container': 'پلاسٹک کنٹینر',
  'box': 'ڈبہ / باکس',

  // Raw Materials & Packaging Supplies
  'granules': 'پلاسٹک دانہ',
  'dana': 'پلاسٹک دانہ',
  'plastic dana': 'پلاسٹک دانہ',
  'packaging': 'پیکجنگ مٹیریل',
  'packing': 'پیکنگ مٹیریل',
  'tape': 'پیکنگ ٹیپ',
  'dori carton': 'ڈوری کارٹن',
  'dori': 'ڈوری',
  'carton': 'کارٹن',
  'tissue': 'ٹشو پیپر',
  'rubber band': 'ربڑ بینڈ',
  'paper soap': 'پیپر صابن',
  'newspaper': 'اخبار / ریپنگ پیپر',
  'korean newspaper': 'کورین اخبار',
};

export function getUrduProductName(name?: string, nameUrdu?: string, _category?: string): string {
  // 1. Explicit user/database provided Urdu name
  if (nameUrdu && nameUrdu.trim()) {
    return nameUrdu.trim();
  }

  if (!name || !name.trim()) return '';

  const cleanName = name.toLowerCase().trim();

  // 2. Direct dictionary match
  if (URDU_DICTIONARY[cleanName]) {
    return URDU_DICTIONARY[cleanName];
  }

  // 3. Match keys in dictionary (prefer longest keys first to match specific phrases)
  const sortedKeys = Object.keys(URDU_DICTIONARY).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    // Check if word boundary matches (e.g. "mayo - 150ml" matches "mayo", but "controller" doesn't match "roll")
    const regex = new RegExp(`(^|[^a-z0-9])${key}([^a-z0-9]|$)`, 'i');
    if (regex.test(cleanName)) {
      return URDU_DICTIONARY[key];
    }
  }

  // 4. If no accurate translation is known, return empty string so no false translation is displayed
  return '';
}
