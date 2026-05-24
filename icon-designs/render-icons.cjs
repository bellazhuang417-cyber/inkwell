const { chromium } = require('playwright');
const path = require('path');

const DESIGN_DIR = '/Users/bellazhuang/Documents/Bella_AI_World/htmlnote/icon-designs';
const ICONS = [
  { name: 'icon-a-abstract', svg: 'icon-a-abstract.svg' },
  { name: 'icon-b-monogram', svg: 'icon-b-monogram.svg' },
  { name: 'icon-c-vellum', svg: 'icon-c-vellum.svg' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  
  for (const icon of ICONS) {
    const svgPath = path.join(DESIGN_DIR, icon.svg);
    const pngPath = path.join(DESIGN_DIR, `${icon.name}.png`);
    
    // Read SVG content
    const fs = require('fs');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Create an HTML page with the SVG at full size
    const html = `<!DOCTYPE html>
<html><head><style>
html, body { margin: 0; padding: 0; width: 1024px; height: 1024px; overflow: hidden; }
svg { width: 1024px; height: 1024px; display: block; }
</style></head><body>${svgContent}</body></html>`;
    
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: pngPath, type: 'png', omitBackground: false });
    console.log(`✅ Generated ${icon.name}.png`);
  }
  
  await browser.close();
  console.log('All icons generated!');
})();
