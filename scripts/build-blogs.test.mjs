import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildBlogs, renderMarkdown } from './build-blogs.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'tony-blogs-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourceDirectory = join(directory, 'source');
  const outputDirectory = join(directory, 'site');
  await mkdir(join(sourceDirectory, 'posts'), { recursive: true });
  const post = { slug: 'example', title: 'Proof <test> & code', preview: 'An "example".' };
  await writeFile(join(sourceDirectory, 'posts.json'), JSON.stringify([post]));
  await writeFile(join(sourceDirectory, 'posts/example.md'), 'Inline $x^2$.\n\n```python\nprint(2 ** 3)\n```\n');
  return { sourceDirectory, outputDirectory, post };
}

test('renders inline/display math and highlights escaped code without treating code as math', async () => {
  const html = await renderMarkdown('Inline $x^2$.\n\n$$\n\\sum_{i=1}^{n} i\n$$\n\n```cpp\n// $not_math$\nif (x < 3) return "<script>";\n```\n');
  assert.equal((html.match(/<math /g) ?? []).length, 2);
  assert.match(html, /katex-display/);
  assert.match(html, /hljs-keyword/);
  assert.match(html, /\$not_math\$/);
  const code = html.match(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/)[1]
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  assert.match(code, /return "<script>";/);
  assert.doesNotMatch(html, /<script>/);
});

test('builds real linked pages and removes only generated posts when the list becomes empty', async (t) => {
  const options = await fixture(t);
  await buildBlogs(options);
  const index = await readFile(join(options.outputDirectory, 'blogs.html'), 'utf8');
  const article = await readFile(join(options.outputDirectory, 'blogs/example.html'), 'utf8');
  assert.match(index, /href="blogs\/example.html"/);
  assert.match(index, /Proof &lt;test&gt; &amp; code/);
  assert.match(index, /An &quot;example&quot;\./);
  assert.match(index, /href="blogs.html" aria-current="page">Blogs/);
  assert.match(article, /href="\.\.\/blogs.html#blogs-heading"><span aria-hidden="true">←<\/span> Back/);
  assert.match(article, /class="blog-backbar"/);
  assert.match(article, /<math /);
  assert.match(article, /hljs-/);
  assert.doesNotMatch(article, /<script|site-header|Sample technical post/);
  const css = await readFile(join(options.outputDirectory, 'assets/blog.css'), 'utf8');
  assert.match(css, /position: sticky/);
  await writeFile(join(options.outputDirectory, 'blogs/manual.html'), '<p>Keep this hand-written file.</p>');
  await writeFile(join(options.sourceDirectory, 'posts.json'), '[]\n');
  const empty = await buildBlogs(options);
  assert.equal(empty.count, 0);
  assert.doesNotMatch(await readFile(empty.index, 'utf8'), /<article|example.html|Sample/);
  await assert.rejects(access(join(options.outputDirectory, 'blogs/example.html')));
  await access(join(options.outputDirectory, 'blogs/manual.html'));
});

test('invalid LaTeX fails before changing generated output', async (t) => {
  const options = await fixture(t);
  await buildBlogs(options);
  const indexPath = join(options.outputDirectory, 'blogs.html');
  const original = await readFile(indexPath, 'utf8');
  await writeFile(join(options.sourceDirectory, 'posts/example.md'), '$\\notARealCommand{1}$');
  await assert.rejects(buildBlogs(options));
  assert.equal(await readFile(indexPath, 'utf8'), original);
});

test('keeps a Markdown draft unchanged while rendering one title and its selected illustration', async (t) => {
  const options = await fixture(t);
  const post = {
    ...options.post,
    source: 'draft.md',
    hero: 'assets/headshot.jpg',
    heroAlt: 'Two children and eight beads.',
    heroWidth: 460,
    heroHeight: 460
  };
  const source = `# ${post.title}\n\nA formula: $x^2$.\n`;
  await writeFile(join(options.sourceDirectory, 'posts/draft.md'), source);
  await writeFile(join(options.sourceDirectory, 'posts.json'), JSON.stringify([post]));
  await buildBlogs(options);
  const html = await readFile(join(options.outputDirectory, 'blogs/example.html'), 'utf8');
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
  assert.match(html, /class="blog-illustration"/);
  assert.match(html, /src="\.\.\/assets\/headshot.jpg"/);
  assert.match(html, /alt="Two children and eight beads\."/);
  await access(join(options.outputDirectory, post.hero));
  assert.equal(await readFile(join(options.sourceDirectory, 'posts/draft.md'), 'utf8'), source);
});

test('rejects duplicate slugs and paths outside the posts folder', async (t) => {
  const options = await fixture(t);
  await writeFile(join(options.sourceDirectory, 'posts.json'), JSON.stringify([options.post, options.post]));
  await assert.rejects(buildBlogs(options), /Duplicate post slug/);
  await writeFile(join(options.sourceDirectory, 'posts.json'), JSON.stringify([{ ...options.post, slug: '../outside' }]));
  await assert.rejects(buildBlogs(options), /hyphenated slug/);
});

test('builds a GRH graph alongside Markdown with local assets and pre-rendered math', async (t) => {
  const options = await fixture(t);
  const manifest = [options.post, {
    slug: 'grh-implications', layout: 'grh-implications', title: 'What Does GRH Give Us?', preview: 'A theorem graph.'
  }];
  const reference = { label: 'Reference', url: 'https://example.org/grh' };
  const graph = {
    nodes: [
      { id: 'grh', title: 'GRH', statement: 'Inline $x^2$.', parents: [], sources: [reference] },
      { id: 'example', title: 'Theorem', statement: 'Display $$x^2=1.$$ </script>', parents: ['grh'], sources: [reference] }
    ],
    branches: [{ id: 'theorems', title: 'Theorems', tracks: [['grh', 'example']] }]
  };
  const graphSource = join(options.sourceDirectory, 'posts/grh-implications.json');
  await writeFile(join(options.sourceDirectory, 'posts.json'), JSON.stringify(manifest));
  await writeFile(graphSource, JSON.stringify(graph));
  const result = await buildBlogs(options);
  const graphPath = join(options.outputDirectory, 'blogs/grh-implications.html');
  const html = await readFile(graphPath, 'utf8');
  const index = await readFile(result.index, 'utf8');
  assert.match(index, /href="blogs\/grh-implications.html"/);
  assert.match(index, /href="blogs\/example.html"/);
  assert.match(html, /href="\.\.\/blogs.html#blogs-heading"/);
  assert.match(html, /href="\.\.\/assets\/grh-implications.css\?v=[a-f0-9]{12}"/);
  assert.match(html, /src="\.\.\/assets\/grh-implications.js\?v=[a-f0-9]{12}"/);
  assert.equal((html.match(/<math /g) ?? []).length, 2);
  assert.match(html, /grh-math-unit/);
  assert.match(html, /katex-display/);
  assert.match(html, /&lt;\/script&gt;/);
  assert.doesNotMatch(html, /window\.openai|data:font/);
  await access(join(options.outputDirectory, 'assets/grh-implications.css'));
  await access(join(options.outputDirectory, 'assets/grh-implications.js'));

  graph.nodes[1].parents = ['example'];
  await writeFile(graphSource, JSON.stringify(graph));
  await assert.rejects(buildBlogs(options), /Invalid theorem path/);
  assert.equal(await readFile(graphPath, 'utf8'), html);
});
