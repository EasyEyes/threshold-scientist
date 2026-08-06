/**
 * @file Language metadata for the Test Font tool.
 *
 * One dropdown drives three things at once, because in the experiment they are
 * all consequences of the same choice of `fontLanguage`:
 *   - which shaperglot language the font is checked against,
 *   - the writing direction the text is shaped and measured in,
 *   - a starting `fontCharacterSet` to search for clipping.
 *
 * The character sets are the alphabets a psychophysics experiment normally
 * draws its targets and flankers from, not full orthographies: no digits,
 * punctuation, or combining marks, since those are not what EasyEyes samples.
 * They are a starting point the scientist is expected to replace with the
 * `fontCharacterSet` their own experiment uses.
 */

import { EASYEYES_SHAPERGLOT_LANGUAGE_IDS } from "../../../threshold/preprocess/easyeyesShaperglotLanguages";

const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CYRILLIC =
  "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const GREEK = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψω";
const HEBREW = "אבגדהוזחטיכךלמםנןסעפףצץקרשת";
const ARABIC = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
const PERSIAN = "ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی";
const URDU = "ابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنںوہھءیے";
const PASHTO = "ابپتټثجچحخڅځدډذرړزژږسشښصضطظعغفقکګلمنڼوهېیۍئ";
const UYGHUR = "ئابپتجچخدرزژسشغفقكلمنھوۇۆۈۋېىيگڭ";
const DEVANAGARI = "अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह";
const BENGALI = "অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ";
const GUJARATI = "અઆઇઈઉઊઋએઐઓઔકખગઘઙચછજઝઞટઠડઢણતથદધનપફબભમયરલવશષસહ";
const GURMUKHI = "ਅਆਇਈਉਊਏਐਓਔਕਖਗਘਙਚਛਜਝਞਟਠਡਢਣਤਥਦਧਨਪਫਬਭਮਯਰਲਵਸ਼ਸਹ";
const TAMIL = "அஆஇஈஉஊஎஏஐஒஓஔகஙசஞடணதநனபமயரலவழளறஸஷஹ";
const TELUGU = "అఆఇఈఉఊఋఎఏఐఒఓఔకఖగఘచఛజఝటఠడఢణతథదధనపఫబభమయరలవశషసహ";
const KANNADA = "ಅಆಇಈಉಊಋಎಏಐಒಓಔಕಖಗಘಚಛಜಝಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹ";
const MALAYALAM = "അആഇഈഉഊഋഎഏഐഒഓഔകഖഗഘങചഛജഝഞടഠഡഢണതഥദധനപഫബഭമയരലവശഷസഹ";
const THAI = "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const MYANMAR = "ကခဂဃငစဆဇဈညဋဌဍဎဏတထဒဓနပဖဗဘမယရလဝသဟဠအ";
const GEORGIAN = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ";
const ARMENIAN =
  "ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔՕՖաբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆ";
const TIBETAN = "ཀཁགངཅཆཇཉཏཐདནཔཕབམཙཚཛཝཞཟའཡརལཤསཧཨ";
const HANGUL = "가나다라마바사아자차카타파하각난달람밥삿앙잦찾칵탈팜핳";
// CJK has no alphabet to enumerate; these are characters chosen for vertical
// extent, which is what the metrics band is about. Ideographic scripts sit
// tidily inside the em box, so they are the benign case here.
const JAPANESE = "高黒亜安以宇永ぁぃっゃゅょアィッャュョ髙鬱";
const CHINESE_SIMPLIFIED = "高黑亮警鬱赢麵齐龘囊翻攀";
const CHINESE_TRADITIONAL = "高黑亮警鬱贏麵齊龘囊翻攀";

/** Languages written right to left; everything else is measured ltr. */
const RIGHT_TO_LEFT = new Set(["ar", "fa", "he", "ps", "ug", "ur"]);

/**
 * Codes `fontLanguage` accepts that mean the same thing as another code, and
 * so would only pad the menu. Each is dropped in favour of the spelling the
 * glossary's own fontPixiMetricsString default uses: script subtags over
 * region subtags, and "fil" over "tl".
 */
const ALIASES = new Set(["pt-PT", "tl", "zh-CN", "zh-TW"]);

interface LanguageDescriptor {
  name: string;
  characterSet?: string;
}

/**
 * English names for every code the `fontLanguage` parameter accepts, so the
 * dropdown reads as something other than a list of BCP 47 tags. Character sets
 * are attached per script; a language with none leaves the box for the
 * scientist to fill from their own experiment.
 */
