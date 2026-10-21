const { Osmotic } = require('../dist/index.cjs');

Osmotic.get("https://news.ycombinator.com")
  .recurse('a[rel="next"]@href')
  .find("tr.athing")
  .set({ rank: ".rank", title: ".titleline > a", href: ".titleline > a@href" })
  .data((item) => console.log(item))
  .csv('news.ycombinator.com.csv')
  .config({ maxPages: 100, concurrency: 2, respectCrawlDelay: false })
  .run();