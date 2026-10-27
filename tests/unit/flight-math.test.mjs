import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { physicsMath, baselineFile, repositoryRoot } from '../helpers/source.mjs';

// These checks execute production functions extracted from the source. They are
// equation/regression checks, not a substitute for a complete six-DOF flight test.
const files = [['preserved baseline', baselineFile]];
const currentSource = process.env.SIMULATOR_SOURCE || path.join(repositoryRoot, 'src/simulator.js');
if (existsSync(currentSource)) files.push(['current simulator', currentSource]);
for (const [label, file] of files) {
  const m = await physicsMath(file);
  test(`${label}: ISA density and sound speed decrease with altitude`, () => {
    const sea = m.atmos(0), high = m.atmos(11000);
    assert.ok(Math.abs(sea.rho - 1.225) < .012);
    assert.ok(high.rho > .32 && high.rho < .4);
    assert.ok(high.a < sea.a);
    assert.ok(Number.isFinite(m.atmos(40000).rho));
  });
  test(`${label}: seeded noise repeats with the same seed and differs with another`, () => {
    const a = m.makeNoise(12345), b = m.makeNoise(12345), c = m.makeNoise(54321);
    let differences = 0;
    for (let i = -20; i <= 20; i++) {
      const x = i * .123 + .22, y = i * .291 - .84;
      assert.equal(a(x, y), b(x, y));
      assert.ok(Number.isFinite(a(x, y)));
      if (Math.abs(a(x, y) - c(x, y)) > 1e-5) differences++;
    }
    assert.ok(differences > 30);
  });
  test(`${label}: post-stall lift falls and full nose-down retains recovery moment`, () => {
    const peak = m.interp(m.AERO.a, m.AERO.CL, 28), post = m.interp(m.AERO.a, m.AERO.CL, 55);
    assert.ok(peak > 1.85 && post < peak * .7);
    const sep = .92, eff = m.ctrlEff(.32, sep, 45);
    const recovery = m.interp(m.AERO.a, m.AERO.Cm, 45) + 1.05 * (-25 * Math.PI / 180) * eff + .022 * sep; // Worst-case nose-up separation correction.
    assert.ok(recovery < -.035);
  });
  test(`${label}: wave drag rises through transonic and published envelope`, () => {
    assert.ok(m.waveDrag(1.02) > m.waveDrag(.72) * 4);
    assert.ok(m.waveDrag(1.02) > m.waveDrag(1.55));
    assert.ok(m.waveDrag(1.78) > m.waveDrag(1.55));
  });
  test(`${label}: fuel tank sequencing conserves fuel and inertia remains positive`, () => {
    for (let f = 0; f <= 1; f += .05) {
      const kg = m.MAX_FUEL * f, d = m.fuelDistribution(kg), p = m.massProperties(kg);
      assert.ok(Math.abs(d.fwd + d.ctr + d.aft - kg) < 1e-8);
      assert.ok([p.ix, p.iy, p.iz].every(x => x > 0 && Number.isFinite(x)));
      assert.ok(p.iy * p.iz - p.iyz * p.iyz > 0);
      assert.ok(p.cg >= -.13 && p.cg <= .15);
    }
  });
  test(`${label}: hover thrust supports recovery load but not full fuel mass`, () => {
    assert.ok(m.VERTT / ((m.DRY + m.MAX_FUEL * .25) * 9.81) > 1.08);
    assert.ok(m.VERTT / ((m.DRY + m.MAX_FUEL) * 9.81) < 1);
  });
  test(`${label}: rudder yaw damping opposes rate and sideslip`, () => {
    const positive = m.yawSurfaceTarget(120, 0, .18, .1, 0, 0, false);
    const negative = m.yawSurfaceTarget(120, 0, -.18, -.1, 0, 0, false);
    assert.ok(positive > 0 && negative < 0);
    assert.ok(Math.abs(positive + negative) < 1e-12);
  });
}
