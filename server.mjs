import { buildDescriptionPrompt } from './description-prompt.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const root = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(root, '.env')); } catch {}
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(root, '.data');
await fs.mkdir(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'workbench.json');
const criteria = ['Critical Role', 'Media Coverage', 'Key Position', 'Commercial Success', 'Recommendation Letters', 'High Salary'];
let db;
try { db = JSON.parse(await fs.readFile(dbFile, 'utf8')); } catch {
  db = { applicants: [
    { id: 'taylor', name: 'Taylor Smith', visaType: 'O1B', occupation: 'Musician', createdAt: new Date().toISOString() },
    { id: 'emma', name: 'Emma Chen', visaType: 'O1B', occupation: 'Visual Artist', createdAt: new Date().toISOString() },
    { id: 'david', name: 'David Lee', visaType: 'O1B', occupation: 'Research Scientist', createdAt: new Date().toISOString() }
  ], evidence: [] };
  await fs.writeFile(dbFile, JSON.stringify(db, null, 2));
}
let writeQueue = Promise.resolve();
function persist() { const snapshot = JSON.stringify(db, null, 2); writeQueue = writeQueue.then(async () => { await fs.writeFile(dbFile + '.tmp', snapshot); await fs.rename(dbFile + '.tmp', dbFile); }); return writeQueue; }
function json(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function body(req) { let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 35 * 1024 * 1024) throw new Error('Request too large. Upload fewer or smaller images.'); } return JSON.parse(text || '{}'); }
const safeText = v => typeof v === 'string' ? v.trim() : '';
const isImage = v => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v) && v.length < 12 * 1024 * 1024;
function privateIP(ip) {
  if (net.isIP(ip) === 6) return !/^[23][0-9a-f]{3}:/i.test(ip);
  const p = ip.split('.').map(Number);
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 198 && [18,19].includes(p[1]));
}
async function validateURL(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('请输入公开网页的完整链接（http 或 https）。');
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true });
  if (!addresses.length || addresses.some(x => privateIP(x.address))) throw new Error('不支持本机或内网地址，请使用公开网页链接。');
  return url.href;
}
const escape = text => String(text || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sampleHTML = `<!doctype html><html><head><meta charset="utf-8"><title>Independent artists take the spotlight | Studio Journal</title></head><body style="margin:0;background:#f0f2f4;font-family:Arial;color:#172b38"><header style="padding:24px;background:#172b38;color:white">STUDIO JOURNAL　　Culture　 Music　 Design　 Subscribe</header><div style="display:flex;gap:40px;padding:40px"><article style="background:white;max-width:820px;padding:40px"><p>PERFORMANCE / ARTIST SPOTLIGHT</p><h1 style="font-size:44px;line-height:1.15">Independent artists take the spotlight</h1><p class="byline">By Morgan Ellis · September 8, 2026</p><p style="font-size:22px;line-height:1.6">An intimate evening of original music brought independent performers together at the Studio Sessions showcase.</p><blockquote style="border-left:4px solid #229781;margin:32px 0;padding:20px;font-size:32px;background:#eff8f5">“A space for original voices and shared creative work.”</blockquote><p style="font-size:20px;line-height:1.6">Musician Taylor Smith performed an original set as part of the evening's program. The showcase featured a series of live performances and conversations about the creative process.</p><p style="font-size:20px;line-height:1.6">The program provided an opportunity for the participating musicians to present their work in a dedicated live setting.</p><p>Sample article created for this demo. Names, publication and event are fictional.</p></article><aside style="width:240px">ADVERTISEMENT<br><br>Recommended stories<br><br>Subscribe to our newsletter</aside></div><footer>About · Contact · Privacy</footer></body></html>`;
let browserPromise;
async function getBrowser() {
  if (!browserPromise) browserPromise = import('playwright').then(async ({chromium}) => {
    const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
    for (const executablePath of candidates) { try { await fs.access(executablePath); return await chromium.launch({headless:true, executablePath}); } catch {} }
    return chromium.launch({headless:true});
  }).catch(e => { browserPromise = null; throw e; });
  return browserPromise;
}
let capturing = false;
async function screenshot(input) {
  if (capturing) throw new Error('正在处理另一张截图，请稍后重试。');
  const sample = input.sample === true;
  const sourceURL = sample ? '' : await validateURL(input.url);
  const width = Math.max(480, Math.min(1600, Number(input.width) || 1200));
  const height = Math.max(480, Math.min(2000, Number(input.height) || 900));
  capturing = true;
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
    const checked = new Map();
    await context.route('**/*', async route => {
      const target = route.request().url();
      if (target.startsWith('data:')) return route.continue();
      try {
        const host = new URL(target).hostname;
        if (!checked.has(host)) checked.set(host, validateURL(target));
        await checked.get(host); await validateURL(target);
        await route.continue();
      } catch { await route.abort(); }
    });
    const page = await context.newPage();
    if (sample) await page.setContent(sampleHTML); else {
      const response = await page.goto(sourceURL, {waitUntil:'domcontentloaded',timeout:35000});
      if (response && response.status() >= 400) {
        const status = response.status();
        if ([401,403].includes(status)) throw new Error('此网页可能需要登录、订阅或限制自动访问。请在浏览器中打开可查看的页面，截图后到「图片描述」粘贴或上传。');
        if (status === 429) throw new Error('网站访问过于频繁，请稍后重试，或在浏览器中打开页面后手动截图。');
        throw new Error(`网页暂时无法访问（状态码 ${status}）。请检查链接，或在浏览器中打开页面后手动截图。`);
      }
      await page.waitForLoadState('networkidle', {timeout:5000}).catch(() => {});
    }
    const extractContent = () => page.evaluate(() => {
      const originalTitle = document.title;
      const selectors = 'header,nav,footer,aside,[role="navigation"],[role="banner"],[role="dialog"],.advertisement,.ads,.ad-container,.sidebar,.recommendations,.recommended,.popup,.cookie-banner,script,style,noscript,form';
      document.querySelectorAll(selectors).forEach(el => el.remove());
      const title = document.querySelector('h1')?.textContent?.trim() || originalTitle;
      const author = document.querySelector('[rel="author"],.byline,.author,[class*="author-name"]')?.textContent?.trim() || '';
      const date = document.querySelector('time')?.textContent?.trim() || '';
      const video = document.querySelector('video');
      const candidates = [...document.querySelectorAll('article,main,[role="main"],.article-body,.article-content,.left-container')];
      let main = candidates.sort((a,b) => {
        const score = el => (el.innerText?.length || 0) + el.querySelectorAll('p').length * 100 + el.querySelectorAll('img,video').length * 180 - [...el.querySelectorAll('a')].reduce((n,a)=>n+(a.textContent?.length||0),0)*2;
        return score(b) - score(a);
      })[0];
      if (!main) main = [...document.querySelectorAll('section,div')].filter(el => el.querySelectorAll('p').length >= 2).sort((a,b) => (b.innerText.length/(b.querySelectorAll('*').length+1)) - (a.innerText.length/(a.querySelectorAll('*').length+1)))[0] || document.body;
      const clone = main.cloneNode(true);
      clone.querySelectorAll(selectors + ',h1').forEach(el => el.remove());
      const paragraphs = [...clone.querySelectorAll('p,blockquote,h2,li')].map(el=>({type:el.tagName.toLowerCase(),text:el.textContent.trim()})).filter(x=>x.text.length>25).slice(0,12);
      const imgs = [...main.querySelectorAll('img')].filter(el=>el.naturalWidth>250 && el.naturalHeight>100).slice(0,2).map(el=>({src:el.currentSrc||el.src,alt:el.alt}));
      const isBlocked = /verify you are human|checking your browser|access denied|captcha|just a moment/i.test(title);
      return {title,author,date,paragraphs,images:imgs,isBlocked,video:!!video,poster:video?.poster||'',strategy:location.hostname.includes('bilibili')?'Video content':location.hostname.includes('msn')?'News article':'Main content'};
    });
    let extracted;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.waitForLoadState('domcontentloaded', {timeout:15000});
        if (!sample) await validateURL(page.url());
        extracted = await extractContent();
        break;
      } catch (error) {
        if (!/Execution context was destroyed|Cannot find context/i.test(error.message)) throw error;
        if (attempt === 2) throw new Error('网页持续跳转，暂时无法截图。请在浏览器打开网页，复制跳转后的最终链接重试，或手动截图后上传到 Image Description。');
        await page.waitForLoadState('networkidle', {timeout:5000}).catch(() => {});
      }
    }
    if (extracted.isBlocked || (extracted.paragraphs.length===0 && extracted.images.length===0 && !extracted.video)) throw new Error('无法读取网页正文，网页可能需要登录或限制自动访问。请更换链接，或手动截图后上传。');
    let videoImage = '';
    if (extracted.video) { try { videoImage = 'data:image/png;base64,'+(await page.locator('video').first().screenshot({timeout:5000})).toString('base64'); } catch { videoImage = extracted.poster; } }
    const html = `<html><head><meta charset="utf-8"></head><body style="box-sizing:border-box;margin:0;padding:48px 58px;background:white;color:#1c2834;font:20px/1.65 Arial,sans-serif"><div style="font:13px Arial;color:#647580;letter-spacing:1px;margin-bottom:20px">${sample?'STUDIO JOURNAL · DEMO SAMPLE':escape(new URL(sourceURL).hostname)}</div><h1 style="font-size:40px;line-height:1.18;margin:0 0 18px">${escape(extracted.title)}</h1><div style="color:#697782;font-size:15px;margin-bottom:30px">${escape([extracted.author,extracted.date].filter(Boolean).join(' · '))}</div>${videoImage?`<img src="${escape(videoImage)}" style="width:100%;max-height:500px;object-fit:contain"/>`:''}${extracted.images.slice(0,1).map(i=>`<img src="${escape(i.src)}" alt="${escape(i.alt)}" style="width:100%;max-height:400px;object-fit:contain"/>`).join('')}${extracted.paragraphs.map(p=>`<p style="${p.type==='blockquote'?'padding:20px;border-left:4px solid #249780;background:#f0f8f5;':''}">${escape(p.text)}</p>`).join('')}</body></html>`;
    const canvas = await context.newPage();
    await canvas.setViewportSize({width,height});
    await canvas.setContent(html,{waitUntil:'load',timeout:15000});
    const png = await canvas.screenshot({type:'png',fullPage:false});
    return {id:randomUUID(),name:sample?'studio-journal.png':`${new URL(sourceURL).hostname}.png`,image:'data:image/png;base64,'+png.toString('base64'),sourceURL,title:extracted.title,width,height,strategy:extracted.strategy,sample,sourceText:extracted.paragraphs.map(p=>p.text).join('\n').slice(0,6000)};
  } catch (error) {
    if (/timeout|net::|Execution context|Target.*closed/i.test(error.message)) throw new Error('网页加载超时、跳转或连接中断，暂时无法截图。请稍后重试，或在浏览器中打开页面，截图后到「图片描述」粘贴或上传。');
    throw error;
  } finally { await context?.close(); capturing = false; }
}

