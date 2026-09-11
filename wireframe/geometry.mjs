const point = (x, y) => `${Number(x.toFixed(2))} ${Number(y.toFixed(2))}`;

export function downwardCurve(from, to) {
  const middle = (from.y + to.y) / 2;
  return `M${point(from.x, from.y)} C${point(from.x, middle)} ${point(to.x, middle)} ${point(to.x, to.y)}`;
}

export function roundedRoute(points, radius = 10) {
  if (points.length < 2) throw new Error('A route requires two endpoints');
  let path = `M${point(points[0].x, points[0].y)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const before = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const after = Math.hypot(next.x - corner.x, next.y - corner.y);
    if (!before || !after) continue;
    const r = Math.min(radius, before / 2, after / 2);
    const entry = { x: corner.x + (previous.x - corner.x) * r / before, y: corner.y + (previous.y - corner.y) * r / before };
    const end = { x: corner.x + (next.x - corner.x) * r / after, y: corner.y + (next.y - corner.y) * r / after };
    path += ` L${point(entry.x, entry.y)} Q${point(corner.x, corner.y)} ${point(end.x, end.y)}`;
  }
  const last = points.at(-1);
  return `${path} L${point(last.x, last.y)}`;
}

export function drawTreeConnections(canvas, anchorId) {
  const svg = canvas.querySelector('.tree-lines');
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left - bounds.left, right: rect.right - bounds.left, top: rect.top - bounds.top, bottom: rect.bottom - bounds.top, x: (rect.left + rect.right) / 2 - bounds.left, y: (rect.top + rect.bottom) / 2 - bounds.top };
  };
  const port = (element, side) => {
    const rect = box(element);
    return side === 'top' || side === 'bottom' ? { x: rect.x, y: rect[side] } : { x: rect[side], y: rect.y };
  };
  const add = (d, className, from, to, sideFrom = 'bottom', sideTo = 'top') => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', className);
    path.dataset.from = from.id;
    path.dataset.to = to.id;
    path.dataset.fromPort = sideFrom;
    path.dataset.toPort = sideTo;
    svg.append(path);
  };
  const curve = (from, to, className) => add(downwardCurve(port(from, 'bottom'), port(to, 'top')), className, from, to);
  if (canvas.dataset.layout === 'compact') {
    const root=canvas.querySelector('.compact-root');
    const branches=[...canvas.querySelectorAll('.compact-branch')];
    for(const branch of branches) curve(root,branch,`tree-edge${branch.dataset.domain===anchorId?' active':''}`);
    const anchor=branches.find(branch=>branch.dataset.domain===anchorId) || branches[0];
    const focus=canvas.querySelector('.compact-focus');
    const a=port(anchor,'bottom'), b=port(focus,'top');
    const lane=Math.max(...branches.map(branch=>box(branch).bottom))+16;
    add(roundedRoute([a,{x:a.x,y:lane},{x:b.x,y:lane},b]),'op-trunk',anchor,focus);
    curve(focus,canvas.querySelector('#compact-options'),'tree-edge');
    const near=canvas.querySelector('.compact-near-anchor');
    for(const node of canvas.querySelectorAll('[id^="compact-near-"][data-related]')) curve(near,node,'near-edge');
    return;
  }
  const root = canvas.querySelector('.tree-root');
  const branches = [...canvas.querySelectorAll('.tree-domain')];
  for (const branch of branches) {
    const id = branch.dataset.domain;
    const question = canvas.querySelector(`#question-${id}`);
    const active = id === anchorId ? ' active' : '';
    curve(root, question, `tree-edge${active}`);
    curve(question, branch, `tree-edge${active}`);
    for (const leaf of canvas.querySelectorAll(`#leaves-${id} span`)) curve(branch, leaf, `tree-edge${active}`);
  }

  const anchor = canvas.querySelector(`#branch-${anchorId}`) || branches[0];
  const target = canvas.querySelector('.op-root') || canvas.querySelector('.open-branches');
  const from = port(anchor, 'bottom');
  const to = port(target, 'top');
  const leafBottom = Math.max(...[...canvas.querySelectorAll('.tree-leaves span')].map(el => box(el).bottom));
  const lane = leafBottom + 18;
  const route = roundedRoute([from, {x:from.x,y:lane}, {x:to.x,y:lane}, to]);
  add(route, target.classList.contains('op-root') ? 'op-trunk' : 'tree-bridge', anchor, target);
  if (target.classList.contains('open-branches')) curve(target, canvas.querySelector('.near-focus'), 'tree-bridge');

  const opportunityRoot = canvas.querySelector('.op-root');
  if (opportunityRoot) {
    for (const column of canvas.querySelectorAll('.op-column')) {
      const heading = column.querySelector('h3');
      const caption = column.querySelector('.op-caption');
      curve(opportunityRoot, heading, 'tree-edge');
      const nodes = [...column.querySelectorAll('.op-node')];
      if (!nodes.length) continue;
      const start = port(caption, 'bottom');
      const firstTop = box(nodes[0]).top;
      const railX = Math.min(...nodes.map(node => box(node).left)) - 10;
      for (const node of nodes) {
        const end = port(node, 'left');
        add(roundedRoute([start, {x:start.x,y:firstTop-9}, {x:railX,y:firstTop-9}, {x:railX,y:end.y}, end], 6), 'tree-edge', caption, node, 'bottom', 'left');
      }
    }
  }
  const focus = canvas.querySelector('.near-focus');
  for (const neighbor of canvas.querySelectorAll('.near-node')) {
    const left = box(neighbor).x < box(focus).x;
    const sideFrom = left ? 'left' : 'right';
    const sideTo = left ? 'right' : 'left';
    const a = port(focus, sideFrom);
    const b = port(neighbor, sideTo);
    const d = `M${point(a.x,a.y)} C${point(a.x,a.y-30)} ${point(b.x,b.y-30)} ${point(b.x,b.y)}`;
    add(d, 'near-edge', focus, neighbor, sideFrom, sideTo);
  }
}
