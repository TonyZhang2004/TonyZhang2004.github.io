(() => {
  const preview = document.getElementById('grh-preview');
  const { branches, nodes } = JSON.parse(document.getElementById('grh-preview-data').textContent);
  const theoremById = new Map(nodes.map(theorem => [theorem.id, theorem]));
  const statementById = new Map(Array.from(document.getElementById('grh-preview-statements').content.children,
    content => [content.dataset.statementFor, content]));
  const branchList = preview.querySelector('.grh-branch-list');
  const branchSelect = preview.querySelector('select');
  const graph = preview.querySelector('.grh-graph');
  const graphHeading = preview.querySelector('#grh-preview-graph-heading');
  const theoremLayer = preview.querySelector('.grh-theorems');
  const connectorLayer = preview.querySelector('.grh-connectors');
  const halfStroke = 0.6;
  connectorLayer.style.setProperty('--grh-half-stroke', `${halfStroke}px`);
  const detailHeading = preview.querySelector('#grh-preview-theorem-heading');
  const detail = preview.querySelector('.grh-details');
  const statement = preview.querySelector('.grh-statement');
  const status = preview.querySelector('.grh-status');
  const references = preview.querySelector('.grh-references');
  const nodeButtons = new Map();
  const branchButtons = new Map();
  let branch;
  let selected;
  let parentEdges = [];
  let columnCount = 1;
  let pendingDraw = 0;

  function make(tag, className, label) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (label) element.textContent = label;
    return element;
  }

  function withAncestors(ids) {
    const all = new Set();
    function visit(id) {
      if (all.has(id)) return;
      theoremById.get(id).parents.forEach(visit);
      all.add(id);
    }
    ids.forEach(visit);
    return all;
  }

  function renderGraph() {
    const visibleIds = withAncestors(branch.tracks.flat());
    const children = new Map(Array.from(visibleIds, id => [id, []]));
    parentEdges = [];
    for (const id of visibleIds) {
      const [parent] = theoremById.get(id).parents;
      if (parent) {
        children.get(parent).push(id);
        parentEdges.push({ parent, child: id });
      }
    }

    const positions = new Map();
    let leaf = 0;
    function place(id, depth) {
      const first = leaf;
      const position = { column: first + 1, depth, order: positions.size + 1, span: 1 };
      positions.set(id, position);
      const descendants = children.get(id);
      for (const descendant of descendants) place(descendant, depth + 1);
      if (!descendants.length) leaf += 1;
      position.span = leaf - first;
    }
    place('grh', 0);

    nodeButtons.clear();
    const content = document.createDocumentFragment();
    for (const [id, position] of positions) {
      const theorem = theoremById.get(id);
      const button = make('button', 'grh-theorem', theorem.title);
      button.type = 'button';
      button.dataset.theorem = id;
      button.setAttribute('aria-controls', 'grh-preview-detail');
      const parents = theorem.parents.map(parent => theoremById.get(parent).title);
      if (parents.length) button.setAttribute('aria-label', `${theorem.title}. Follows ${parents.join(' and ')}.`);
      if (id === 'grh') {
        button.classList.add('grh-root');
        button.textContent = 'Generalized Riemann Hypothesis';
        button.append(make('span', 'grh-root-scope', 'Dedekind zeta functions'));
      }
      button.style.setProperty('--grh-row', position.depth + 1);
      button.style.setProperty('--grh-col', position.column);
      button.style.setProperty('--grh-span', position.span);
      button.style.setProperty('--grh-order', position.order);
      button.style.setProperty('--grh-indent', `${16 * position.depth}px`);
      button.addEventListener('click', event => {
        showTheorem(id);
        if (event.isTrusted) detail.scrollIntoView({ block: 'nearest' });
      });
      nodeButtons.set(id, button);
      content.append(button);
    }
    columnCount = leaf;
    theoremLayer.style.setProperty('--grh-columns', columnCount);
    setLayout();
    theoremLayer.replaceChildren(content);
  }

  function setLayout() {
    const minColumnWidth = 120;
    const gap = 12;
    const minimumWidth = Math.max(415, minColumnWidth * columnCount + gap * (columnCount - 1));
    graph.classList.toggle('grh-stacked', graph.clientWidth < minimumWidth);
  }

  function drawEdges() {
    const graphBox = graph.getBoundingClientRect();
    if (!graphBox.width) return;
    const visited = withAncestors([selected]);
    const strokes = document.createDocumentFragment();
    const stacked = graph.classList.contains('grh-stacked');

    function line(x1, y1, x2, y2, active) {
      const rule = make('span', `grh-edge${active ? ' grh-active' : ''}`);
      rule.style.left = `${Math.min(x1, x2) - halfStroke}px`;
      rule.style.top = `${Math.min(y1, y2) - halfStroke}px`;
      rule.style.width = `${Math.abs(x2 - x1) + 2 * halfStroke}px`;
      rule.style.height = `${Math.abs(y2 - y1) + 2 * halfStroke}px`;
      strokes.append(rule);
    }

    // The final shaft segment and its arrowhead are one shape.
    function drawArrow(start, end, center, active) {
      const arrow = make('span', `grh-arrow${active ? ' grh-active' : ''}${stacked ? ' grh-arrow-side' : ''}`);
      const shapeWidth = 8;
      const length = end - start;
      arrow.style.left = `${stacked ? start : center - shapeWidth / 2}px`;
      arrow.style.top = `${stacked ? center - shapeWidth / 2 : start}px`;
      arrow.style.width = `${stacked ? length : shapeWidth}px`;
      arrow.style.height = `${stacked ? shapeWidth : length}px`;
      strokes.append(arrow);
    }

    const edges = [...parentEdges].sort((a, b) => Number(visited.has(a.child)) - Number(visited.has(b.child)));
    for (const { parent, child } of edges) {
      const from = nodeButtons.get(parent).getBoundingClientRect();
      const to = nodeButtons.get(child).getBoundingClientRect();
      const active = visited.has(child);
      const startY = from.bottom - graphBox.top;
      if (stacked) {
        const lane = from.left - graphBox.left + 5;
        const endX = to.left - graphBox.left;
        const endY = to.top + to.height / 2 - graphBox.top;
        line(lane, startY, lane, endY, active);
        drawArrow(lane - halfStroke, endX, endY, active);
      } else {
        const startX = from.left + from.width / 2 - graphBox.left;
        const endX = to.left + to.width / 2 - graphBox.left;
        const endY = to.top - graphBox.top;
        const middle = (startY + endY) / 2;
        line(startX, startY, startX, middle, active);
        if (startX !== endX) line(startX, middle, endX, middle, active);
        drawArrow(middle - halfStroke, endY, endX, active);
      }
    }
    connectorLayer.replaceChildren(strokes);
  }

  function scheduleDraw() {
    cancelAnimationFrame(pendingDraw);
    pendingDraw = requestAnimationFrame(drawEdges);
  }

  function showTheorem(id) {
    selected = id;
    const theorem = theoremById.get(id);
    const path = withAncestors([id]);
    detailHeading.textContent = theorem.title;
    statement.replaceChildren(...statementById.get(id).cloneNode(true).childNodes);
    status.textContent = theorem.status ?? '';
    status.hidden = !theorem.status;
    references.replaceChildren(...theorem.sources.map(source => {
      const link = make('a', '', source.label);
      const externalMark = make('span', 'grh-reference-arrow', ' ↗');
      externalMark.setAttribute('aria-hidden', 'true');
      link.append(externalMark);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    }));
    for (const [nodeId, button] of nodeButtons) {
      button.classList.toggle('grh-on-path', path.has(nodeId));
      button.setAttribute('aria-pressed', String(nodeId === id));
    }
    scheduleDraw();
  }

  function showBranch(id) {
    const nextBranch = branches.find(candidate => candidate.id === id) ?? branches[0];
    if (nextBranch !== branch) {
      branch = nextBranch;
      graphHeading.textContent = branch.title;
      branchSelect.value = branch.id;
      for (const [branchId, button] of branchButtons) {
        button.setAttribute('aria-current', String(branchId === branch.id));
      }
      renderGraph();
    }
    showTheorem(branch.featured ?? branch.tracks[0].at(-1));
  }

  for (const item of branches) {
    const button = make('button', 'grh-branch-button', item.title);
    button.type = 'button';
    button.setAttribute('aria-controls', 'grh-preview-graph');
    button.addEventListener('click', () => showBranch(item.id));
    const option = make('option', '', item.title);
    option.value = item.id;
    branchButtons.set(item.id, button);
    branchList.append(button);
    branchSelect.append(option);
  }

  branchSelect.addEventListener('change', () => showBranch(branchSelect.value));
  showBranch(branches[0].id);
  new ResizeObserver(() => {
    setLayout();
    scheduleDraw();
  }).observe(theoremLayer);
  document.fonts.ready.then(scheduleDraw);
})();
