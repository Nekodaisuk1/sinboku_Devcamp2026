export const SCHOOL_RECORD_LIMIT = 200;
export const SCHOOL_REASON_LIMIT = 240;

const schoolStages = new Set(['university', 'highschool']);

export function schoolId(url, label) {
  if (typeof url !== 'string' || !/^https:\/\//.test(url) || typeof label !== 'string' || !label.trim()) throw new Error('Invalid school reference');
  return `school-${encodeURIComponent(url)}-${encodeURIComponent(label.trim())}`;
}

export function toggleSchoolMark(marks, id) {
  return marks.includes(id) ? marks.filter(item => item !== id) : [...marks, id];
}

function validateSchoolRecord(record, catalog, kind) {
  if (!record || typeof record !== 'object') throw new Error(`Invalid school ${kind}`);
  if (!catalog.schools.has(record.schoolId)) throw new Error('Unknown school');
  if (typeof record.label !== 'string' || !record.label.trim() || record.label.length > 160) throw new Error('Invalid school label');
  if (!schoolStages.has(record.stage) || typeof record.domain !== 'string') throw new Error('Invalid school context');
  if (typeof record.url !== 'string' || !/^https:\/\//.test(record.url)) throw new Error('Invalid school URL');
  return {...record};
}

export function validateSchoolMarks(marks, catalog) {
  if (!Array.isArray(marks) || marks.length > SCHOOL_RECORD_LIMIT) throw new Error('Invalid school marks');
  if (!marks.every(id => typeof id === 'string' && catalog.schools.has(id))) throw new Error('Unknown school mark');
  return [...new Set(marks)];
}

export function validateSchoolDismissals(records, catalog) {
  if (!Array.isArray(records) || records.length > SCHOOL_RECORD_LIMIT) throw new Error('Invalid school dismissals');
  return records.map(record => {
    const value = validateSchoolRecord(record, catalog, 'dismissal');
    if (typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > SCHOOL_REASON_LIMIT) throw new Error('Invalid school dismissal reason');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) throw new Error('Invalid school dismissal date');
    return value;
  });
}

export function validateSchoolViews(records, catalog) {
  if (!Array.isArray(records) || records.length > SCHOOL_RECORD_LIMIT) throw new Error('Invalid school views');
  return records.map(record => {
    const value = validateSchoolRecord(record, catalog, 'view');
    if (typeof value.viewedAt !== 'string' || Number.isNaN(Date.parse(value.viewedAt))) throw new Error('Invalid school view date');
    return value;
  });
}

export function dismissSchool(records, school, {reason, date}) {
  const cleanReason = String(reason ?? '').trim();
  if (!cleanReason) throw new Error('候補から外す理由を書いてください。');
  if (cleanReason.length > SCHOOL_REASON_LIMIT) throw new Error(`理由は${SCHOOL_REASON_LIMIT}文字以内で書いてください。`);
  const next = {...school, reason: cleanReason, date};
  return [next, ...records.filter(item => item.schoolId !== school.schoolId)].slice(0, SCHOOL_RECORD_LIMIT);
}

export function recordSchoolView(records, school, viewedAt) {
  return [{...school, viewedAt}, ...records.filter(item => item.schoolId !== school.schoolId)].slice(0, SCHOOL_RECORD_LIMIT);
}

export function formatSchoolViewTime(viewedAt) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(viewedAt));
}
