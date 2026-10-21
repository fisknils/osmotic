import type { SitePage } from '../create-site.js';

// A small web shop: categories with pagination, product pages, and the links a real
// shop has besides: nofollow, mailto:, javascript:, fragments, another host, a PDF,
// a dead link, a redirect from an old URL, and a robots.txt that keeps crawlers out
// of /admin/ and /cart.

interface Product {
	slug: string;
	name: string;
	price: number;
	tags: string[];
	power: string;
	sale?: boolean;
}

export const products: Product[] = [
	{ slug: 'desk-lamp', name: 'Desk lamp', price: 499, tags: ['LED', 'Dimmable'], power: '9 W', sale: true },
	{ slug: 'floor-lamp', name: 'Floor lamp', price: 1299, tags: ['LED'], power: '24 W' },
	{ slug: 'usb-charger', name: 'USB charger', price: 199, tags: [], power: '65 W' },
];

const bySlug = (slug: string) => products.find((p) => p.slug === slug)!;

const listItem = (p: Product) => `
	<li class="product" data-sku="${p.slug.toUpperCase()}">
		<a href="/product/${p.slug}"><h2>${p.name}</h2></a>
		<span class="price">${p.price} kr</span>
		${p.sale ? '<span class="badge-sale">Sale</span>' : ''}
	</li>`;

const productPage = (p: Product) => `<!doctype html>
<html>
<head>
	<title>${p.name} | Gadget Shop</title>
	<meta property="og:image" content="/img/${p.slug}.jpg">
	<script type="application/ld+json">{"@type":"Product","name":"${p.name}"}</script>
</head>
<body>
	<h1> ${p.name} </h1>
	<p class="price"><span class="value">${p.price}</span> <span class="currency">SEK</span></p>
	<ul class="tags">${p.tags.map((t) => `<li class="tag">${t}</li>`).join('')}</ul>
	<table class="specs">
		<tr><td>Power</td><td>${p.power}</td></tr>
		<tr><td>Colour</td><td>Black</td></tr>
	</table>
	<img class="photo" src="/img/${p.slug}.jpg" srcset="/img/${p.slug}.jpg 1x, /img/${p.slug}@2x.jpg 2x" alt="${p.name}">
	<a class="manual" href="/manuals/${p.slug}.pdf">Manual</a>
	<a class="back" href="/">Home</a>
</body>
</html>`;

export const shop: Record<string, SitePage> = {
	'/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /admin/\nDisallow: /cart\n' },
	'/': `<!doctype html>
<html>
<head><title>Gadget Shop</title></head>
<body>
	<nav>
		<a href="/category/lamps">Lamps</a>
		<a href="/category/chargers">Chargers</a>
		<a href="/cart" rel="nofollow">Cart</a>
		<a href="/admin/">Admin</a>
		<a href="mailto:shop@example.com">Mail us</a>
		<a href="javascript:void(0)">Menu</a>
		<a href="{{otherOrigin}}/partner">Partner</a>
	</nav>
	<section class="featured"><a href="/product/desk-lamp#reviews">Desk lamp</a></section>
</body>
</html>`,
	'/category/lamps': `<!doctype html>
<html><body>
	<h1>Lamps</h1>
	<ul class="products">${listItem(bySlug('desk-lamp'))}</ul>
	<a rel="next" href="/category/lamps?page=2">Next</a>
</body></html>`,
	'/category/lamps?page=2': `<!doctype html>
<html><body>
	<h1>Lamps</h1>
	<ul class="products">${listItem(bySlug('floor-lamp'))}</ul>
	<a rel="prev" href="/category/lamps">Previous</a>
</body></html>`,
	'/category/chargers': `<!doctype html>
<html><body>
	<h1>Chargers</h1>
	<ul class="products">
		<li class="product"><a href="/product/old-charger"><h2>USB charger</h2></a><span class="price">199 kr</span></li>
		<li class="product"><a href="/product/discontinued"><h2>Discontinued</h2></a><span class="price">99 kr</span></li>
	</ul>
</body></html>`,
	'/product/old-charger': { status: 301, redirect: '/product/usb-charger' },
	...Object.fromEntries(products.map((p) => [`/product/${p.slug}`, productPage(p)])),
	...Object.fromEntries(products.map((p) => [`/manuals/${p.slug}.pdf`, { type: 'application/pdf', body: '%PDF-1.7' }])),
	'/cart': '<!doctype html><html><body><h1>Cart</h1></body></html>',
	'/admin/': '<!doctype html><html><body><h1>Admin</h1></body></html>',
	'/partner': '<!doctype html><html><body><h1>Partner</h1><a href="/">Partner home</a></body></html>',
};
