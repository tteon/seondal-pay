/**
 * print_deck.js — render docs/deck/slides.html to a 16:9 PDF via headless Chrome.
 * Run: node scripts/print_deck.js
 */
const path = require('path');
const puppeteer = require(path.join('/home/hadry/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer'));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  const fileUrl = 'file://' + path.resolve(__dirname, '../docs/deck/slides.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  // wait for charts to render
  await new Promise((r) => setTimeout(r, 2500));
  await page.pdf({
    path: path.resolve(__dirname, '../docs/SEONDAL_Pay_소개서.pdf'),
    width: '338.667mm',
    height: '190.5mm',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  console.log('PDF generated: docs/SEONDAL_Pay_소개서.pdf');
})().catch((e) => { console.error(e); process.exit(1); });
