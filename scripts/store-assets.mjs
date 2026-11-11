import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';

const directory = 'docs/store/assets';
await mkdir(directory, { recursive: true });
const logo = `data:image/svg+xml;base64,${Buffer.from(await readFile('extension/icons/logo.svg')).toString('base64')}`;
const popup = `data:image/png;base64,${Buffer.from(await readFile('test-results/chrome/popup.png')).toString('base64')}`;
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const render = async (name, width, height, body, css = '') => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:'Segoe UI',system-ui,sans-serif;color:#21324d}body{background:#f1f5fa}${css}</style></head><body>${body}</body></html>`);
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await writeFile(`${directory}/${name}.png`, await page.screenshot({ omitBackground: true }));
    await page.close();
  };
  await render('icon-128', 128, 128, `<img src="${logo}" width="96" height="96" style="margin:16px">`, 'body{background:transparent}');
  await render('edge-icon-300', 300, 300, `<img src="${logo}" width="244" height="244" style="margin:28px">`, 'body{background:transparent}');
  await render('screenshot-1280x800', 1280, 800, `<main><section><img class="brand" src="${logo}"><div class="eyebrow">VOLUMEBOOSTER</div><h1>Your tab.<br>Your volume.</h1><p>A little louder. Just right.</p><ul><li>One-click volume presets</li><li>Smooth controls, up to 400%</li><li>Local audio. No account.</li></ul><div class="browsers">Chrome &nbsp;·&nbsp; Edge &nbsp;·&nbsp; Brave &nbsp;·&nbsp; Firefox</div></section><div class="preview"><img src="${popup}" alt="Actual VolumeBooster popup"></div></main><div class="note">Firefox supports compatible media players. Fullscreen and protected-media support vary by player and browser.</div>`, `
    body{background:radial-gradient(ellipse at 85% 35%,#d7eee8,transparent 55%),#eff3f9}
    main{height:750px;display:flex;align-items:center;justify-content:center;gap:90px;padding:40px 70px}
    section{width:440px}.brand{width:68px;height:68px;margin-bottom:24px}.eyebrow{font-size:13px;font-weight:700;letter-spacing:3px;color:#52756b}
    h1{font-size:70px;line-height:1.08;letter-spacing:-3px;margin:18px 0 14px}p{font-size:24px;color:#65778f;margin:0 0 30px}
    ul{list-style:none;padding:0;line-height:2;font-size:18px;color:#4c637b}li:before{content:'✓';color:#26765e;margin-right:12px;font-weight:700}.browsers{font-size:14px;color:#647b8e;margin-top:34px}
    .preview{border-radius:20px;overflow:hidden;box-shadow:0 20px 65px #23394a25;border:1px solid #dce7e8;width:390px;flex-shrink:0}.preview img{width:100%;display:block}.note{text-align:center;font-size:12px;color:#6b7e8e;padding:8px 30px}
  `);
  await render('promo-440x280', 440, 280, `<img src="${logo}" class="mark"><h1>VolumeBooster</h1><p>A little louder.<br>Just right.</p><span>Local audio · Simple controls</span>`, `body{padding:28px 32px;background:linear-gradient(135deg,#f2f7fb,#dbefe7)}.mark{width:48px;height:48px;float:right}h1{font-size:26px;letter-spacing:-1px;margin:0 0 22px;padding-top:9px}p{font-size:33px;line-height:1.2;font-weight:650;letter-spacing:-1px;margin:0 0 22px}span{font-size:12px;color:#607e77}`);
  await render('marquee-1400x560', 1400, 560, `<img src="${logo}" class="mark"><section><span>VOLUMEBOOSTER</span><h1>A little louder. Just right.</h1><p>Smooth, local volume control for your browser tabs.</p><div>Chrome &nbsp;·&nbsp; Edge &nbsp;·&nbsp; Brave &nbsp;·&nbsp; Firefox</div></section>`, `body{display:flex;align-items:center;justify-content:center;gap:64px;background:linear-gradient(125deg,#eff4fb,#def1e8)}.mark{width:180px;height:180px}section>span{letter-spacing:4px;font-size:16px;color:#56806e}h1{font-size:58px;letter-spacing:-2px;margin:20px 0}p{font-size:23px;color:#687f8c}section>div{font-size:15px;color:#668c7d;margin-top:32px}`);
  await cp('test-results/chrome/popup.png', 'docs/assets/popup.png');
} finally { await browser.close(); }
console.log(`Rendered store assets: ${directory}`);
