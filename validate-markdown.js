#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

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

function validateFile(filePath) {
  const issues = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data;
  const body = parsed.content;

  // Extract title
  const title = frontmatter.title;
  if (!title) {
    issues.push({ type: 'missing_title', message: 'Frontmatter title is missing', line: 1 });
  }

  // Check body for first heading
  const lines = body.split('\n');
  let firstHeading = null;
  let firstHeadingLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) {
      firstHeading = line.replace(/^#+\s*/, '').trim();
      firstHeadingLine = i + 1; // 1-based
      break;
    }
  }

  if (firstHeading && title && firstHeading.toLowerCase() === title.trim().toLowerCase()) {
    issues.push({ type: 'duplicate_title', message: `First heading "${firstHeading}" matches frontmatter title`, line: firstHeadingLine });
  }

  // Basic formatting checks
  let inCodeBlock = false;
  let codeBlockStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        codeBlockStart = i + 1;
      }
    }

    if (inCodeBlock) continue;

    // Headings
    if (trimmed.startsWith('#')) {
      if (line !== trimmed) {
        issues.push({ type: 'heading_format', message: 'Heading has leading spaces', line: i + 1 });
      }
    }

    // Lists
    const listMatch = trimmed.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (listMatch) {
      const indent = listMatch[1].length;
      if (indent % 2 !== 0) {
        issues.push({ type: 'list_indentation', message: 'List item has inconsistent indentation', line: i + 1 });
      }
    }

    // Links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const url = match[2];
      if (!url || url.trim() === '') {
        issues.push({ type: 'malformed_link', message: 'Link has empty URL', line: i + 1 });
      }
    }
  }

  if (inCodeBlock) {
    issues.push({ type: 'unclosed_code_block', message: 'Code block not closed', line: codeBlockStart });
  }

  return issues;
}

function main() {
  const files = getAllMarkdownFiles(POST_DIR);
  const report = {};

  for (const file of files) {
    const issues = validateFile(file);
    if (issues.length > 0) {
      report[file] = issues;
    }
  }

  if (Object.keys(report).length === 0) {
    console.log('No issues found.');
  } else {
    console.log('Validation Report:');
    for (const [file, issues] of Object.entries(report)) {
      console.log(`\nFile: ${file}`);
      for (const issue of issues) {
        console.log(`  Line ${issue.line}: ${issue.type} - ${issue.message}`);
      }
    }
  }
}

main();