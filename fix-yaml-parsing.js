#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const POST_DIR = 'src/data/post';

function getAllMarkdownFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (item.isFile() && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function fixYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  // Find frontmatter
  let frontStart = -1;
  let frontEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---') {
      if (frontStart === -1) {
        frontStart = i;
      } else {
        frontEnd = i;
        break;
      }
    }
  }

  if (frontStart === -1 || frontEnd === -1) return false;

  const frontLines = lines.slice(frontStart + 1, frontEnd);
  let newFrontLines = [];
  let i = 0;
  let changed = false;

  while (i < frontLines.length) {
    const line = frontLines[i];
    if (line.startsWith('description:') || line.startsWith('excerpt:')) {
      const key = line.split(':')[0];
      const valueStart = line.indexOf(':') + 1;
      let value = line.substring(valueStart).trim();
      let blockLines = [];

      if (value === '>-' || value === '>') {
        // Collect block lines
        i++;
        while (i < frontLines.length && (frontLines[i].startsWith('  ') || frontLines[i].trim() === '')) {
          blockLines.push(frontLines[i]);
          i++;
        }
        // Use literal block to preserve content
        newFrontLines.push(`${key}: |`);
        blockLines.forEach(line => newFrontLines.push(line));
        changed = true;
      } else {
        newFrontLines.push(line);
        i++;
      }
    } else {
      newFrontLines.push(line);
      i++;
    }
  }

  if (changed) {
    const newFrontText = newFrontLines.join('\n');
    const newContent = `---\n${newFrontText}\n---\n${lines.slice(frontEnd + 1).join('\n')}`;
    fs.writeFileSync(filePath, newContent);
    return true;
  }

  return false;
}

function main() {
  const files = getAllMarkdownFiles(POST_DIR);
  let fixedCount = 0;

  for (const file of files) {
    if (fixYaml(file)) {
      console.log(`Fixed: ${file}`);
      fixedCount++;
    }
  }

  console.log(`\nFixed ${fixedCount} files.`);
}

main();