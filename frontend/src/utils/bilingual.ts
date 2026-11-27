/**
 * Bilingual Urdu-English product names and automatic phonetic transliterator
 */

const URDU_DICTIONARY: Record<string, string> = {
  // Categories & standard plastics
  '30/s poly': '۳۰/ایس پولی بیگ',
  '50/s poly': '۵۰/ایس پولی بیگ',
  'plastic bag': 'پلاسٹک بیگ',
  'shopping bag': 'شاپنگ بیگ / تھیلی',
  'poly bag': 'پولی بیگ',
  'd-cut': 'ڈی کٹ بیگ',
  'w-cut': 'ڈبلیو کٹ بیگ',
  'garbage bag': 'کچرا بیگ / ڈسٹ بن بیگ',
  'other': 'متفرق پلاسٹک',
  'zipper bag': 'زپر بیگ',
  'zipper': 'زپر بیگ',
  'shopper': 'شاپر / شاپنگ بیگ',
  'lifafa': 'لفافہ',
  'karela': 'کریلا بیگ',
  'bag': 'بیگ',
  'bags': 'بیگز',
  'shopping': 'شاپنگ',
  'poly': 'پولی',
  'polythene': 'پولی تھین',

  // Rolls & Sheets
  'plastic roll': 'پلاسٹک رول',
  'roll': 'پلاسٹک رول',
  'plastic sheet': 'پلاسٹک شیٹ',
  'sheet': 'پلاسٹک شیٹ',
  'jali': 'جالی',
  'net': 'نیٹ',

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
  'can': 'کین',
  'drum': 'ڈرم',
  'balti': 'بالٹی',
  'tub': 'ٹب',
  'cap': 'کیپ / ڈھکن',
  'dhakkan': 'ڈھکن',
  'handle': 'ہینڈل',

  // Raw Materials & Packaging Supplies
  'granules': 'پلاسٹک دانہ',
  'dana': 'پلاسٹک دانہ',
  'plastic dana': 'پلاسٹک دانہ',
  'dana plastic': 'پلاسٹک دانہ',
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
  'paper': 'پیپر',
  'board': 'بورڈ',
  'pipe': 'پائپ',
  'patti': 'پٹی',
  'bora': 'بورا',

  // Metals & Scrap
  'loha - tamba': 'لوہا - تانبا',
  'loha': 'لوہا',
  'iron': 'لوہا',
  'tamba': 'تانبا',
  'copper': 'تانبا',
  'pital': 'پیتل',
  'brass': 'پیتل',
  'silver': 'سلور',
  'aluminum': 'ایلومینیم',
  'scrap': 'اسکریپ',
  'kachra': 'کچرا',

  // Common Pakistani Brand Names, Models & Prefixes
  'abid': 'عابد',
  'gold': 'گولڈ',
  'golden': 'سنہری',
  'ali': 'علی',
  'ahmed': 'احمد',
  'khan': 'خان',
  'bismillah': 'بسم اللہ',
  'raza': 'رضا',
  'tahir': 'طاہر',
  'tariq': 'طارق',
  'iqbal': 'اقبال',
  'sabir': 'صابر',
  'safwan': 'صفوان',
  'usman': 'عثمان',
  'bilal': 'بلال',
  'hassan': 'حسن',
  'hussain': 'حسین',
  'malik': 'ملک',
  'rana': 'رانا',
  'sheikh': 'شیخ',
  'siddiqui': 'صدیقی',
  'al': 'ال',
  'madina': 'مدینہ',
  'makkah': 'مکہ',
  'super': 'سپر',
  'royal': 'رائل',
  'star': 'اسٹار',
  'king': 'کنگ',
  'master': 'ماسٹر',
  'crown': 'کراؤن',
  'diamond': 'ڈائمنڈ',
  'deluxe': 'ڈیلکس',
  'special': 'اسپیشل',
  'prime': 'پرائم',
  'classic': 'کلاسک',
  'plus': 'پلس',
  'max': 'میکس',
  'mini': 'منی',
  'micro': 'مائیکرو',
  'heavy': 'ہیوی',
  'light': 'لائٹ',
  'double': 'ڈبل',
  'single': 'سنگل',
  'standard': 'اسٹینڈرڈ',
  'store': 'اسٹور',

  // Colors & Quality
  'white': 'سفید',
  'black': 'کالا',
  'red': 'لال',
  'blue': 'نیلا',
  'green': 'ہرا',
  'yellow': 'پیلا',
  'transparent': 'شفاف',
  'crystal': 'کرسٹل',
  'milky': 'ملکی',
  'natural': 'قدرتی',
  'pure': 'خالص',
  'grade': 'گریڈ',
  'virgin': 'ورجن',
  'recycled': 'ری سائیکل',

  // Customers, Cities & Transport Terms
  'walk-in': 'واک ان',
  'customer': 'کسٹمر',
  'walk-in customer': 'واک ان کسٹمر',
  'traders': 'ٹریڈرز',
  'trader': 'ٹریڈر',
  'plastic': 'پلاسٹک',
  'plastics': 'پلاسٹکس',
  'enterprise': 'انٹرپرائز',
  'enterprises': 'انٹرپرائزز',
  'brothers': 'برادرز',
  'sons': 'سنز',
  'company': 'کمپنی',
  'mart': 'مارٹ',
  'general': 'جنرل',
  'shop': 'شاپ',
  'muhammad': 'محمد',
  'mohammad': 'محمد',
  'abdul': 'عبدال',
  'haji': 'حاجی',
  'mian': 'میاں',
  'seth': 'سیٹھ',
  'shah': 'شاہ',
  'butt': 'بٹ',
  'chaudhry': 'چوہدری',
  'ansari': 'انصاری',
  'qureshi': 'قریشی',
  'memon': 'میمن',
  'shaikh': 'شیخ',
  'pak': 'پاک',
  'pakistan': 'پاکستان',
  'sindh': 'سندھ',
  'punjab': 'پنجاب',
  'karachi': 'کراچی',
  'hyderabad': 'حیدرآباد',
  'lahore': 'لاہور',
  'multan': 'ملتان',
  'faisalabad': 'فیصل آباد',
  'sukkur': 'سکھر',
  'mirpurkhas': 'میرپورخاص',
  'nawabshah': 'نوابشاہ',
  'larkana': 'لاڑکانہ',
  'transport': 'ٹرانسپورٹ',
  'goods': 'گڈز',
  'cargo': 'کارگو',
  'logistics': 'لاجسٹکس',
  'express': 'ایکسپریس',
  'truck': 'ٹرک',
  'suzuki': 'سوزوکی',
  'rickshaw': 'رکشہ',
  'raksha': 'رکشہ',
  'self': 'خود',
  'by hand': 'دستی',
  'adda': 'اڈا',
  'bus': 'بس',
  'courier': 'کوریئر',
  'tcs': 'ٹی سی ایس',
  'leopards': 'لیپرڈز',
};

