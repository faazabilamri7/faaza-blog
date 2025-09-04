import { algoliasearch } from 'algoliasearch';
import { fetchPosts } from './blog';

const appId = process.env.ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_API_KEY;

if (!appId || !adminKey) {
  console.warn('Algolia credentials not found. Skipping indexing.');
  process.exit(0);
}

const client = algoliasearch(appId, adminKey);
const index = client.initIndex('posts');

export async function indexPosts() {
  try {
    const posts = await fetchPosts();

    const records = posts.map((post) => ({
      objectID: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.Content ? '' : post.content, // For full-text search
      permalink: post.permalink,
      publishDate: post.publishDate.getTime(),
      category: post.category,
      tags: post.tags,
      author: post.author,
    }));

    await index.saveObjects(records);
    console.log(`Indexed ${records.length} posts to Algolia`);
  } catch (error) {
    console.error('Error indexing posts:', error);
  }
}

if (import.meta.main) {
  indexPosts();
}