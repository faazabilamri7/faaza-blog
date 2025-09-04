import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root } from 'hast';

interface CodeBlockOptions {
  expandable?: boolean;
  maxHeight?: string;
}

export const codeBlockPlugin: Plugin<[CodeBlockOptions?], Root> = (options = {}) => {
  const { expandable = false, maxHeight = '400px' } = options;

  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'pre' && node.children?.[0]?.tagName === 'code') {
        const codeNode = node.children[0] as any;
        const className = codeNode.properties?.className || [];
        const language = Array.isArray(className)
          ? className.find((cls: string) => cls.startsWith('language-'))?.replace('language-', '') || 'text'
          : 'text';

        const code = codeNode.children?.[0]?.value || '';

        // Extract filename from comment if present (e.g., // filename.js)
        let filename: string | undefined;
        const lines = code.split('\n');
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          if (firstLine.startsWith('//') && firstLine.includes('.')) {
            filename = firstLine.substring(2).trim();
            // Remove the filename line from code
            codeNode.children[0].value = lines.slice(1).join('\n');
          }
        }

        // Create the CodeBlock component structure
        const codeBlockNode = {
          type: 'element',
          tagName: 'CodeBlock',
          properties: {
            code: codeNode.children[0].value,
            language,
            ...(filename && { filename }),
            ...(expandable && { expandable: 'true' }),
            ...(maxHeight && { 'max-height': maxHeight }),
          },
          children: [],
        };

        // Replace the pre element with our CodeBlock component
        if (parent && typeof index === 'number') {
          parent.children[index] = codeBlockNode;
        }
      }
    });
  };
};