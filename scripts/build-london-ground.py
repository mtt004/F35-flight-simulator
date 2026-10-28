#!/usr/bin/env python3
"""Rasterise actual London vectors into a ground texture and matching water mask."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SIZE = (4096, 1536)
EXTENT = (-5000, -9000, 34000, 6000)
COLORS = {'base': (101,108,77), 'pavement': (120,119,106),
          'roads': (91,94,88), 'woodland': (61,80,47), 'water': (67,87,81),
          'foreshore': (128,119,93), 'roofs': (137,130,116)}
VERSION = 2

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def xy(points):
    return [((x-EXTENT[0])/(EXTENT[2]-EXTENT[0])*(SIZE[0]-1),
             (z-EXTENT[1])/(EXTENT[3]-EXTENT[1])*(SIZE[1]-1)) for x,z in points]

def mask_for(objects):
    result = Image.new('L', SIZE, 0)
    for obj in objects:
        # A small temporary polygon mask preserves holes without subtracting a
        # neighbouring overlapping polygon. Avoid a full-canvas allocation.
        p = xy(obj['p'])
        left = max(0, int(min(x for x,y in p))-1)
        top = max(0, int(min(y for x,y in p))-1)
        right = min(SIZE[0], int(max(x for x,y in p))+2)
        bottom = min(SIZE[1], int(max(y for x,y in p))+2)
        if right <= left or bottom <= top:
            continue
        tile = Image.new('L', (right-left,bottom-top), 0)
        d = ImageDraw.Draw(tile)
        d.polygon([(x-left,y-top) for x,y in p], fill=255)
        for hole in obj.get('holes', []):
            d.polygon([(x-left,y-top) for x,y in xy(hole)], fill=0)
        bounds = (left,top,right,bottom)
        result.paste(ImageChops.lighter(result.crop(bounds), tile), bounds)
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'scenery-packs/london')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve()
    manifest_path = output/'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    if sha(output/'data.json.gz') != manifest['outputs']['data.json.gz']['sha256']:
        raise ValueError('Vector pack SHA mismatch; rerun build-london.py')
    if not args.force and manifest.get('groundPipelineVersion') == VERSION:
        if all((output/name).exists() and sha(output/name) == manifest['outputs'].get(name,{}).get('sha256')
               for name in ('ground.png','water-mask.png')):
            print('Validated existing London ground texture and water mask')
            return
    with gzip.open(output/'data.json.gz', 'rt') as f:
        data = json.load(f)
    ground = Image.new('RGB', SIZE, COLORS['base'])
    for kind in ('woodland','foreshore','site'):
        mask = mask_for(o for o in data['surfaces'] if o['kind'] == kind)
        ground.paste(COLORS.get(kind, COLORS['pavement']), (0,0), mask)
    roofs = mask_for(data['buildings'])
    # The pavement mask comes from actual footprints, with a 2 pixel buffer and
    # a 1 pixel Gaussian blur. Interior rings survive rasterisation.
    pavement = roofs.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1))
    ground.paste(COLORS['pavement'], (0,0), pavement)
    roadmask = Image.new('L', SIZE, 0)
    draw = ImageDraw.Draw(roadmask)
    metres_per_pixel = (EXTENT[2]-EXTENT[0])/(SIZE[0]-1)
    for road in data['roads']:
        draw.line(xy(road['p']), fill=255, width=max(1,round(road['width']/metres_per_pixel)), joint='curve')
    ground.paste(COLORS['roads'], (0,0), roadmask)
    water = mask_for(o for o in data['surfaces'] if o['kind'] == 'water')
    ground.paste(COLORS['water'], (0,0), water)
    ground.paste(COLORS['roofs'], (0,0), roofs)
    ground.save(output/'ground.png', optimize=True)
    water.save(output/'water-mask.png', optimize=True)
    for name in ('ground.png','water-mask.png'):
        with Image.open(output/name) as im:
            im.verify()
        with Image.open(output/name) as im:
            assert im.size == SIZE
            assert im.mode == ('RGB' if name == 'ground.png' else 'L')
            if name == 'water-mask.png':
                assert im.getextrema() == (0,255)
        manifest['outputs'][name] = {'sha256': sha(output/name), 'bytes': (output/name).stat().st_size,
                                    'width': SIZE[0], 'height': SIZE[1], 'rgbaEstimatedBytes': SIZE[0]*SIZE[1]*4,
                                    'mode': 'RGB' if name == 'ground.png' else 'L', 'extent': list(EXTENT)}
    manifest['groundPipelineVersion'] = VERSION
    manifest['groundPaletteRGB'] = COLORS
    manifest['textureMemory'] = {'groundRGBABytes': SIZE[0]*SIZE[1]*4, 'waterMaskR8Bytes': SIZE[0]*SIZE[1],
                                'bothRGBABytes': SIZE[0]*SIZE[1]*8}
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True)+'\n')
    print(f'Created {SIZE[0]}×{SIZE[1]} vector-derived ground texture and matching water mask')

if __name__ == '__main__':
    main()
