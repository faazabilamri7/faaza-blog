#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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

function extractFrontMatter(content) {
  const lines = content.split(/\r?\n/);
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
  if (frontStart === -1 || frontEnd === -1) {
    return null; // No front matter
  }
  return lines.slice(frontStart + 1, frontEnd).join('\n');
}

function checkYamlParsing(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yamlString = extractFrontMatter(content);
    if (yamlString === null) {
      return null; // No front matter to parse
    }
    yaml.load(yamlString); // Try to parse
    return null; // Success
  } catch (error) {
    return {
      message: error.message,
      hasLine: error.mark && typeof error.mark.line === 'number',
      line: error.mark ? error.mark.line : null,
      column: error.mark ? error.mark.column : null
    };
  }
}

function main() {
  const files = getAllMarkdownFiles(POST_DIR);
  const errors = [];

  for (const file of files) {
    const error = checkYamlParsing(file);
    if (error) {
      errors.push({ file, error });
    }
  }

  if (errors.length === 0) {
    console.log('All files have valid YAML front matter.');
  } else {
    console.log(`Found ${errors.length} files with YAML parsing errors:`);
    for (const { file, error } of errors) {
      console.log(`\n${file}:`);
      console.log(`  Message: ${error.message}`);
      if (error.hasLine) {
        console.log(`  Line: ${error.line}, Column: ${error.column}`);
      } else {
        console.log(`  No line information available (this may cause runtime errors)`);
      }
    }
  }
}

main();