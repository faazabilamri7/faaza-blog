import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postDir = 'src/data/post';

function getFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getFiles(postDir);
const now = new Date().toISOString();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') continue;
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) continue;
  const frontmatter = lines.slice(1, endIndex).join('\n');
  const hasTitle = frontmatter.includes('title:');
  const hasTags = frontmatter.includes('tags:');
  const hasCategory = frontmatter.includes('category:');
  const hasDescription = frontmatter.includes('description:');
  const hasPubDate = frontmatter.includes('pubDate:');
  const hasDraft = frontmatter.includes('draft:');
  const hasExcerpt = frontmatter.includes('excerpt:');
  const filename = path.basename(file, path.extname(file));
  const relativePath = path.relative(postDir, file);
  const category = path.basename(path.dirname(relativePath));
  const title = filename;
  const description = `A post about ${title}`;
  const excerpt = description;
  let additions = [];
  if (!hasTitle) additions.push(`title: ${title}`);
  if (!hasTags) additions.push('tags: []');
  if (!hasCategory) additions.push(`category: ${category}`);
  if (!hasDescription) additions.push(`description: "${description}"`);
  if (!hasPubDate) additions.push(`pubDate: ${now}`);
  if (!hasDraft) additions.push('draft: false');
  if (!hasExcerpt) additions.push(`excerpt: "${excerpt}"`);
  if (additions.length > 0) {
    const newLines = ['---', ...lines.slice(1, endIndex), ...additions, '---', ...lines.slice(endIndex + 1)];
    const newContent = newLines.join('\n');
    fs.writeFileSync(file, newContent);
  }
}