function singleCharUrdu(c: string): string {
  const map: Record<string, string> = {
    a: 'ا', b: 'ب', c: 'ک', d: 'ڈ', e: 'ے', f: 'ف', g: 'گ', h: 'ہ',
    i: 'ی', j: 'ج', k: 'ک', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'پ',
    q: 'ق', r: 'ر', s: 'س', t: 'ٹ', u: 'و', v: 'و', w: 'و', x: 'کس',
    y: 'ی', z: 'ز'
  };
  return map[c] || c;
}

function phoneticTransliterateWord(word: string): string {
  const w = word.toLowerCase();
  let res = '';
  let i = 0;

  const multi: [string, string][] = [
    ['bismillah', 'بسم اللہ'],
    ['kh', 'خ'],
    ['gh', 'غ'],
    ['ch', 'چ'],
    ['chh', 'چھ'],
    ['sh', 'ش'],
    ['th', 'تھ'],
    ['ph', 'پھ'],
    ['bh', 'بھ'],
    ['dh', 'دھ'],
    ['jh', 'جھ'],
    ['rh', 'ڑھ'],
    ['oo', 'و'],
    ['ee', 'ی'],
    ['aa', i === 0 ? 'آ' : 'ا'],
    ['ai', i === 0 ? 'ائی' : 'ے'],
    ['au', 'او'],
    ['ck', 'ک'],
  ];

  while (i < w.length) {
    let matched = false;
    for (const [seq, urdu] of multi) {
      if (w.startsWith(seq, i)) {
        res += (seq === 'aa' ? (i === 0 ? 'آ' : 'ا') : urdu);
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const c = w[i];
    if (i === 0) {
      if (c === 'a') res += 'ا';
      else if (c === 'e' || c === 'i') res += 'ای';
      else if (c === 'o' || c === 'u') res += 'او';
      else res += singleCharUrdu(c);
    } else {
      res += singleCharUrdu(c);
    }
    i++;
  }
  return res;
}

function translateToken(token: string): string {
  const clean = token.toLowerCase();
  if (URDU_DICTIONARY[clean]) return URDU_DICTIONARY[clean];

  // Numbers, dimensions (8x11, 10x15), units (500g, 25kg) remain intact
  if (/^\d+[xX*]\d+$/.test(clean) || /^\d+$/.test(clean) || /^\d+[a-zA-Z]+$/.test(clean)) {
    return token;
  }

  return phoneticTransliterateWord(clean);
}

export function getUrduProductName(name?: string, nameUrdu?: string, _category?: string): string {
  // 1. Explicit user/database provided Urdu name
  if (nameUrdu && nameUrdu.trim()) {
    return nameUrdu.trim();
  }

  if (!name) return '';

  // 2. If name itself is already in Urdu/Arabic script, return it
  if (/[\u0600-\u06FF]/.test(name)) {
    return name.trim();
  }

  const clean = name.trim();
  const cleanLower = clean.toLowerCase();

  // 3. Exact full phrase match in dictionary
  if (URDU_DICTIONARY[cleanLower]) {
    return URDU_DICTIONARY[cleanLower];
  }

  // 4. Token-by-token smart conversion (preserving delimiters, numbers, sizes)
  return clean.split(/([\s\-_/]+)/).map((t) => {
    if (/^[\s\-_/]+$/.test(t)) return t;
    return translateToken(t);
  }).join('');
}

export const getUrduText = getUrduProductName;
