const gallery = document.getElementById('gallery');
const category = document.getElementById('category');
const search = document.getElementById('search');
const status = document.getElementById('status');
function node(tag, text) {const el=document.createElement(tag);if(text)el.textContent=text;return el;}
try {
  const response = await fetch('/biblioteca-bitara/catalog.json');
  if (!response.ok) throw new Error('Catálogo indisponível.');
  const catalog = await response.json();
  catalog.categories.forEach(value=>{const option=node('option',value);option.value=value;category.append(option);});
  function render() {
    gallery.replaceChildren();
    const term = search.value.trim().toLocaleLowerCase('pt-BR');
    const images=catalog.images.filter(image=>(!category.value||image.category===category.value)&&[image.id,image.original,image.alt,...image.tags].join(' ').toLocaleLowerCase('pt-BR').includes(term));
    status.textContent=`${images.length} de ${catalog.images.length} imagens · ${catalog.images.filter(i=>i.reviewStatus==='pendente_revisao').length} pendentes de revisão`;
    images.forEach(image=>{
      const card=node('article');
      const img=node('img');img.loading='lazy';img.decoding='async';img.src=image.src;img.alt=image.alt;img.width=image.width;img.height=image.height;
      img.addEventListener('error',()=>img.replaceWith(node('p','Imagem indisponível; confira o caminho no catálogo.')));
      const heading=node('h2',image.original.split('/').pop());
      const cat=node('p',`${image.category} · ${image.kind} · ${image.reviewStatus}`);cat.className='category';
      const tags=node('div');tags.className='tags';image.tags.forEach(tag=>tags.append(node('span',tag)));
      card.append(img,heading,node('code',image.id),cat,tags,node('p',`${image.width} × ${image.height} px · ${(image.bytes/1024).toFixed(1)} KB WebP`),node('p',image.alt),node('p',image.purpose));
      gallery.append(card);
    });
  }
  category.addEventListener('change',render);search.addEventListener('input',render);render();
} catch (error) {status.textContent=error.message;status.setAttribute('role','alert');}
