import fs from 'fs';
import path from 'path';

const frontMatter = `---

title:

category:

tags:

description:

pubDate:

draft: false

excerpt:

---

`;

function addFrontMatter(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      addFrontMatter(fullPath);
    } else if (file.name.endsWith('.md') || file.name.endsWith('.mdx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.startsWith('---')) {
        const newContent = frontMatter + content;
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Added front matter to ${fullPath}`);
      }
    }
  }
}

addFrontMatter('src/data/post');