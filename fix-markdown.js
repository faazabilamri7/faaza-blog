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

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  let frontmatter = parsed.data;
  let body = parsed.content;
  let changes = [];

  // Fix missing title
  if (!frontmatter.title) {
    const filename = path.basename(filePath, path.extname(filePath));
    frontmatter.title = filename;
    changes.push('added title to frontmatter');
  }

  // Fix body issues
  const lines = body.split('\n');
  let newLines = [];
  let removedHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Remove duplicate title heading (first one that matches)
    if (!removedHeading && trimmed.startsWith('#')) {
      const headingText = trimmed.replace(/^#+\s*/, '').trim();
      if (headingText.toLowerCase() === frontmatter.title.toLowerCase()) {
        removedHeading = true;
        changes.push('removed duplicate title heading');
        continue;
      }
    }

    // Fix heading format: remove leading spaces
    if (trimmed.startsWith('#') && line !== trimmed) {
      newLines.push(trimmed);
      changes.push('fixed heading format');
    } else {
      newLines.push(line);
    }
  }

  body = newLines.join('\n');

  // Reconstruct and save
  const newContent = matter.stringify(body, frontmatter);
  fs.writeFileSync(filePath, newContent);

  return changes;
}

function main() {
  const files = getAllMarkdownFiles(POST_DIR);
  let totalChanges = 0;
  let filesChanged = 0;

  for (const file of files) {
    const changes = fixFile(file);
    if (changes.length > 0) {
      filesChanged++;
      totalChanges += changes.length;
      console.log(`Fixed ${file}: ${changes.join(', ')}`);
    }
  }

  console.log(`\nSummary: ${filesChanged} files fixed with ${totalChanges} total changes.`);
}

main();