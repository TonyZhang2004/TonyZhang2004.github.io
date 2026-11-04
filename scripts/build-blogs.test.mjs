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

test('rejects duplicate slugs and paths outside the posts folder', async (t) => {
  const options = await fixture(t);
  await writeFile(join(options.sourceDirectory, 'posts.json'), JSON.stringify([options.post, options.post]));
  await assert.rejects(buildBlogs(options), /Duplicate post slug/);
  await writeFile(join(options.sourceDirectory, 'posts.json'), JSON.stringify([{ ...options.post, slug: '../outside' }]));
  await assert.rejects(buildBlogs(options), /hyphenated slug/);
});
