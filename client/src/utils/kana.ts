// Hepburn romanization for the hiragana used in the reading/writing lessons.
// Longer (digraph) keys are listed first so the tokenizer can greedy-match
// them before falling back to single-character mora.
const KANA_TO_ROMAJI: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",

  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "i", ゑ: "e", を: "wo",
  ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  っ: "",
};

const MAX_KEY_LENGTH = Math.max(...Object.keys(KANA_TO_ROMAJI).map((k) => k.length));

/**
 * Converts a hiragana string (typically a single drag-and-drop tile) into its
 * romaji reading. Falls back to returning the original text untouched for
 * any characters that aren't recognized hiragana (e.g. already-romanized
 * tiles, punctuation).
 */
export function kanaToRomaji(kana: string): string {
  let result = "";
  let i = 0;

  while (i < kana.length) {
    let matched = false;

    for (let len = Math.min(MAX_KEY_LENGTH, kana.length - i); len >= 1; len--) {
      const chunk = kana.slice(i, i + len);
      if (chunk in KANA_TO_ROMAJI) {
        result += KANA_TO_ROMAJI[chunk];
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += kana[i];
      i++;
    }
  }

  return result;
}

export function kanaTilesToRomaji(tiles: string[]): string[] {
  return tiles.map((tile) => kanaToRomaji(tile));
}
