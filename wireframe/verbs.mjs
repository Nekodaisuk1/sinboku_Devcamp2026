import knowledge from './knowledge-data.mjs';

// 動詞は、興味（ゲーム・料理・音楽・海）と学問のあいだに置く層。
// 中学生がすでに持っている語彙から逆算を始めるための入口で、適性判定ではない。
export const verbs = knowledge.verbs;
export const domains = knowledge.domains;
export const topics = knowledge.topics;
export const resources = knowledge.resources;

export const verbById = id => verbs.find(verb => verb.id === id) || null;

export function allActivities() {
  return Object.values(knowledge.directions).flatMap(groups => groups.flatMap(group => group.activities));
}

/**
 * ある動詞でできる活動アイデア。興味で絞れるが、絞らなければ興味をまたいで並ぶ。
 * ゲームの「つくる」と料理の「つくる」が同じ場所に出ることが、この層の目的。
 */
export function activitiesForVerb(verbId, {topic = null, athome = false} = {}) {
  return allActivities().filter(activity =>
    activity.verb === verbId &&
    (topic === null || activity.topic === topic) &&
    (!athome || activity.athome));
}

// 活動を興味ごとにまとめる。1つの動詞が複数の興味に着地することを見せるため。
export function activitiesByTopic(verbId, options = {}) {
  const grouped = new Map();
  for (const activity of activitiesForVerb(verbId, options)) {
    if (!grouped.has(activity.topic)) grouped.set(activity.topic, []);
    grouped.get(activity.topic).push(activity);
  }
  return [...grouped].map(([topic, items]) => ({topic, label: topics[topic]?.label || topic, items}));
}

export const activityById = id => allActivities().find(activity => activity.id === id) || null;

// 活動は動詞だけでなく、属している活動グループの文脈で学問につながる。
// たとえば音楽の「観察する」を、観察という語だけで生態学へ広げない。
export function domainsForActivity(activityId) {
  for (const groups of Object.values(knowledge.directions)) {
    for (const group of groups) {
      if (group.activities.some(activity => activity.id === activityId)) return [...group.domains];
    }
  }
  return [];
}

// この動詞を扱う学問。ここから routes.mjs の逆引きにつながる。
export function domainsForVerb(verbId) {
  const verb = verbById(verbId);
  if (!verb) return [];
  return verb.domains.map(id => ({id, ...domains[id]}));
}

export function resourcesForVerb(verbId, {athome = false} = {}) {
  return Object.entries(resources)
    .filter(([, resource]) => resource.verbs?.includes(verbId) && (!athome || (resource.online && resource.free)))
    .map(([id, resource]) => ({id, ...resource}));
}

// 掲載が薄い場所を隠さない。件数はそのまま表示に使う。
export function verbCoverage(verbId) {
  return {
    activities: activitiesForVerb(verbId).length,
    athome: activitiesForVerb(verbId, {athome: true}).length,
    resources: resourcesForVerb(verbId).length,
    domains: domainsForVerb(verbId).length
  };
}
