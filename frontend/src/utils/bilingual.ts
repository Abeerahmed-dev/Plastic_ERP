/**
 * Bilingual Urdu-English product names and financial helpers
 */

const URDU_DICTIONARY: Record<string, string> = {
  // Categories & standard plastics
  '30/s poly': '۳۰/ایس پولی بیگ',
  '50/s poly': '۵۰/ایس پولی بیگ',
  'plastic bag': 'پلاسٹک بیگ',
  'shopping bag': 'شاپنگ بیگ / تھیلی',
  'poly bag': 'پولی بیگ',
  'roll': 'پلاسٹک رول',
  'plastic roll': 'پلاسٹک رول',
  'sheet': 'پلاسٹک شیٹ',
  'plastic sheet': 'پلاسٹک شیٹ',
  'granules': 'پلاسٹک دانہ',
  'dana': 'پلاسٹک دانہ',
  'packaging': 'پیکجنگ مٹیریل',
  'd-cut': 'ڈی کٹ بیگ',
  'w-cut': 'ڈبلیو کٹ بیگ',
  'garbage bag': 'کچرا بیگ / ڈسٹ بن بیگ',
  'newspaper': 'اخبار / ریپنگ پیپر',
  'korean newspaper': 'کورین اخبار',
  'other': 'متفرق پلاسٹک',
};

export function getUrduProductName(name?: string, nameUrdu?: string, category?: string): string {
  if (nameUrdu && nameUrdu.trim()) {
    return nameUrdu.trim();
  }

  if (!name) return '';

  const cleanName = name.toLowerCase().trim();
  
  // Direct dictionary match
  if (URDU_DICTIONARY[cleanName]) {
    return URDU_DICTIONARY[cleanName];
  }

  // Partial match in dictionary
  for (const [key, val] of Object.entries(URDU_DICTIONARY)) {
    if (cleanName.includes(key)) {
      return val;
    }
  }

  // Category fallback
  if (category) {
    const cleanCat = category.toLowerCase().trim();
    if (URDU_DICTIONARY[cleanCat]) {
      return URDU_DICTIONARY[cleanCat];
    }
  }

  // Generic natural Urdu transliteration/fallback
  return name;
}
