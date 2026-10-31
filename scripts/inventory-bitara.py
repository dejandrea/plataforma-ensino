"""Read-only inventory of official originals; contact sheets go to ignored tmp/."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/assets/Mascote Bitara'
OUT = ROOT / 'tmp/bitara-review'
OUT.mkdir(parents=True, exist_ok=True)
rows = []
files = sorted(SOURCE.iterdir(), key=lambda p: (int(''.join(filter(str.isdigit, p.stem)) or 9999), p.name))
code = list((ROOT / 'src').rglob('*.ts')) + list((ROOT / 'src').rglob('*.tsx'))
for file in files:
    if not file.is_file():
        continue
    try:
        with Image.open(file) as im:
            width, height, fmt = im.width, im.height, im.format
    except OSError:
        continue
    relative = file.relative_to(ROOT).as_posix()
    used = [p.relative_to(ROOT).as_posix() for p in code if f'Mascote Bitara/{file.name}' in p.read_text(encoding='utf-8')]
    number = re.fullmatch(r'(?:mascote )?(\d+)', file.stem)
    named = {'Bitara_ Missão Concluída no Mundo Neon': 'bitara-prancha-missao', 'Bitara_ Programadora Neon em Ação': 'bitara-prancha-programadora', 'Ficha de Personagem Bitara Investigadora': 'bitara-prancha-investigadora'}
    stable_id = f'bitara-{int(number.group(1)):03d}' if number else named.get(file.stem)
    if not stable_id:
        raise ValueError(f'Defina um ID estável para {file.name}')
    rows.append(dict(id=stable_id, original=relative, filename=file.name, width=width, height=height, format=fmt, bytes=file.stat().st_size, sha256=hashlib.sha256(file.read_bytes()).hexdigest(), usedBy=used))
groups = {}
for row in rows:
    groups.setdefault(row['sha256'], []).append(row['id'])
for row in rows:
    row['duplicates'] = [i for i in groups[row['sha256']] if i != row['id']]
(OUT / 'inventory.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(ROOT / 'docs/bitara-inventory.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
for offset in range(0, len(rows), 16):
    sheet = Image.new('RGB', (1200, 1200), '#eceaf2')
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows[offset:offset+16]):
        with Image.open(ROOT / row['original']) as im:
            im = im.convert('RGBA')
            im.thumbnail((275, 250))
            x, y = index % 4 * 300, index // 4 * 300
            sheet.paste(im, (x+(300-im.width)//2, y+10), im)
            draw.text((x+10, y+265), f"{row['id']} | {row['filename']}", fill='black')
    sheet.save(OUT / f'sheet-{offset//16+1}.jpg')
print(json.dumps({'count':len(rows),'bytes':sum(r['bytes'] for r in rows),'duplicateGroups':[ids for ids in groups.values() if len(ids)>1]},ensure_ascii=False))
