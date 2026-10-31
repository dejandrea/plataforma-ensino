"""Generate lossless WebP derivatives and a public catalog; originals are untouched."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
inventory = json.loads((ROOT / 'docs/bitara-inventory.json').read_text(encoding='utf-8'))
classification = json.loads((ROOT / 'docs/bitara-classification.json').read_text(encoding='utf-8'))
destination = ROOT / 'public/biblioteca-bitara'
(destination / 'images').mkdir(parents=True, exist_ok=True)
entries = []
for original in inventory:
    asset_id = original['id']
    source = ROOT / original['original']
    if hashlib.sha256(source.read_bytes()).hexdigest() != original['sha256']:
        raise ValueError(f'Original alterado: {asset_id}. Revise o inventário.')
    review = classification.get(asset_id, dict(category='outras', tags=[], alt='Imagem da Bitara aguardando revisão.', reviewStatus='pendente_revisao', kind='pose', purpose='Aguardando classificação visual.'))
    target = destination / 'images' / f'{asset_id}.webp'
    with Image.open(source) as im:
        im.save(target, 'WEBP', lossless=True, exact=True, method=6)
        with Image.open(target) as derivative:
            if derivative.size != im.size or derivative.convert('RGBA').tobytes() != im.convert('RGBA').tobytes():
                raise ValueError(f'Derivada não preserva pixels: {asset_id}')
    entries.append(dict(id=asset_id, src=f'/biblioteca-bitara/images/{asset_id}.webp', original=original['original'], width=original['width'], height=original['height'], bytes=target.stat().st_size, **review))
catalog = dict(schemaVersion=1, fallbackId='bitara-001', categories=['pensativa','investigadora','programadora','comemorando','explicando','surpresa','neutra','outras'], images=entries)
(destination / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(images=len(entries),originalBytes=sum(r['bytes'] for r in inventory),webpBytes=sum(r['bytes'] for r in entries),pending=sum(r['reviewStatus']=='pendente_revisao' for r in entries))))
