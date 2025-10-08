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
  const frontmatterLines = lines.slice(1, endIndex);
  const relativePath = path.relative(postDir, file);
  const dirPath = path.dirname(relativePath);
  const tags = dirPath.split(path.sep).filter(Boolean);
  const tagsLine = `tags: [${tags.map(t => `'${t}'`).join(', ')}]`;
  let hasTags = false;
  for (let i = 0; i < frontmatterLines.length; i++) {
    if (frontmatterLines[i].startsWith('tags:')) {
      frontmatterLines[i] = tagsLine;
      hasTags = true;
      break;
    }
  }
  if (!hasTags) {
    frontmatterLines.push(tagsLine);
  }
  const newLines = ['---', ...frontmatterLines, '---', ...lines.slice(endIndex + 1)];
  const newContent = newLines.join('\n');
  fs.writeFileSync(file, newContent);
}