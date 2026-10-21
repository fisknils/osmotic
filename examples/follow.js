const { Osmotic } = require('../dist/index.cjs');

// Targeted: front page -> each story -> the linked page
Osmotic.get('https://news.ycombinator.com')
	.find('tr.athing')
	.set({ rank: '.rank', title: '.titleline > a' })
	.follow('.titleline > a@href')
	.set({ pageTitle: 'title' })
	.csv('hn.csv')
	.config({ maxPages: 11 })
	.run();
