import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { repositoryRoot } from '../helpers/source.mjs';

async function visualEnvironment() {
  // Only 2D paint methods are stubbed: geometry, transforms, materials, textures
  // and instancing all execute the actual bundled Three.js r128 implementation.
  // No WebGL context is faked and this test makes no GPU/shader claim.
  const paint = Object.fromEntries(['clearRect','fillRect','fillText','beginPath','moveTo','lineTo','closePath','stroke','strokeRect'].map(k => [k, () => {}]));
  const context = vm.createContext({ console, document: { createElement(name) {
    assert.equal(name, 'canvas'); return { width: 0, height: 0, getContext(type) { assert.equal(type, '2d'); return { ...paint }; } };
  } } });
  context.window = context;
  for (const file of ['src/vendor/three-r128.min.js', 'src/aircraft/detail.js', 'src/cockpit/detail.js']) {
    vm.runInContext(await readFile(path.join(repositoryRoot, file), 'utf8'), context, { filename: file, timeout: 3000 });
  }
  return { T: context.THREE, visual: context.LightningVisuals };
}

test('authored visual geometry stays finite, indexed correctly and within a small draw/atlas budget', async () => {
  const { T, visual } = await visualEnvironment(), ac = new T.Group(), fan = new T.Group(), cockpit = new T.Group();
  ac.add(fan); visual.buildAircraftDetail(T, ac, { lfDoor: fan }); visual.buildCockpitDetail(T, cockpit);
  let draws = 0; const textures = new Set();
  for (const group of [ac, cockpit]) group.traverse(object => {
    if (!object.geometry) return;
    draws++;
    for (const attribute of Object.values(object.geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite), object.name + ' has nonfinite geometry');
    if (object.geometry.index) assert.ok([...object.geometry.index.array].every(i => i < object.geometry.attributes.position.count));
    if (object.isInstancedMesh) assert.ok([...object.instanceMatrix.array].every(Number.isFinite));
    for (const material of [object.material].flat()) for (const key of ['map', 'emissiveMap']) if (material[key]) textures.add(material[key]);
  });
  assert.ok(draws > 0 && draws <= 24, `Visual furnishing draw budget exceeded: ${draws}`);
  const atlasBytes = [...textures].reduce((n, t) => n + t.image.width * t.image.height * 4, 0);
  assert.ok(atlasBytes <= 1024 * 1024, `Authored atlases exceed 1 MiB RGBA budget: ${atlasBytes}`);
});

test('rebuilding visual details is idempotent and moving lift-door details remain parented', async () => {
  const { T, visual } = await visualEnvironment(), ac = new T.Group(), fan = new T.Group(), cockpit = new T.Group();
  ac.add(fan);
  const aircraftDetail = visual.buildAircraftDetail(T, ac, { lfDoor: fan }), cockpitDetail = visual.buildCockpitDetail(T, cockpit);
  const aircraftChildren = ac.children.length, cockpitChildren = cockpit.children.length, fanChildren = fan.children.length;
  assert.equal(visual.buildAircraftDetail(T, ac, { lfDoor: fan }), aircraftDetail);
  assert.equal(visual.buildCockpitDetail(T, cockpit), cockpitDetail);
  assert.equal(ac.children.length, aircraftChildren); assert.equal(cockpit.children.length, cockpitChildren);
  assert.equal(fan.children.length, fanChildren); assert.ok(fanChildren > 0);
  assert.ok(aircraftDetail.userData.visualOnly && cockpitDetail.userData.visualOnly);
});

test('aircraft close detail uses distance hysteresis and quality gating', async () => {
  const { T, visual } = await visualEnvironment(), ac = new T.Group(), fan = new T.Group();
  const detail = visual.buildAircraftDetail(T, ac, { lfDoor: fan });
  for (const [distance, quality, visible] of [[100,1,true],[130,1,true],[146,1,false],[130,1,false],[100,0,false],[100,1,true],[NaN,1,false]]) {
    visual.updateAircraft({ distance, quality }); assert.equal(detail.visible, visible); assert.equal(fan.children[0].visible, visible);
  }
});

test('cockpit animation bounds corrupt input and follows processed control values', async () => {
  const { T, visual } = await visualEnvironment(), cockpit = new T.Group();
  const detail = visual.buildCockpitDetail(T, cockpit);
  const stick = detail.getObjectByName('Animated side-stick'), throttle = detail.getObjectByName('Animated throttle lever');
  visual.updateCockpit({ roll: 2, pitch: NaN, throttle: Infinity, night: 3 });
  assert.equal(stick.rotation.z, -.2); assert.equal(stick.rotation.x, 0); assert.equal(throttle.rotation.x, -.28);
  visual.updateCockpit({ roll: -.5, pitch: .5, throttle: 1, night: 0 });
  assert.equal(stick.rotation.z, .1); assert.equal(stick.rotation.x, .09); assert.equal(throttle.rotation.x, .28);
});
