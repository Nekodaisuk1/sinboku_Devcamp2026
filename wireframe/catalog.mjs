import knowledge from './knowledge-data.mjs';
import {allActivities} from './verbs.mjs';

export const CHECKED_ON = '2026-09-11';

export function normalizeQuery(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .trim();
}

function entries() {
  const {domains, topics, resources, verbs} = knowledge;
  return [
    ...verbs.map(verb => ({
      id: verb.id, type: 'verb', name: verb.label, summary: verb.summary,
      text: [verb.label, verb.summary, verb.detail]
    })),
    ...Object.entries(topics).map(([id, topic]) => ({
      id, type: 'topic', name: topic.label, summary: topic.root,
      text: [topic.label, topic.root, ...(topic.keywords || [])]
    })),
    ...allActivities().map(activity => ({
      id: activity.id, type: 'activity', name: activity.title, summary: activity.description,
      activity, text: [activity.title, activity.description, activity.label, topics[activity.topic]?.label || '']
    })),
    ...Object.entries(domains).map(([id, domain]) => ({
      id, type: 'domain', name: domain.name, summary: domain.summary,
      text: [domain.name, domain.summary, domain.question, ...domain.tags]
    })),
    ...Object.entries(resources).map(([id, resource]) => ({
      id, type: 'resource', name: resource.name, summary: resource.summary, resource,
      text: [resource.name, resource.summary, resource.reason, resource.kind,
             ...(resource.keywords || []),
             ...resource.domains.map(key => domains[key].name)]
    }))
  ];
}

/**
 * 掲載範囲のなかだけを検索する。該当がなければ0件と表示し、近い候補を捏造しない。
 * filter: all | home（家で無料でできる）| activity（やってみる）| study（学校・大学）
 */
export function searchCatalog(query, filter = 'all') {
  const terms = normalizeQuery(query).split(/\s+/).filter(Boolean);
  return entries().filter(entry => {
    if (filter === 'home' && !(entry.activity?.athome || (entry.resource?.online && entry.resource?.free))) return false;
    if (filter === 'activity' && !(entry.activity || ['try', 'continue'].includes(entry.resource?.group))) return false;
    if (filter === 'study' && entry.resource?.group !== 'study') return false;
    if (!terms.length) return true;
    const text = normalizeQuery(entry.text.join(' '));
    return terms.every(term => text.includes(term));
  }).map(entry => ({
    ...entry,
    score: terms.reduce((score, term) => score + (normalizeQuery(entry.name).includes(term) ? 2 : 1), 0)
  })).sort((a, b) => b.score - a.score);
}

export function catalogIds() {
  return {
    resources: new Set(Object.keys(knowledge.resources)),
    verbs: new Set(knowledge.verbs.map(verb => verb.id)),
    activities: new Set(allActivities().map(activity => activity.id)),
    domains: new Set(Object.keys(knowledge.domains))
  };
}
