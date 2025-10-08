#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

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

function fixFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  let frontmatterStart = -1;
  let frontmatterEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---') {
      if (frontmatterStart === -1) {
        frontmatterStart = i;
      } else {
        frontmatterEnd = i;
        break;
      }
    }
  }
  if (frontmatterStart === -1 || frontmatterEnd === -1) return [];

  const frontmatterLines = lines.slice(frontmatterStart + 1, frontmatterEnd);
  const bodyLines = lines.slice(frontmatterEnd + 1);
  let changes = [];

  let newFrontmatterLines = [];
  let i = 0;
  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];
    if (line.startsWith('tags:')) {
      // Handle tags
      let tags = [];
      if (line.includes('[') && line.includes(']')) {
        // Inline array
        try {
          const tagsStr = line.split('tags:')[1].trim();
          tags = JSON.parse(tagsStr.replace(/'/g, '"'));
        } catch (e) {
          tags = [];
        }
        i++; // Move to next line
        // Check for additional block items
        while (i < frontmatterLines.length && frontmatterLines[i].startsWith('  - ')) {
          const tag = frontmatterLines[i].trim().substring(2);
          if (!tags.includes(tag)) tags.push(tag);
          i++;
        }
      } else if (line.trim() === 'tags:') {
        // Block array
        i++;
        while (i < frontmatterLines.length && frontmatterLines[i].startsWith('  - ')) {
          const tag = frontmatterLines[i].trim().substring(2);
          tags.push(tag);
          i++;
        }
      }
      // Now add tags in block style
      if (tags.length > 0) {
        newFrontmatterLines.push('tags:');
        tags.forEach(tag => newFrontmatterLines.push(`  - ${tag}`));
        changes.push('tags standardized to block style');
      }
    } else if (line.startsWith('description:') || line.startsWith('excerpt:')) {
      const key = line.split(':')[0];
      let value = line.substring(line.indexOf(':') + 1).trim();
      let multiline = [];
      i++;
      while (i < frontmatterLines.length && (frontmatterLines[i].startsWith('  ') || frontmatterLines[i].trim() === '')) {
        multiline.push(frontmatterLines[i]);
        i++;
      }
      const fullValue = [value, ...multiline].join('\n').trim();
      const maxDescLength = 160;
      if (fullValue.length > maxDescLength) {
        const shortened = fullValue.substring(0, maxDescLength - 3) + '...';
        newFrontmatterLines.push(`${key}: ${shortened}`);
        changes.push(`${key} shortened`);
      } else {
        newFrontmatterLines.push(`${key}: ${fullValue}`);
      }
    } else {
      newFrontmatterLines.push(line);
      i++;
    }
  }

  // Reconstruct
  const newFrontmatterText = newFrontmatterLines.join('\n');
  const newContent = `---\n${newFrontmatterText}\n---\n${bodyLines.join('\n')}`;
  fs.writeFileSync(filePath, newContent);

  return changes;
}

function main() {
  const files = getAllMarkdownFiles(POST_DIR);
  let totalChanges = 0;
  let filesChanged = 0;

  for (const file of files) {
    const changes = fixFrontmatter(file);
    if (changes.length > 0) {
      filesChanged++;
      totalChanges += changes.length;
      console.log(`Fixed ${file}: ${changes.join(', ')}`);
    }
  }

  console.log(`\nSummary: ${filesChanged} files fixed with ${totalChanges} total changes.`);
}

main();