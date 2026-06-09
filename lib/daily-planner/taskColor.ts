export type TaskColorKey =
  | "prayer"
  | "sleep"
  | "work"
  | "exercise"
  | "food"
  | "family"
  | "default";

const PRAYER_RE =
  /tahajjud|fajr|dhuhr|zuhr|asr|maghrib|isha|namaz|salah|salat|quran|surah|adhkar|dhikr|jamaat|masjid|mosque|prayer|dua|tafseer|tafsir|reflection|witr/i;
const SLEEP_RE = /sleep|nap|rest|bed|wake/i;
const WORK_RE =
  /work|meeting|project|code|coding|study|research|deep.work|focus|review|email|business|productive|planning|session|client|call|standup/i;
const EXERCISE_RE =
  /gym|exercise|workout|run|running|walk|walking|jog|fitness|sports|yoga|swim|training|weights|lift/i;
const FOOD_RE =
  /meal|breakfast|lunch|dinner|food|eat|eating|cook|cooking|snack|coffee|tea|iftar|suhoor/i;
const FAMILY_RE =
  /family|kids|child|wife|husband|parent|friend|social|time together|quality time/i;

export function getTaskColor(title: string): TaskColorKey {
  if (PRAYER_RE.test(title)) return "prayer";
  if (SLEEP_RE.test(title)) return "sleep";
  if (EXERCISE_RE.test(title)) return "exercise";
  if (FOOD_RE.test(title)) return "food";
  if (FAMILY_RE.test(title)) return "family";
  if (WORK_RE.test(title)) return "work";
  return "default";
}
