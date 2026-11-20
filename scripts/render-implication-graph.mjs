import { createRequire } from 'node:module';

const { renderToString } = createRequire(import.meta.url)('katex');
const graphId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function isReference(source) {
  if (!hasText(source?.label) || !hasText(source.url)) return false;
  try {
    return new URL(source.url).protocol === 'https:';
  } catch {
    return false;
  }
}

function renderStatement(node) {
  try {
    return node.statement.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g).map((segment, index) => {
      if (index % 2 === 0) {
        if (segment.includes('$')) throw new Error('Unbalanced math delimiter');
        return escapeHtml(segment);
      }
      const displayMode = segment.startsWith('$$');
      const delimiterLength = displayMode ? 2 : 1;
      const latex = segment.slice(delimiterLength, -delimiterLength);
      const math = renderToString(latex, { displayMode, strict: 'error', trust: false });
      return !displayMode && latex.length <= 26 ? `<span class="grh-math-unit">${math}</span>` : math;
    }).join('');
  } catch (error) {
    throw new Error(`Invalid statement for ${node.id}: ${error.message}`, { cause: error });
  }
}

export function renderImplicationGraph(source) {
  const graph = JSON.parse(source);
  if (!Array.isArray(graph?.nodes) || !Array.isArray(graph.branches) || !graph.branches.length) {
    throw new Error('The GRH graph needs theorem nodes and branches');
  }

  const nodes = new Map();
  for (const node of graph.nodes) {
    if (!hasText(node?.id) || !graphId.test(node.id) || nodes.has(node.id) ||
        !hasText(node.title) || !hasText(node.statement) ||
        !Array.isArray(node.parents) || node.parents.length !== (node.id === 'grh' ? 0 : 1) ||
        !Array.isArray(node.sources) || !node.sources.length || !node.sources.every(isReference)) {
      throw new Error(`Invalid GRH theorem node: ${node?.id ?? '(missing ID)'}`);
    }
    nodes.set(node.id, node);
  }
  if (!nodes.has('grh')) throw new Error('The GRH graph needs a grh root');

  const branchIds = new Set();
  const covered = new Set();
  for (const branch of graph.branches) {
    if (!hasText(branch?.id) || !graphId.test(branch.id) || branchIds.has(branch.id) || !hasText(branch.title) ||
        !Array.isArray(branch.tracks) || !branch.tracks.length ||
        branch.tracks.some(track => !Array.isArray(track) || !track.length)) {
      throw new Error(`Invalid GRH branch: ${branch?.id ?? '(missing ID)'}`);
    }
    branchIds.add(branch.id);
    const visible = new Set();
    for (const track of branch.tracks) {
      for (const [index, id] of track.entries()) {
        let node = nodes.get(id);
        if (!node || (index > 0 && node.parents[0] !== track[index - 1])) {
          throw new Error(`Invalid theorem path at ${branch.id}/${id}`);
        }
        const ancestors = new Set();
        while (!visible.has(node.id)) {
          if (ancestors.has(node.id)) throw new Error(`Cycle in the GRH graph at ${node.id}`);
          ancestors.add(node.id);
          if (!node.parents.length) break;
          const [parent] = node.parents;
          node = nodes.get(parent);
          if (!node) throw new Error(`Missing GRH parent: ${parent}`);
        }
        for (const ancestor of ancestors) visible.add(ancestor);
      }
    }
    if (branch.featured !== undefined && !visible.has(branch.featured)) {
      throw new Error(`Featured theorem is outside branch ${branch.id}`);
    }
    for (const id of visible) covered.add(id);
  }
  if (covered.size !== nodes.size) throw new Error('Every GRH theorem must appear in a branch');

  return {
    data: JSON.stringify(graph).replaceAll('<', '\\u003c'),
    statements: graph.nodes.map(node =>
      `        <div data-statement-for="${node.id}">${renderStatement(node)}</div>`
    ).join('\n')
  };
}
