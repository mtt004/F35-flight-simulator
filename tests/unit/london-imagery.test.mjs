import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const pack = path.resolve('scenery-packs/london-imagery');
const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json')));

function jpegDimensions(data) {
  assert.equal(data.readUInt16BE(0), 0xffd8, 'JPEG SOI signature');
  assert.equal(data.readUInt16BE(data.length-2), 0xffd9, 'JPEG EOI signature');
  let offset = 2;
  while (offset < data.length-4) {
    assert.equal(data[offset++], 0xff);
    const marker = data[offset++];
    const length = data.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      assert.equal(data[offset+2], 8, '8-bit JPEG');
      assert.equal(data[offset+7], 3, 'three colour components');
      return [data.readUInt16BE(offset+5), data.readUInt16BE(offset+3)];
    }
    offset += length;
  }
  throw new Error('Missing JPEG frame');
}

test('Sentinel derivatives verify exact bytes, dimensions and complete image files', () => {
  assert.equal(manifest.tiles.length, 24);
  for (const [file, record] of Object.entries(manifest.outputs)) {
    const bytes = fs.readFileSync(path.join(pack, file));
    assert.equal(bytes.length, record.bytes, file+' length');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, file+' hash');
    if (file.endsWith('.jpg')) {
      assert.deepEqual(jpegDimensions(bytes), [record.width, record.height], file);
      assert.ok(bytes.length > 20000, file+' contains photographic detail');
    }
  }
});

test('north-up imagery tiles cover the complete game extent once with shared edges', () => {
  assert.deepEqual(manifest.bounds, [502000, 170000, 541000, 185000]);
  assert.deepEqual(manifest.extent, [-5000, -9000, 34000, 6000]);
  assert.deepEqual(manifest.overview.extent, manifest.extent);
  assert.deepEqual([manifest.overview.width, manifest.overview.height], [2048, 1024]);
  const ids = new Set();
  for (let row=0; row<3; row++) for (let column=0; column<8; column++) {
    const tile = manifest.tiles.find(t => t.column === column && t.row === row);
    assert.ok(tile);
    assert.ok(!ids.has(tile.id)); ids.add(tile.id);
    assert.deepEqual(tile.extent, [-5000+column*4875, -9000+row*5000,
                                  -5000+(column+1)*4875, -9000+(row+1)*5000]);
    assert.deepEqual([tile.width,tile.height],[512,512]);
  }
  assert.match(manifest.orientation, /north-up/);
  assert.equal(manifest.processing.missingPixels, 0);
});

test('mosaic source metadata records actual 10m Sentinel bands, dates and legal attribution', () => {
  assert.equal(manifest.attribution, 'Contains modified Copernicus Sentinel data [2025]');
  assert.equal(manifest.source.nativeResolutionMetres, 10);
  assert.deepEqual(manifest.source.bands, ['B04','B03','B02']);
  assert.equal(manifest.sources.length, 3);
  assert.equal(manifest.sources.reduce((n, s) => n+s.contributedPixels, 0), 3900*1500);
  assert.ok(manifest.sources[0].contributedPixels/(3900*1500)>0.95);
  for (const source of manifest.sources) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    const stac = JSON.parse(fs.readFileSync(path.join(pack, source.stac)));
    assert.equal(stac.id, source.id);
    assert.equal(stac.assets.visual.href, source.url);
    assert.equal(stac.properties.datetime, source.datetime);
    assert.equal(stac.assets.visual.gsd, source.nativeResolutionMetres);
    assert.ok(stac.links.some(l => l.rel === 'license' && /Sentinel_Data_Legal_Notice/.test(l.href)));
  }
  const notice = fs.readFileSync(path.join(pack,'NOTICE.txt'),'utf8');
  assert.ok(notice.includes(manifest.attribution));
  assert.match(notice, /10 metre source resolution/);
  assert.match(notice, /Dates therefore differ at the outer edges/);
  assert.ok(notice.includes(manifest.licenseUrl));
});

test('imagery builder validates transforms and rejects altered source files without raster dependencies', () => {
  const result=spawnSync('python3',['scripts/build-london-imagery.py','--self-test'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const corrupt=spawnSync('python3',['-c',
    `import runpy,tempfile,pathlib\nm=runpy.run_path('scripts/build-london-imagery.py')\nwith tempfile.TemporaryDirectory() as d:\n p=pathlib.Path(d)/'bad.tif';p.write_bytes(b'altered imagery')\n try: m['validate_source'](p)\n except ValueError as e: assert 'integrity mismatch' in str(e)\n else: raise AssertionError('corrupted source accepted')`],{encoding:'utf8'});
  assert.equal(corrupt.status,0,corrupt.stderr);
});
