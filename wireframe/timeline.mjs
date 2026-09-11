import {decisionPoints} from './routes.mjs';

// 7年の地図の骨。分岐点そのものは routes.mjs の decisionPoints を出典とし、
// ここではそれが「いつ来るか」だけを足す。日程は公立の一般入試を想定した目安。
// 学年は日本の学校年度（4月始まり）を前提にする。
export const GRADES = [
  {id:'j1', label:'中1', index:0},
  {id:'j2', label:'中2', index:1},
  {id:'j3', label:'中3', index:2},
  {id:'h1', label:'高1', index:3},
  {id:'h2', label:'高2', index:4},
  {id:'h3', label:'高3', index:5},
  {id:'u1', label:'大学1年', index:6},
  {id:'u2', label:'大学2年', index:7}
];

// 未来が上、今が下。routes.mjs の段の並びと向きをそろえる。
export const STAGES = [
  {decision:'lab',        grade:7, month:4,  horizon:'この先'},
  {decision:'faculty',    grade:5, month:7,  horizon:'高校のあいだ'},
  {decision:'course',     grade:3, month:11, horizon:'高校に入ってから'},
  {decision:'highschool', grade:2, month:12, horizon:'いちばん近い'}
];

export const STANCE_LIMIT = 60;

export function gradeById(id) {
  return GRADES.find(grade => grade.id === id) || null;
}

// 年度の開始年。4月より前は前年度に属する。
export function schoolYearStart(today) {
  return today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
}

// 学年が分かっているときだけ、分岐点の暦上の時期を出す。分からなければ null。
export function stageWhen(stage, gradeId, today) {
  const grade = gradeById(gradeId);
  if (!grade) return null;
  const yearStart = schoolYearStart(today) + (stage.grade - grade.index);
  const year = stage.month >= 4 ? yearStart : yearStart + 1;
  const months = (year - today.getFullYear()) * 12 + (stage.month - (today.getMonth() + 1));
  return {year, month: stage.month, months};
}

/**
 * 7年の地図の段を、未来から今の順に組み立てる。
 * 学年を教えていない場合は期限の目安だけを出し、残り月数は出さない。
 * 「次に来る分岐点」は1つだけで、それ以外は future か past になる。
 */
export function buildTimeline({gradeId = null, stances = {}, today = new Date()} = {}) {
  const rungs = STAGES.map(stage => {
    const point = decisionPoints[stage.decision];
    const when = stageWhen(stage, gradeId, today);
    return {
      decision: stage.decision,
      name: point.name,
      defer: point.defer,
      detail: point.detail,
      horizon: stage.horizon,
      when,
      stance: typeof stances[stage.decision] === 'string' ? stances[stage.decision] : '',
      status: when === null ? 'unknown' : when.months < 0 ? 'past' : 'future'
    };
  });
  const upcoming = rungs.filter(rung => rung.status === 'future');
  if (upcoming.length) upcoming[upcoming.length - 1].status = 'next';
  return rungs;
}

// 今日いちばん近い分岐点。学年が未設定なら、いちばん下の段を返す。
export function nextDecision(timeline) {
  return timeline.find(rung => rung.status === 'next') || timeline[timeline.length - 1];
}

export function validateStances(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid stances');
  const known = new Set(STAGES.map(stage => stage.decision));
  const stances = {};
  for (const [decision, text] of Object.entries(value)) {
    if (!known.has(decision)) throw new Error('Unknown decision point');
    if (typeof text !== 'string' || text.length > STANCE_LIMIT) throw new Error('Invalid stance');
    if (text.trim()) stances[decision] = text;
  }
  return stances;
}

export function validateGrade(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!gradeById(value)) throw new Error('Unknown grade');
  return value;
}
