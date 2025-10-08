#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
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
  return {
    frontMatter: lines.slice(frontStart + 1, frontEnd).join('\n'),
    frontStart,
    frontEnd,
    lines
  };
}

function fixYamlFrontMatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    // Try to parse with gray-matter first
    const parsed = matter(content);
    const frontmatter = parsed.data;
    const body = parsed.content;

    // Clean up the frontmatter values
    let changed = false;
    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value === 'string') {
        // Clean up multi-line strings
        const cleaned = value.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned !== value) {
          frontmatter[key] = cleaned;
          changed = true;
        }
      }
    }

    if (changed) {
      const newContent = matter.stringify(body, frontmatter);
      fs.writeFileSync(filePath, newContent);
      return true;
    }
  } catch (error) {
    // If gray-matter fails, try manual repair
    const lines = content.split(/\r?\n/);

    // Find front matter boundaries
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

    // Extract front matter and manually rebuild it
    const frontText = lines.slice(frontStart + 1, frontEnd).join('\n');

    // Try to manually parse and fix the most common issues
    const fixedLines = [];
    const frontLines = frontText.split('\n');

    for (let i = 0; i < frontLines.length; i++) {
      const line = frontLines[i];

      // Skip extra --- markers
      if (line.trim() === '---') {
        continue;
      }

      // Skip spurious continuation lines (...)
      if (line.trim() === '...') {
        continue;
      }

      // Handle lines with multiple field: value pairs
      if (line.includes(': ') && line.split(': ').length > 2) {
        // Parse field: value pairs, handling quoted strings properly
        let remaining = line.trim();
        while (remaining) {
          // Match field: followed by either quoted string or unquoted value
          const fieldMatch = remaining.match(/^(\w+):\s*/);
          if (!fieldMatch) break;

          const field = fieldMatch[1];
          remaining = remaining.substring(fieldMatch[0].length);

          let value = '';
          let inQuotes = false;
          let escapeNext = false;

          for (let i = 0; i < remaining.length; i++) {
            const char = remaining[i];

            if (escapeNext) {
              value += char;
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"' && !inQuotes) {
              inQuotes = true;
              value += char;
              continue;
            }

            if (char === '"' && inQuotes) {
              inQuotes = false;
              value += char;
              // Check if next character is space or another field (end of value)
              if (i + 1 >= remaining.length || remaining[i + 1] === ' ' || remaining.substring(i + 1).match(/^\s+\w+:/)) {
                remaining = remaining.substring(i + 1).trim();
                break;
              }
              continue;
            }

            if (!inQuotes && remaining.substring(i).match(/^\s+\w+:/)) {
              // Next field starts
              remaining = remaining.substring(i).trim();
              break;
            }

            value += char;
          }

          // Clean the value
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
          }

          fixedLines.push(`${field}: "${value}"`);
        }
        continue;
      }

      fixedLines.push(line);
    }

    const newFrontText = fixedLines.join('\n');
    if (newFrontText !== frontText) {
      const newContent = `---\n${newFrontText}\n---\n${lines.slice(frontEnd + 1).join('\n')}`;
      fs.writeFileSync(filePath, newContent);
      return true;
    }
  }

  return false;
}

function checkYamlParsing(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yamlString = extractFrontMatter(content)?.frontMatter;
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
  const errorsBefore = [];
  const fixedFiles = [];

  // First pass: identify files with errors
  for (const file of files) {
    const error = checkYamlParsing(file);
    if (error) {
      errorsBefore.push(file);
    }
  }

  console.log(`Found ${errorsBefore.length} files with YAML parsing errors.`);

  // Second pass: fix the errors
  for (const file of errorsBefore) {
    const fixed = fixYamlFrontMatter(file);
    if (fixed) {
      fixedFiles.push(file);
    }
  }

  console.log(`\nAttempted to fix ${fixedFiles.length} files.`);

  // Third pass: verify fixes
  const remainingErrors = [];
  for (const file of errorsBefore) {
    const error = checkYamlParsing(file);
    if (error) {
      remainingErrors.push({ file, error });
    }
  }

  if (remainingErrors.length === 0) {
    console.log('\nAll YAML parsing errors have been fixed!');
  } else {
    console.log(`\n${remainingErrors.length} files still have errors after fixing:`);
    for (const { file, error } of remainingErrors) {
      console.log(`\n${file}:`);
      console.log(`  Message: ${error.message}`);
      if (error.hasLine) {
        console.log(`  Line: ${error.line}, Column: ${error.column}`);
      }
    }
  }
}

main();