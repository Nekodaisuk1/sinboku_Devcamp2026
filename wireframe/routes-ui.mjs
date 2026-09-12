import {routesForDomain, deferralTimeline, mathSpread, decisionPoints} from './routes.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

const stageLabels = {
  goal: '学問・研究',
  university: '大学・学部',
  course: '高校の中の選択',
  highschool: '高校',
  now: 'いま'
};

const universityCandidateMarkup = (candidate, className) => `<li class="${className}">
  <span>${escape(candidate.route.kindName)}</span>
  <a href="${escape(candidate.step.link.url)}" target="_blank" rel="noopener noreferrer">${escape(candidate.step.title)} ↗</a>
</li>`;

/** 大学・学部候補は経路をまたいだ1グループにし、最初の4件より先だけを任意展開にする。 */
export function renderUniversityCandidates(routes, limit = 4) {
  const candidates = routes.map(route => ({route, step: route.steps.find(step => step.stage === 'university' && step.link)})).filter(item => item.step);
  if (!candidates.length) return '';
  const lead = candidates.slice(0, limit);
  const rest = candidates.slice(limit);
  return `<section class="route-university-group" aria-labelledby="route-university-title">
    <h3 id="route-university-title">大学・学部候補 <span>${candidates.length}件</span></h3>
    <p>経路ごとの候補をまとめて表示しています。大学名から公式ページを開けます。</p>
    <ul>${lead.map(candidate => universityCandidateMarkup(candidate, 'candidate-primary')).join('')}</ul>
    ${rest.length ? `<details><summary>ほか${rest.length}件を広げる</summary><ul>${rest.map(candidate => universityCandidateMarkup(candidate, 'candidate-more')).join('')}</ul></details>` : ''}
  </section>`;
}

function stepMarkup(step) {
  const point = step.decision ? decisionPoints[step.decision] : null;
  return `<li class="route-step route-step-${step.stage}">
    <div class="route-step-mark" aria-hidden="true"></div>
    <div class="route-step-body">
      <p class="route-stage">${escape(stageLabels[step.stage])}</p>
      <h4>${escape(step.title)}</h4>
      <p class="route-step-detail">${escape(step.detail)}</p>
      ${step.note ? `<p class="route-step-note">${escape(step.note)}</p>` : ''}
      ${point ? `<p class="route-defer"><span>保留できる期限</span><strong>${escape(point.defer)}</strong></p><details class="route-defer-detail"><summary>${escape(point.name)}とは</summary><p>${escape(point.detail)}</p></details>` : ''}
      ${step.link ? `<a class="route-source" href="${escape(step.link.url)}" target="_blank" rel="noopener noreferrer">${escape(step.link.name)} ↗</a><small>出典 ${escape(step.link.source)}</small>` : ''}
    </div>
  </li>`;
}

function routeMarkup(route, saved) {
  const university = route.steps.find(step => step.stage === 'university');
  return `<article class="route-card" id="route-${escape(route.id)}">
    <header class="route-head">
      <p class="route-kind">経路${route.order}</p>
      <h3>${escape(route.kindName)}</h3>
      <p class="route-kind-summary">${escape(route.kindSummary)}</p>
      <p class="route-why">${escape(route.why)}</p>
      <p class="route-math"><span>必要な数学</span><strong>${escape(route.math.label)}</strong><small>${escape(route.math.summary)}</small></p>
    </header>
    ${university?.link ? `<a class="route-detail" href="${escape(university.link.url)}" target="_blank" rel="noopener noreferrer">この経路の大学・学部を公式ページで見る：${escape(university.title)} ↗</a>` : ''}
    <ol class="route-steps">${route.steps.map(stepMarkup).join('')}</ol>
    <footer class="route-foot">
      <button class="text-button" data-route-math="${escape(route.id)}">数学の中身をもう少し見る</button>
      <button class="secondary" data-route-hold="${escape(route.id)}" aria-pressed="${saved.has(route.id)}">${saved.has(route.id) ? '✓ 見返す経路にした' : 'あとで見返す経路にする'}</button>
    </footer>
    <p class="route-math-detail" id="route-math-${escape(route.id)}" hidden>${escape(route.math.detail)}</p>
  </article>`;
}

function comparisonMarkup(routes) {
  const rows = [
    ['経路の特徴', route => route.kindSummary],
    ['この道で扱うこと', route => route.why],
    ['必要な数学', route => route.math.label],
    ['高校の段階で決まること', route => route.steps.find(step => step.stage === 'course').title],
    ['高校で選ぶもの', route => route.steps.find(step => step.stage === 'highschool').title],
    ['大学・学部の例', route => route.steps.find(step => step.stage === 'university').title]
  ];
  return `<div class="route-table-scroll" tabindex="0" role="region" aria-label="経路の違いを比べる表。横にスクロールできます">
    <table class="route-table">
      <thead><tr><th scope="col">比べる内容</th>${routes.map(route => `<th scope="col"><a href="#route-${escape(route.id)}">${escape(route.kindName)}</a></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, pick]) => `<tr><th scope="row">${escape(label)}</th>${routes.map(route => `<td>${escape(pick(route))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function timelineMarkup() {
  return `<section class="deferral-board" aria-label="分岐点ごとの保留できる期限">
    <h2>この先の分岐点は、いつまで保留できるか</h2>
    <p class="deferral-lead">今日決めなければならないのは、いちばん下の1つだけです。上の3つは、まだ決める段階ではありません。</p>
    <ol class="deferral-list">${deferralTimeline().map(point => `<li><div><p class="deferral-name">${escape(point.name)}</p><p class="deferral-detail">${escape(point.detail)}</p></div><p class="deferral-defer">${escape(point.defer)}</p></li>`).join('')}</ol>
    <p class="deferral-note">公立高校の一般入試を想定した一般的な目安です。地域・学校・入試方式によって前後します。最終的な日程は自治体と学校の募集要項で確認してください。</p>
  </section>`;
}

export function renderRoutes({domainId, domain, saved, checkedOn}) {
  const routes = routesForDomain(domainId, domain);
  if (!routes.length) {
    return `<section class="route-empty"><h2>この学問の経路は、まだ用意できていません</h2><p>掲載している学問から選び直してください。掲載範囲の外であることを、この画面では隠しません。</p></section>`;
  }
  const spread = mathSpread(routes);
  return `<section class="route-intro">
      <p class="eyebrow">${escape(domain.name)} から逆に引く</p>
      <h2>${escape(domain.name)}にたどり着く道は、${routes.length}本あります。</h2>
      <p>それぞれ、高校の段階で決まることが違います。どれかが正解ということはありません。</p>
      ${spread.varies ? `<p class="route-ceiling"><span>数学の天井は、経路によって違う</span><strong>${escape(spread.lowest.label)} 〜 ${escape(spread.highest.label)}</strong><small>${escape(spread.lowest.summary)}／${escape(spread.highest.summary)}　同じ学問でも、扱う対象によって要求が変わります。</small></p>` : ''}
    </section>
    ${comparisonMarkup(routes)}
    ${renderUniversityCandidates(routes)}
    <div class="route-list">${routes.map(route => routeMarkup(route, saved)).join('')}</div>
    ${timelineMarkup()}
    <p class="route-disclaimer">経路の組み立てと、必要な数学の目安は本アプリの編集です。大学・学部・高専の情報は各公式サイト（確認 ${escape(checkedOn)}）にもとづきます。特定の高校からの進学実績を示すものではありません。学科の有無や入試科目は、必ず最新の募集要項で確認してください。</p>`;
}
