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

function checkAndFixFile(filePath) {
  const issues = [];
  let fixed = false;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const frontmatter = parsed.data;
    const body = parsed.content;

    // Check for title
    if (!frontmatter.title || frontmatter.title.trim() === '') {
      issues.push('Missing required field: title');
      // Fix: add a default title based on filename
      const filename = path.basename(filePath, path.extname(filePath));
      frontmatter.title = filename.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      fixed = true;
    }

    if (fixed) {
      const newContent = matter.stringify(body, frontmatter);
      fs.writeFileSync(filePath, newContent);
    }

  } catch (error) {
    issues.push(`YAML parsing failed: ${error.message}`);
    // For parsing errors, we can't easily fix automatically, so just log
  }

  return { issues, fixed };
}

function main() {
  const files = getAllMarkdownFiles(POST_DIR);
  const report = [];
  let totalFixed = 0;

  for (const file of files) {
    const { issues, fixed } = checkAndFixFile(file);
    if (issues.length > 0) {
      report.push({ file, issues });
    }
    if (fixed) {
      totalFixed++;
    }
  }

  if (report.length === 0) {
    console.log('All files have valid YAML front matter and required fields.');
  } else {
    console.log('Issues found:');
    for (const { file, issues } of report) {
      console.log(`\n${file}:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
  }

  if (totalFixed > 0) {
    console.log(`\nFixed ${totalFixed} files.`);
  }
}

main();