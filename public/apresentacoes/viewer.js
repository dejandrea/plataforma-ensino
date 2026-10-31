import { validatePresentation } from './validate.js';
import { selectMascot } from '../biblioteca-bitara/select.js';

const byId = id => document.getElementById(id);
let deck, schema, index = 0;
const root = byId('slide');
const embeddedNonce=new URLSearchParams(location.search).get('embedded');
let managedAssets=null,managedVersion=null;
let catalogPromise;
function mascotFigure(request) {
  const figure = element('figure', null, 'mascot');
  catalogPromise ??= readJson('../biblioteca-bitara/catalog.json').catch(() => null);
  void catalogPromise.then(catalog => {
    if (!figure.isConnected) return;
    const selected = selectMascot(catalog, request);
    if (!selected) { figure.append(element('p', 'Imagem da Bitara indisponível.', 'mascot-unavailable')); return; }
    const image = element('img');
    image.alt = selected.alt; image.width = selected.width; image.height = selected.height;
    image.decoding = 'async'; image.dataset.mascotId = selected.id;
    let fallbackUsed = false;
    image.addEventListener('error', () => {
      const fallback = selectMascot(catalog);
      if (!fallbackUsed && fallback && fallback.id !== image.dataset.mascotId) {
        fallbackUsed = true; image.alt = fallback.alt; image.width = fallback.width; image.height = fallback.height;
        image.dataset.mascotId = fallback.id; image.src = fallback.src;
      } else image.replaceWith(element('p', 'Imagem da Bitara indisponível.', 'mascot-unavailable'));
    });
    image.src = selected.src; figure.append(image);
  });
  return figure;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function referenceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') ? url : null;
  } catch { return null; }
}
function referenceLink(url, text = url.href) {
  const link = element('a', text);
  link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
function go(next, focus = true) {
  if (!deck) return;
  index = Math.max(0, Math.min(deck.slides.length - 1, next));
  const slide = deck.slides[index];
  root.replaceChildren();
  root.className = `slide layout-${slide.type}`;
  if (slide.mascot) root.classList.add('has-mascot');
  root.scrollTop = 0;
  const heading = element('div', null, 'heading');
  heading.append(element('p', slide.eyebrow ?? `MISSÃO ${String(index + 1).padStart(2, '0')}`, 'eyebrow'));
  const title = element('h1', slide.title); title.id = 'slide-title'; heading.append(title);
  if (slide.subtitle) heading.append(element('p', slide.subtitle, 'subtitle'));
  root.append(heading);
  const content = element('div', null, 'content');
  if (slide.body) content.append(element('p', slide.body, 'body'));
  if (!slide.mascot && (slide.type === 'cover' || slide.type === 'closing')) {
    const orbit = element('div', null, 'orbit'); orbit.setAttribute('aria-hidden', 'true');
    orbit.append(element('span', slide.type === 'cover' ? '</>' : '✓', 'orbit-core')); content.append(orbit);
  }
  if (slide.type === 'image') {
    const figure = element('figure'); const image = element('img');
    image.src = managedAssets ? managedAssets[slide.image.src] : new URL(slide.image.src, location.href).href;
    image.dataset.resourcePath=slide.image.src; image.alt = slide.image.alt;
    image.addEventListener('error', () => { image.replaceWith(element('p', `Imagem indisponível: ${slide.image.alt}`, 'image-error')); });
    figure.append(image);
    const licenses = (slide.sources ?? []).map(referenceUrl).filter(url => url?.hostname === 'creativecommons.org' && /^\/(licenses|publicdomain)\//.test(url.pathname));
    if (slide.image.caption || licenses.length) {
      const caption = element('figcaption', slide.image.caption);
      for (const url of licenses) caption.append(document.createTextNode(' '), referenceLink(url, 'Ver licença da imagem ↗'));
      figure.append(caption);
    }
    content.append(figure);
  }
  if (slide.columns) {
    const columns = element('div', null, 'columns');
    slide.columns.forEach((column, i) => { const block = element('section', null, `comparison side-${i}`); block.append(element('h2', column.title), element('p', column.body)); columns.append(block); });
    content.append(columns);
  }
  if (slide.items) {
    const list = element(slide.type === 'steps' || slide.type === 'timeline' ? 'ol' : 'ul', null, 'items');
    slide.items.forEach((item, i) => {
      const entry = element('li'); entry.append(element('span', item.label ?? String(i + 1).padStart(2, '0'), 'item-label'));
      const detail = element('div'); detail.append(element('h2', item.title)); if (item.body) detail.append(element('p', item.body)); entry.append(detail); list.append(entry);
    }); content.append(list);
  }
  if (slide.code) { const pre = element('pre'); pre.append(element('code', slide.code)); content.append(pre); }
  root.append(content);
  if (slide.mascot) root.append(mascotFigure(slide.mascot));
  if (slide.note) root.append(element('p', slide.note, 'note'));
  if (slide.sources) {
    const details = element('details', null, 'sources'); details.append(element('summary', 'Fontes e referências'));
    const list = element('ul');
    slide.sources.forEach(source => {
      const item = element('li'); const url = referenceUrl(source);
      item.append(url ? referenceLink(url) : document.createTextNode(source)); list.append(item);
    });
    details.append(list); root.append(details);
  }
  byId('previous').disabled = index === 0;
  byId('next').disabled = index === deck.slides.length - 1;
  byId('position').textContent = `${index + 1} / ${deck.slides.length}`;
  byId('progress').max = deck.slides.length; byId('progress').value = index + 1;
  if (focus) root.focus({ preventScroll: true });
}
function load(value) {
  const errors = validatePresentation(value, schema);
  if (errors.length) throw new Error(errors.slice(0, 8).join('\n'));
  deck = value; document.title = `${deck.title} · Bitaria`; byId('deck-title').textContent = deck.title;
  byId('error').hidden = true; go(0, false);
}
function showError(cause) {
  byId('error').textContent = `Não foi possível abrir a apresentação. ${cause.message}`;
  byId('error').hidden = false;
  if (!deck) root.replaceChildren(element('p', 'Escolha um arquivo JSON válido para tentar novamente.'));
}
byId('previous').addEventListener('click', () => go(index - 1));
byId('next').addEventListener('click', () => go(index + 1));
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A/.test(event.target.tagName)) return;
  const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: deck?.slides.length - 1 }[event.key];
  if (next !== undefined) { event.preventDefault(); go(next); }
});
let touch;
root.addEventListener('touchstart', event => { if (event.touches.length === 1) touch = {x:event.touches[0].clientX,y:event.touches[0].clientY}; }, {passive:true});
root.addEventListener('touchend', event => {
  if (!touch) return;
  const dx = event.changedTouches[0].clientX - touch.x, dy = event.changedTouches[0].clientY - touch.y; touch = null;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
}, {passive:true});
root.addEventListener('touchcancel', () => { touch = null; });
const fullscreen = byId('fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await byId('presentation').requestFullscreen(); }
  catch { byId('error').textContent = 'Tela cheia indisponível neste navegador. Você pode continuar usando os botões.'; byId('error').hidden = false; }
});
document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; });
byId('file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (!schema) throw new Error('Recarregue a página para carregar o contrato.'); if (file.size > 512000) throw new Error('O arquivo deve ter até 500 KB.'); load(JSON.parse(await file.text())); }
  catch (cause) { showError(cause); }
  event.target.value = '';
});
async function readJson(url) { const response = await fetch(url); if (!response.ok) throw new Error('Arquivo não encontrado.'); return response.json(); }
function receiveBundle(event){
  if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='bitara-presentation-data'||event.data.nonce!==embeddedNonce)return;
  try{
    const {deck:next,assets,versionKey,assetOrigin}=event.data;
    const errors=validatePresentation(next,schema);if(errors.length)throw new Error(errors.slice(0,8).join('\n'));
    if(!assets||typeof assets!=='object'||Array.isArray(assets)||typeof versionKey!=='string'||versionKey.length>100)throw new Error('Arquivos de prévia inválidos.');
    const verified=Object.create(null);
    for(const slide of next.slides){
      if(!slide.image)continue;
      const path=slide.image.src;
      if(!Object.hasOwn(assets,path)||typeof assets[path]!=='string')throw new Error('Imagem da versão indisponível.');
      const url=new URL(assets[path]);
      const localBlob=url.protocol==='blob:'&&url.origin===location.origin;
      const privateStorage=url.origin===assetOrigin&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))&&url.pathname.startsWith('/storage/v1/object/sign/web-presentations/');
      if(!localBlob&&!privateStorage)throw new Error('Origem de imagem não autorizada.');
      verified[path]=url.href;
    }
    managedAssets=verified;
    if(managedVersion===versionKey&&deck){
      root.querySelectorAll('img[data-resource-path]').forEach(image=>{const nextUrl=verified[image.dataset.resourcePath];if(nextUrl&&image.src!==nextUrl)image.src=nextUrl;});
    }else{managedVersion=versionKey;load(next);}
  }catch(cause){showError(cause);}
}
if(embeddedNonce){
  document.body.classList.add('embedded');
  const announce=()=>window.parent.postMessage({type:'bitara-presentation-height',nonce:embeddedNonce,height:document.getElementById('presentation').scrollHeight+5},location.origin);
  new ResizeObserver(announce).observe(document.getElementById('presentation'));
}
try {
  schema = await readJson('./presentation.schema.json');
  if(embeddedNonce){
    if(window.parent===window||!/^[a-f0-9-]{36}$/.test(embeddedNonce))throw new Error('Abra esta apresentação pelo painel ou pela aula.');
    byId('file').closest('label').hidden=true;
    document.querySelector('.brand').removeAttribute('href');
    window.addEventListener('message',receiveBundle);
    window.parent.postMessage({type:'bitara-presentation-ready',nonce:embeddedNonce},location.origin);
  }else{
    const name = new URLSearchParams(location.search).get('deck') ?? 'aula-02-demo';
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(name)) throw new Error('Nome de apresentação inválido.');
    load(await readJson(`./decks/${name}.json`));
  }
} catch (cause) { showError(cause); }