const LANGUAGES: Record<string, LanguageDescriptor> = {
  af: { name: "Afrikaans", characterSet: LATIN },
  ar: { name: "Arabic", characterSet: ARABIC },
  az: { name: "Azerbaijani", characterSet: LATIN },
  be: { name: "Belarusian", characterSet: CYRILLIC },
  bg: { name: "Bulgarian", characterSet: CYRILLIC },
  bn: { name: "Bengali", characterSet: BENGALI },
  bo: { name: "Tibetan", characterSet: TIBETAN },
  ca: { name: "Catalan", characterSet: LATIN },
  cs: { name: "Czech", characterSet: LATIN },
  da: { name: "Danish", characterSet: LATIN },
  de: { name: "German", characterSet: LATIN },
  el: { name: "Greek", characterSet: GREEK },
  en: { name: "English", characterSet: LATIN },
  es: { name: "Spanish", characterSet: LATIN },
  eu: { name: "Basque", characterSet: LATIN },
  fa: { name: "Persian", characterSet: PERSIAN },
  fi: { name: "Finnish", characterSet: LATIN },
  fil: { name: "Filipino", characterSet: LATIN },
  fr: { name: "French", characterSet: LATIN },
  gsw: { name: "Swiss German", characterSet: LATIN },
  gu: { name: "Gujarati", characterSet: GUJARATI },
  ha: { name: "Hausa", characterSet: LATIN },
  he: { name: "Hebrew", characterSet: HEBREW },
  hi: { name: "Hindi", characterSet: DEVANAGARI },
  hr: { name: "Croatian", characterSet: LATIN },
  hu: { name: "Hungarian", characterSet: LATIN },
  hy: { name: "Armenian", characterSet: ARMENIAN },
  id: { name: "Indonesian", characterSet: LATIN },
  is: { name: "Icelandic", characterSet: LATIN },
  it: { name: "Italian", characterSet: LATIN },
  ja: { name: "Japanese", characterSet: JAPANESE },
  jv: { name: "Javanese", characterSet: LATIN },
  ka: { name: "Georgian", characterSet: GEORGIAN },
  kl: { name: "Greenlandic", characterSet: LATIN },
  kn: { name: "Kannada", characterSet: KANNADA },
  ko: { name: "Korean", characterSet: HANGUL },
  ky: { name: "Kyrgyz", characterSet: CYRILLIC },
  lt: { name: "Lithuanian", characterSet: LATIN },
  lv: { name: "Latvian", characterSet: LATIN },
  mk: { name: "Macedonian", characterSet: CYRILLIC },
  ml: { name: "Malayalam", characterSet: MALAYALAM },
  mn: { name: "Mongolian (Cyrillic)", characterSet: CYRILLIC },
  mr: { name: "Marathi", characterSet: DEVANAGARI },
  ms: { name: "Malay", characterSet: LATIN },
  mt: { name: "Maltese", characterSet: LATIN },
  my: { name: "Burmese", characterSet: MYANMAR },
  ne: { name: "Nepali", characterSet: DEVANAGARI },
  nl: { name: "Dutch", characterSet: LATIN },
  no: { name: "Norwegian (Bokmål)", characterSet: LATIN },
  pa: { name: "Punjabi (Gurmukhi)", characterSet: GURMUKHI },
  pcm: { name: "Nigerian Pidgin", characterSet: LATIN },
  pl: { name: "Polish", characterSet: LATIN },
  ps: { name: "Pashto", characterSet: PASHTO },
  pt: { name: "Portuguese", characterSet: LATIN },
  "pt-PT": { name: "Portuguese (Portugal)", characterSet: LATIN },
  ro: { name: "Romanian", characterSet: LATIN },
  ru: { name: "Russian", characterSet: CYRILLIC },
  sk: { name: "Slovak", characterSet: LATIN },
  sl: { name: "Slovenian", characterSet: LATIN },
  sq: { name: "Albanian", characterSet: LATIN },
  sr: { name: "Serbian", characterSet: CYRILLIC },
  sv: { name: "Swedish", characterSet: LATIN },
  sw: { name: "Swahili", characterSet: LATIN },
  ta: { name: "Tamil", characterSet: TAMIL },
  te: { name: "Telugu", characterSet: TELUGU },
  th: { name: "Thai", characterSet: THAI },
  tl: { name: "Tagalog", characterSet: LATIN },
  tr: { name: "Turkish", characterSet: LATIN },
  ug: { name: "Uyghur", characterSet: UYGHUR },
  uk: { name: "Ukrainian", characterSet: CYRILLIC },
  ur: { name: "Urdu", characterSet: URDU },
  uz: { name: "Uzbek", characterSet: LATIN },
  vi: { name: "Vietnamese", characterSet: LATIN },
  "zh-CN": { name: "Chinese (Simplified)", characterSet: CHINESE_SIMPLIFIED },
  "zh-Hans": {
    name: "Chinese (Simplified)",
    characterSet: CHINESE_SIMPLIFIED,
  },
  "zh-Hant": {
    name: "Chinese (Traditional)",
    characterSet: CHINESE_TRADITIONAL,
  },
  "zh-TW": { name: "Chinese (Traditional)", characterSet: CHINESE_TRADITIONAL },
};

export interface TestFontLanguage {
  /** The value fontLanguage would take, e.g. "fa" or "zh-Hans". */
  code: string;
  name: string;
  /** shaperglot / gflanguages id, e.g. "fa_Arab". */
  shaperglotId: string;
  direction: "ltr" | "rtl";
  characterSet: string;
}

/** Every language the tool offers, alphabetical by English name. */
export const testFontLanguages = (): TestFontLanguage[] =>
  Object.entries(LANGUAGES)
    .filter(([code]) => !ALIASES.has(code))
    .flatMap(([code, descriptor]) => {
      const shaperglotId = EASYEYES_SHAPERGLOT_LANGUAGE_IDS[code];
      if (!shaperglotId) return [];
      return [
        {
          code,
          name: descriptor.name,
          shaperglotId,
          direction: RIGHT_TO_LEFT.has(code)
            ? ("rtl" as const)
            : ("ltr" as const),
          characterSet: descriptor.characterSet ?? "",
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

export const findTestFontLanguage = (
  code: string,
): TestFontLanguage | undefined =>
  testFontLanguages().find((language) => language.code === code);
