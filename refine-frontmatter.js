import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

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

function extractTitle(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#+\s+(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function extractDescription(content) {
  const lines = content.split(/\r?\n/);
  let inCodeBlock = false;
  let description = '';
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock && line.trim() && !line.startsWith('#')) {
      description += line + ' ';
      if (line.trim() === '') break; // stop at first empty line after content
    }
  }
  return description.trim().replace(/\s+/g, ' ');
}

function shortenToSentences(text, maxSentences = 2) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.slice(0, maxSentences).join('. ').trim() + (sentences.length > maxSentences ? '.' : '');
}

function getPubDate(filename) {
  const base = path.basename(filename, path.extname(filename));
  if (/^\d{13}$/.test(base)) {
    return new Date(parseInt(base)).toISOString();
  }
  return new Date().toISOString();
}

const files = getFiles(postDir);

function parseFrontMatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { data: {}, body: content };
  }
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { data: {}, body: content };
  }
  const frontmatterStr = lines.slice(1, endIndex).join('\n');
  let data = {};
  try {
    data = yaml.safeLoad(frontmatterStr) || {};
  } catch (e) {
    data = {};
  }
  const body = lines.slice(endIndex + 1).join('\n');
  return { data, body };
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const { data, body } = parseFrontMatter(content);

  // Extract title
  const extractedTitle = extractTitle(body);
  if (extractedTitle && data.title && (data.title.toLowerCase() === 'introduction' || data.title.split(' ').length === 1 || data.title.length < 5)) {
    data.title = extractedTitle;
  } else if (!data.title) {
    data.title = extractedTitle || path.basename(file, path.extname(file));
  }

  // Category
  const relativePath = path.relative(postDir, file);
  const category = relativePath.split(path.sep)[0];
  data.category = category;

  // Tags
  if (!data.tags) {
    data.tags = [];
  }

  // Description
  const extractedDesc = extractDescription(body);
  if (extractedDesc) {
    data.description = shortenToSentences(extractedDesc, 2);
  } else if (!data.description) {
    data.description = `A post about ${data.title}`;
  }

  // PubDate
  if (!data.pubDate) {
    data.pubDate = getPubDate(file);
  }

  // Draft
  data.draft = false;

  // Excerpt
  data.excerpt = data.description;

  // Write back
  const frontmatterStr = yaml.dump(data).trim();
  const newContent = `---\n${frontmatterStr}\n---\n${body}`;
  fs.writeFileSync(file, newContent);
}

console.log('Front matter refined for all files.');