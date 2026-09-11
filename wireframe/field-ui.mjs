const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

// 置いたものが上へ伸びる線。時間が上に流れるので、縦向きの曲線にする。
function curve(from, to) {
  const x1 = from.left + from.w / 2;
  const y1 = from.y;
  const x2 = to.left + to.w / 2;
  const y2 = to.y + to.h;
  const mid = (y1 + y2) / 2;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${mid.toFixed(1)}, ${x2.toFixed(1)} ${mid.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function laneMarkup(lane, width, next) {
  return `<g class="lane lane-${lane.id}${lane.id === next ? ' lane-next' : ''}" aria-hidden="true">
    <rect x="0" y="${lane.top}" width="${width}" height="${lane.height}" class="lane-bg"></rect>
    <line x1="0" y1="${lane.top}" x2="${width}" y2="${lane.top}" class="lane-rule"></line>
    <text x="14" y="${lane.top + 17}" class="lane-title">${escape(lane.title)}</text>
    <text x="${width - 14}" y="${lane.top + 17}" class="lane-horizon" text-anchor="end">${escape(lane.horizon)}</text>
  </g>`;
}

function nodeMarkup(node, {selected, dimmed, dragging}) {
  const classes = ['node', `node-${node.node}`];
  if (node.node === 'domain' && node.domain.converged) classes.push('node-converged');
  if (node.id === selected) classes.push('is-selected');
  if (dimmed) classes.push('is-dim');
  if (node.id === dragging) classes.push('is-dragging');
  const movable = node.node === 'placement';
  return `<g class="${classes.join(' ')}" data-node="${escape(node.id)}"${movable ? ' data-movable="1"' : ''} transform="translate(${node.left.toFixed(1)} ${node.y.toFixed(1)})">
    <rect width="${node.w.toFixed(1)}" height="${node.h}" rx="${(node.h / 2).toFixed(1)}" class="node-body"></rect>
    ${node.node === 'domain' && node.domain.converged ? `<circle cx="${(node.w - 11).toFixed(1)}" cy="11" r="4" class="node-spark"></circle>` : ''}
    <text x="${(node.w / 2).toFixed(1)}" y="${node.h / 2 + 5}" text-anchor="middle" class="node-label">${escape(node.label)}</text>
  </g>`;
}

/**
 * 野原を1枚のSVGとして描く。文字は縮小せず、実際の表示幅のまま置く。
 * 図が読めない人のために、同じ内容の一覧を app 側で必ず併置すること。
 */
export function renderField(view, {selected = null, dragging = null, highlight = new Set(), next = null} = {}) {
  const dim = highlight.size > 0;
  return `<svg class="field" viewBox="0 0 ${view.width} ${view.height}" width="${view.width}" height="${view.height}"
      role="img" aria-label="時間の野原。縦は今から7年先まで、置いたものから線が伸びます。同じ内容は下の一覧でも読めます。">
    <g class="lanes">${view.lanes.map(lane => laneMarkup(lane, view.width, next)).join('')}</g>
    <g class="links" aria-hidden="true">${view.links.map(link => {
      const from = view.byId.get(link.from);
      const to = view.byId.get(link.to);
      const lit = highlight.has(link.from) && highlight.has(link.to);
      return `<path d="${curve(from, to)}" class="link link-${link.kind}${lit ? ' is-lit' : dim ? ' is-dim' : ''}"></path>`;
    }).join('')}</g>
    <g class="nodes">${view.nodes.map(node => nodeMarkup(node, {
      selected,
      dimmed: dim && !highlight.has(node.id),
      dragging
    })).join('')}</g>
  </svg>`;
}

/** 野原と同じ内容の一覧。図を読まなくても、置いたものと合流先が分かるようにする。 */
export function renderFieldList(view, convergenceList) {
  const lanes = view.lanes.map(lane => {
    const nodes = view.nodes.filter(node => node.lane === lane.id);
    return `<section class="field-list-lane">
      <h4>${escape(lane.title)}<span>${escape(lane.horizon)}</span></h4>
      ${nodes.length
        ? `<ul>${nodes.map(node => `<li><button data-node-open="${escape(node.id)}">${escape(node.label)}</button>${node.node === 'domain' && node.domain.converged ? '<em>合流</em>' : ''}</li>`).join('')}</ul>`
        : '<p class="field-list-empty">まだ何も置いていません。</p>'}
    </section>`;
  }).join('');
  return `<div class="field-list">
    ${convergenceList.length ? `<p class="field-list-lead">${convergenceList.map(item => `「${escape(item.labels.join('」と「'))}」は、どちらも<b>${escape(item.name)}</b>につながっています。`).join('')}</p>` : ''}
    ${lanes}
  </div>`;
}
