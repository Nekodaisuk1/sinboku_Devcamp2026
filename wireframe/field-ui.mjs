import {convergenceSentence, sourceOf, contentOf} from './field.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

// 置いたものが上へ伸びる線。時間が上に流れるので、縦向きの曲線にする。
// app.js がドラッグ中に同じ式で線を引き直せるよう export する。
export function curve(from, to) {
  const x1 = from.left + from.w / 2;
  const y1 = from.y;
  const x2 = to.left + to.w / 2;
  const y2 = to.y + to.h;
  const mid = (y1 + y2) / 2;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${mid.toFixed(1)}, ${x2.toFixed(1)} ${mid.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// 段の地の部分（.lane グループ）。クリックで段を選べる部分だけをここに入れる。
function laneMarkup(lane, width, next) {
  return `<g class="lane lane-${lane.id}${lane.id === next ? ' lane-next' : ''}" role="button" tabindex="0" aria-label="${escape(lane.title)}、${escape(lane.horizon)}。内容を開く">
    <rect x="0" y="${lane.top}" width="${width}" height="${lane.height}" class="lane-bg"></rect>
    <line x1="0" y1="${lane.top}" x2="${width}" y2="${lane.top}" class="lane-rule"></line>
  </g>`;
}

// 段の見出しは線より後に描く。20件置くと線が何本も見出しの上を通り、読めなくなるため。
// 当たり判定は地の .lane が持っているので、ここは pointer-events を切る。
function laneLabelMarkup(lane, next) {
  return `<text x="14" y="${lane.top + 17}" class="lane-label lane-${lane.id}${lane.id === next ? ' lane-next' : ''}" aria-hidden="true">
    <tspan class="lane-title">${escape(lane.title)}</tspan><tspan class="lane-horizon" dx="8">${escape(lane.horizon)}</tspan>
  </text>`;
}

// 段の「広げる／まとめる」ピル。.lane の外に出すことで、段の選択クリックに巻き込まれないようにする。
function laneToggleMarkup(lane, width) {
  if ((lane.count ?? 0) < 2) return '';
  const label = lane.expanded ? 'まとめる' : '広げる';
  const w = Math.max(56, [...label].length * 13 + 24);
  const bodyH = 22;
  const hitH = 32; // 見た目は20px超でよいが、指で押す当たり判定は32px確保する
  const bodyY = lane.top + 4;
  const hitY = bodyY - (hitH - bodyH) / 2;
  const x = width - 14 - w;
  return `<g class="lane-toggle" data-expand-lane="${escape(lane.id)}" role="button" tabindex="0" aria-label="${escape(lane.title)}の時期を${label}">
    <rect x="${x.toFixed(1)}" y="${hitY.toFixed(1)}" width="${w}" height="${hitH}" class="lane-toggle-hit"></rect>
    <rect x="${x.toFixed(1)}" y="${bodyY.toFixed(1)}" width="${w}" height="${bodyH}" rx="${(bodyH / 2).toFixed(1)}" class="lane-toggle-body"></rect>
    <text x="${(x + w / 2).toFixed(1)}" y="${(bodyY + bodyH / 2 + 4).toFixed(1)}" text-anchor="middle" class="lane-toggle-label">${escape(label)}</text>
  </g>`;
}

// まとめノード。破線＋「ほか◯件」の文言で、置きものにも学問にも見えないようにする（色だけに意味を載せない）。
function clusterMarkup(node, {dimmed, laneTitle}) {
  const n = node.members.length;
  return `<g class="node node-cluster${dimmed ? ' is-dim' : ''}" data-node="${escape(node.id)}" data-expand-lane="${escape(node.lane)}" role="button" tabindex="0" aria-label="「${escape(laneTitle)}」の時期にまとめてある${n}件を広げる" transform="translate(${node.left.toFixed(1)} ${node.y.toFixed(1)})">
    <rect width="${node.w.toFixed(1)}" height="${node.h}" rx="${(node.h / 2).toFixed(1)}" class="node-body"></rect>
    <text x="${(node.w / 2).toFixed(1)}" y="${node.h / 2 + 5}" text-anchor="middle" class="node-label">${escape(node.label)}</text>
  </g>`;
}

function nodeMarkup(node, ctx) {
  if (node.node === 'cluster') return clusterMarkup(node, ctx);
  const {selected, dimmed, dragging} = ctx;
  const classes = ['node', `node-${node.node}`];
  if (node.node === 'domain' && node.domain.converged) classes.push('node-converged');
  const isPlacement = node.node === 'placement';
  // 自分で足した置きものは、色だけでなく破線の枠＋小さな印で見分けられるようにする。
  // まとめノード（node-cluster）も破線なので、密度の違う破線にして混同を避ける。
  const self = isPlacement && sourceOf(node) === 'self';
  const content = isPlacement ? contentOf(node) : null;
  const isLink = content === 'link';
  const isPhoto = content === 'photo';
  if (self) classes.push('node-self');
  if (node.id === selected) classes.push('is-selected');
  if (dimmed) classes.push('is-dim');
  if (node.id === dragging) classes.push('is-dragging');
  const movable = isPlacement;
  // アクセシブルな名前のほうに種別と出どころを言葉で足す。記号や枠線だけに意味を載せない。
  const descriptors = [];
  if (isLink) descriptors.push('リンク');
  if (isPhoto) descriptors.push('写真');
  if (self) descriptors.push('自分で追加');
  const name = `${escape(node.label)}${descriptors.length ? `（${descriptors.join('・')}）` : ''}`;
  // リンク・写真の記号はラベルの前に置く装飾。読み上げには要らないので aria-hidden にし、
  // 意味（種別・出どころ）は上の aria-label（name）側だけで言う。
  const mark = isLink ? '<tspan class="node-mark" aria-hidden="true">↗ </tspan>'
    : isPhoto ? '<tspan class="node-mark" aria-hidden="true">▣ </tspan>'
    : '';
  return `<g class="${classes.join(' ')}" data-node="${escape(node.id)}"${movable ? ' data-movable="1"' : ''}${isPlacement ? ` data-source="${escape(sourceOf(node))}"` : ''} role="button" tabindex="0" aria-label="${name}を開く" transform="translate(${node.left.toFixed(1)} ${node.y.toFixed(1)})">
    <rect width="${node.w.toFixed(1)}" height="${node.h}" rx="${(node.h / 2).toFixed(1)}" class="node-body"></rect>
    ${node.node === 'domain' && node.domain.converged ? `<circle cx="${(node.w - 11).toFixed(1)}" cy="11" r="4" class="node-spark"></circle>` : ''}
    ${self ? `<rect x="${(node.w - 15).toFixed(1)}" y="4" width="7" height="7" class="node-mark"></rect>` : ''}
    <text x="${(node.w / 2).toFixed(1)}" y="${node.h / 2 + 5}" text-anchor="middle" class="node-label">${mark}${escape(node.label)}</text>
  </g>`;
}

/**
 * 野原を1枚のSVGとして描く。文字は縮小せず、実際の表示幅のまま置く。
 * 図が読めない人のために、同じ内容の一覧を app 側で必ず併置すること。
 */
export function renderField(view, {selected = null, dragging = null, highlight = new Set(), next = null} = {}) {
  const dim = highlight.size > 0;
  const laneById = new Map(view.lanes.map(lane => [lane.id, lane]));

  // 関係する線・ノードを前面へ。SVGのz-indexはDOM順でしか解決できないので、
  // 「薄い(0) → 素(1) → 明るい・選択中(2)」の順に並べ替えてから描く。
  const linkOrder = view.links
    .map(link => {
      const from = view.byId.get(link.from);
      const to = view.byId.get(link.to);
      const lit = highlight.has(link.from) && highlight.has(link.to);
      const tier = lit ? 2 : dim ? 0 : 1;
      return {link, from, to, lit, tier};
    })
    .sort((a, b) => a.tier - b.tier);

  const nodeOrder = view.nodes
    .map(node => {
      const dimmed = dim && !highlight.has(node.id);
      const tier = dimmed ? 0 : node.id === selected ? 2 : 1;
      return {node, dimmed, tier};
    })
    .sort((a, b) => a.tier - b.tier);

  return `<svg class="field" viewBox="0 0 ${view.width} ${view.height}" preserveAspectRatio="xMidYMin meet"
      role="group" aria-label="7年進路マップ。縦は現在から7年先まで、追加した項目と関連する学問を線で示します。">
    <g class="lanes">${view.lanes.map(lane => laneMarkup(lane, view.width, next)).join('')}</g>
    <g class="links" aria-hidden="true">${linkOrder.map(({link, from, to, lit}) =>
      `<path d="${curve(from, to)}" data-from="${escape(link.from)}" data-to="${escape(link.to)}" class="link link-${link.kind}${lit ? ' is-lit' : dim ? ' is-dim' : ''}"></path>`
    ).join('')}</g>
    <g class="lane-labels">${view.lanes.map(lane => laneLabelMarkup(lane, next)).join('')}</g>
    <g class="lane-toggles">${view.lanes.map(lane => laneToggleMarkup(lane, view.width)).join('')}</g>
    <g class="nodes">${nodeOrder.map(({node, dimmed}) => nodeMarkup(node, {
      selected,
      dimmed,
      dragging,
      laneTitle: laneById.get(node.lane)?.title ?? ''
    })).join('')}</g>
  </svg>`;
}

/**
 * 野原と同じ内容の一覧。図を読まなくても、置いたものと合流先が分かるようにする。
 * field.mjs の listGroups() が返した groups をそのまま描く（並べ替えのボタンは app.js が描く）。
 */
// 合流の一文。名前を並べきらないのは、20件置いたときに1文が画面を埋めてしまうから。
function convergenceLine(item) {
  const {shown, rest, all, name} = convergenceSentence(item);
  const names = shown.map(label => `「${escape(label)}」`).join('と') + (rest ? `ほか${rest}件` : '');
  return `${names}は、${all}<b>${escape(name)}</b>につながっています。`;
}

const LEAD_LIMIT = 3;

export function renderFieldList(groups, convergenceList) {
  const sections = groups.map(group => `<section class="field-list-lane">
      <h4>${escape(group.title)}<span>${escape(group.note ?? '')}</span></h4>
      ${group.items.length
        ? `<ul>${group.items.map(item => `<li><button data-node-open="${escape(item.id)}">${escape(item.label)}</button>${item.sub ? `<span class="field-list-sub">${escape(item.sub)}</span>` : ''}${item.caution ? `<span class="field-list-caution">${escape(item.caution)}</span>` : ''}${item.converged ? '<em>複数の項目に共通</em>' : ''}</li>`).join('')}</ul>`
        : '<p class="field-list-empty">まだ項目がありません。</p>'}
    </section>`).join('');
  return `<div class="field-list">
    ${convergenceList.length ? `<p class="field-list-lead">${convergenceList.slice(0, LEAD_LIMIT).map(convergenceLine).join('')}${convergenceList.length > LEAD_LIMIT ? `<span class="field-list-more">共通する学問はほかに${convergenceList.length - LEAD_LIMIT}件あります。並べ方を「つながる学問」にすると全部読めます。</span>` : ''}</p>` : ''}
    ${sections}
  </div>`;
}
