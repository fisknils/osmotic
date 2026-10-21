import type { SitePage } from '../create-site.js';

// A blog whose index sets <base href>, so its relative links and images resolve
// against /blog/posts/ instead of the page URL.

export const blog: Record<string, SitePage> = {
	'/blog/': `<!doctype html>
<html>
<head><base href="/blog/posts/"><title>Blog</title></head>
<body>
	<article><a href="first.html">First post</a><img src="first.jpg" alt=""></article>
	<article><a href="second.html">Second post</a><img src="second.jpg" alt=""></article>
	<a href="/about">About</a>
</body>
</html>`,
	'/blog/posts/first.html': '<!doctype html><html><body><h1>First post</h1></body></html>',
	'/blog/posts/second.html': '<!doctype html><html><body><h1>Second post</h1></body></html>',
	'/about': '<!doctype html><html><body><h1>About</h1></body></html>',
};