async function describe(applicant, item) {
  if (!process.env.OPENAI_API_KEY) {
    const context = safeText(item.context);
    const details = item.sourceText ? `The captured page is titled “${item.title || item.name}”. ${item.sourceText.slice(0,850)}${context ? '\n\nSupplied context: '+context : ''}` : context ? `According to the supplied context: ${context}` : `This image was supplied for review in connection with ${applicant.name}'s work as a ${applicant.occupation.toLowerCase()}. No additional event, role, or outcome has been verified.`;
    return {description:`[Demo draft — review before use]\n\n${details}\n\nFiled for ${applicant.name} under ${item.criterion}. Visual AI analysis is not connected.`,descriptionZh:`【演示草稿】此图片归属于${applicant.name}。${context ? '提供的背景：'+context : '尚未提供背景信息。'}当前未启用 AI 看图，不能核实画面内容。`};
  }
  const response = await fetch('https://api.openai.com/v1/responses', {method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',text:{format:{type:'json_schema',name:'bilingual_description',strict:true,schema:{type:'object',properties:{description:{type:'string'},descriptionZh:{type:'string'}},required:['description','descriptionZh'],additionalProperties:false}}},instructions:buildDescriptionPrompt(applicant,item),input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({applicant:applicant.name,visaType:applicant.visaType,occupation:applicant.occupation,criterion:item.criterion,applicantInImage:item.applicantInImage,context:item.context||'',sourceText:item.sourceText||''})},{type:'input_image',image_url:item.image}]}]})});
  if (!response.ok) throw new Error('图片描述生成失败，请稍后重试或检查服务配置。');
  const result = await response.json();
  const text = result.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  if (!text) throw new Error('未收到图片描述，请重新生成。');
  let descriptions;
  try { descriptions = JSON.parse(text); } catch { throw new Error('描述格式不正确，请重新生成。'); }
  if (!safeText(descriptions.description) || !safeText(descriptions.descriptionZh)) throw new Error('中英文描述不完整，请重新生成。');
  return descriptions;
}

async function api(req,res,url) {
  try {
    if (url.pathname==='/api/state' && req.method==='GET') return json(res,200,{...db,services:{storage:'local',ai:process.env.OPENAI_API_KEY?'connected':'demo',screenshot:'live'}});
    if (url.pathname==='/api/applicants' && req.method==='POST') {
      const x=await body(req); if(!safeText(x.name)||!safeText(x.occupation)||x.visaType!=='O1B') return json(res,400,{error:'请填写姓名、O1B 签证类型和职业。'});
      const applicant={id:randomUUID(),name:safeText(x.name).slice(0,100),occupation:safeText(x.occupation).slice(0,100),visaType:'O1B',createdAt:new Date().toISOString()};
      db.applicants.push(applicant); await persist(); return json(res,201,applicant);
    }
    if(url.pathname==='/api/applicants' && req.method==='DELETE') {
      const x=await body(req);
      if(!db.applicants.some(a=>a.id===x.id))return json(res,404,{error:'申请人不存在。'});
      db.applicants=db.applicants.filter(a=>a.id!==x.id);
      db.evidence=db.evidence.filter(e=>e.applicantId!==x.id);
      await persist();return json(res,200,{deleted:true});
    }
    if(url.pathname==='/api/evidence' && req.method==='DELETE') {
      const x=await body(req);
      if(!db.evidence.some(e=>e.id===x.id))return json(res,404,{error:'材料不存在或已删除。'});
      db.evidence=db.evidence.filter(e=>e.id!==x.id);
      await persist();return json(res,200,{deleted:true});
    }
    if(url.pathname==='/api/screenshot' && req.method==='POST') {const x=await body(req);if(!db.applicants.some(a=>a.id===x.applicantId))return json(res,400,{error:'请先选择申请人。'});return json(res,200,await screenshot(x));}
    if(url.pathname==='/api/describe' && req.method==='POST') {
      const x=await body(req);const applicant=db.applicants.find(a=>a.id===x.applicantId);
      if(!applicant||!Array.isArray(x.images)||!x.images.length||x.images.length>10||x.images.some(i=>!criteria.includes(i.criterion)||!['yes','no','unknown'].includes(i.applicantInImage)||!isImage(i.image)))return json(res,400,{error:'请选择申请人，并为每张图片选择材料类别和申请人是否在画面中（最多 10 张）。'});
      const results=[];for(const item of x.images){try{results.push({id:item.id,...await describe(applicant,item),error:null});}catch(e){results.push({id:item.id,error:e.message});}}
      return json(res,200,{results,mode:process.env.OPENAI_API_KEY?'live':'demo'});
    }
    if(url.pathname==='/api/evidence' && ['POST','PUT'].includes(req.method)) {
      const x=await body(req); const applicant=db.applicants.find(a=>a.id===x.applicantId);
      if(!['yes','no','unknown'].includes(x.applicantInImage))return json(res,400,{error:'请选择申请人是否在画面中。'});
      if(!applicant||!criteria.includes(x.criterion)||!safeText(x.description)||!isImage(x.image))return json(res,400,{error:'请选择申请人、图片和材料类别，并填写描述。'});
      if(x.sourceURL && !/^https?:\/\//i.test(x.sourceURL))return json(res,400,{error:'网页链接格式不正确。'});
      const old=x.savedId?db.evidence.find(e=>e.id===x.savedId):undefined;
      if(x.savedId&&!old)return json(res,404,{error:'找不到这份材料，可能已被删除。'});
      if(old&&old.applicantId!==applicant.id)return json(res,400,{error:'不能将已保存的材料转移到其他申请人。'});
      const evidence={id:old?.id||randomUUID(),applicantId:applicant.id,applicantName:applicant.name,visaType:applicant.visaType,occupation:applicant.occupation,criterion:x.criterion,image:x.image,name:safeText(x.name),description:safeText(x.description),descriptionZh:safeText(x.descriptionZh ?? old?.descriptionZh),applicantInImage:['yes','no','unknown'].includes(x.applicantInImage)?x.applicantInImage:(old?.applicantInImage||'unknown'),context:safeText(x.context),sourceURL:safeText(x.sourceURL),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(old)db.evidence=db.evidence.map(e=>e.id===old.id?evidence:e);else db.evidence.unshift(evidence);
      await persist();return json(res,200,evidence);
    }
    return json(res,404,{error:'Not found'});
  } catch(e) { console.error(e.message); return json(res,400,{error:e.message.includes('Executable doesn')?'截图浏览器尚未安装，请检查安装配置。':e.message}); }
}

const production=process.argv.includes('--production');
const vite=production?null:await (await import('vite')).createServer({root,server:{middlewareMode:true,hmr:false},appType:'spa'});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    const origin=req.headers.origin;
    if(origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(origin))return json(res,403,{error:'This workbench only accepts same-origin requests.'});
    return api(req,res,url);
  }
  if(url.pathname==='/sample/article'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(sampleHTML);return;}
  if(vite) return vite.middlewares(req,res);
  try {const rel=decodeURIComponent(url.pathname); const file=path.resolve(root,'dist','.'+rel);if(!file.startsWith(path.join(root,'dist')+path.sep))throw new Error('route');const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(data);}catch{res.writeHead(200,{'Content-Type':'text/html'});res.end(await fs.readFile(path.join(root,'dist/index.html')));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Visa Assistant ready at http://localhost:${port}`));
async function shutdown(){server.close();await vite?.close();if(browserPromise)await(await browserPromise).close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
