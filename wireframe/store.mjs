import {validateStances, validateGrade} from './timeline.mjs';
import {validateLog} from './log.mjs';
import {validatePlacements} from './field.mjs';
import {validatePrefecture} from './regions.mjs';
import {validateRecommendations} from './recommendations.mjs';
import {validateSchoolMarks, validateSchoolDismissals, validateSchoolViews} from './school-records.mjs';

export const STORAGE_KEY = 'shimboku.hub.v2';
// Build 18 までの保存形式。読み替えずに残す。黙って捨てたり上書きしたりしない。
export const LEGACY_KEY = 'shimboku.workspace.v1';
export const MARK_LIMIT = 200;
// 端末の保存に収まる大きさの上限。写真を足していくと際限なく育つので、
// 超えたら黙って止めず、ここで例外にして本人に伝える。
export const STATE_BYTES = 4 * 1024 * 1024;

export function emptyState() {
  return {grade: null, prefecture: null, stances: {}, log: [], placements: [], recommendations: [], marks: [], heldRoutes: [], schoolMarks: [], schoolDismissals: [], schoolViews: [], verb: null, expanded: false};
}

export function encodeState(state) {
  const json = JSON.stringify({
    version: 2,
    grade: state.grade ?? null,
    prefecture: state.prefecture ?? null,
    stances: state.stances,
    log: state.log,
    placements: state.placements,
    recommendations: state.recommendations ?? [],
    marks: [...state.marks],
    heldRoutes: [...state.heldRoutes],
    schoolMarks: [...(state.schoolMarks ?? [])],
    schoolDismissals: state.schoolDismissals ?? [],
    schoolViews: state.schoolViews ?? [],
    verb: state.verb ?? null,
    expanded: state.expanded === true
  });
  // 写真を足すと保存データが際限なく育つ。黙って保存が止まる（あるいは
  // 端末の容量エラーで落ちる）前に、ここで例外にして本人に伝える。
  if (json.length > STATE_BYTES) throw new Error('この端末に保存できる大きさを超えています。写真を減らすか、小さくしてください。');
  return json;
}

/**
 * 保存された記録を読み戻す。壊れていたら例外を投げ、呼び出し側が本人に伝える。
 * 知らないIDが混じっていた場合も黙って捨てず、読み込み自体を失敗させる。
 */
export function decodeState(raw, catalog) {
  const data = JSON.parse(raw);
  if (!data || data.version !== 2) throw new Error('この端末の記録は、いまのアプリとは別の形式です。');
  const marks = data.marks ?? [];
  if (!Array.isArray(marks) || marks.length > MARK_LIMIT) throw new Error('Invalid marks');
  if (!marks.every(id => typeof id === 'string' && catalog.resources.has(id))) throw new Error('Unknown marked resource');
  const heldRoutes = data.heldRoutes ?? [];
  if (!Array.isArray(heldRoutes) || heldRoutes.length > 100) throw new Error('Invalid held routes');
  if (!heldRoutes.every(id => typeof id === 'string' && catalog.routes.has(id))) throw new Error('Unknown route');
  const verb = data.verb ?? null;
  if (verb !== null && !catalog.verbs.has(verb)) throw new Error('Unknown verb');
  const placements = validatePlacements(data.placements, catalog);
  return {
    grade: validateGrade(data.grade),
    prefecture: validatePrefecture(data.prefecture),
    stances: validateStances(data.stances),
    placements,
    recommendations: validateRecommendations(data.recommendations, catalog),
    log: validateLog(data.log, {verbIds: catalog.verbs, activityIds: catalog.activities, placementIds: new Set(placements.map(item => item.id))}),
    marks: [...new Set(marks)],
    heldRoutes: [...new Set(heldRoutes)],
    schoolMarks: validateSchoolMarks(data.schoolMarks ?? [], catalog),
    schoolDismissals: validateSchoolDismissals(data.schoolDismissals ?? [], catalog),
    schoolViews: validateSchoolViews(data.schoolViews ?? [], catalog),
    verb,
    expanded: data.expanded === true
  };
}

export function hasLegacyRecord(storage) {
  try {
    return typeof storage?.getItem === 'function' && storage.getItem(LEGACY_KEY) !== null;
  } catch {
    return false;
  }
}
