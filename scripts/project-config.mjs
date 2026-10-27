import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function validateProjectConfig(pkg, lock) {
  if (typeof pkg.version !== 'string' || pkg.version.length > 128 || !versionPattern.test(pkg.version)) {
    throw new Error('package.json must contain a valid release version');
  }
  if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('package-lock.json version must match package.json');
  }
  const versionCode = pkg.lightning?.androidVersionCode;
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('lightning.androidVersionCode must be an integer from 1 to 2100000000');
  }
  return Object.freeze({version: pkg.version, versionCode, releaseTag: `v${pkg.version}`});
}

export function loadProjectConfig(directory = root) {
  return validateProjectConfig(JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(directory, 'package-lock.json'), 'utf8')));
}

export function resolveReleaseTag(config, {event, ref, requestedTag = ''}) {
  const selected = requestedTag || (event === 'workflow_dispatch' ? config.releaseTag : String(ref).replace(/^release\//, ''));
  if (selected !== config.releaseTag) throw new Error(`Release tag ${selected} must equal ${config.releaseTag}`);
  return selected;
}

function selfTest() {
  const pkg = {version: '0.2.0-experimental', lightning: {androidVersionCode: 2}};
  const lock = {version: pkg.version, packages: {'': {version: pkg.version}}};
  const config = validateProjectConfig(pkg, lock);
  const checks = [
    () => assert.deepEqual(config, {version: pkg.version, versionCode: 2, releaseTag: 'v0.2.0-experimental'}),
    () => assert.throws(() => validateProjectConfig(pkg, {...lock, version: '0.1.0'})),
    () => assert.throws(() => validateProjectConfig(pkg, {...lock, packages: {'': {version: '0.1.0'}}})),
    () => assert.throws(() => validateProjectConfig({...pkg, version: '0.2.0\nBAD=1'}, lock)),
    () => assert.throws(() => validateProjectConfig({...pkg, lightning: {androidVersionCode: 2.5}}, lock)),
    () => assert.throws(() => validateProjectConfig({...pkg, lightning: {androidVersionCode: 0}}, lock)),
    () => assert.equal(resolveReleaseTag(config, {event: 'push', ref: 'release/v0.2.0-experimental'}), config.releaseTag),
    () => assert.equal(resolveReleaseTag(config, {event: 'workflow_dispatch', ref: 'main'}), config.releaseTag),
    () => assert.throws(() => resolveReleaseTag(config, {event: 'push', ref: 'release/v0.1.0-experimental'})),
    () => assert.throws(() => resolveReleaseTag(config, {event: 'workflow_dispatch', ref: 'main', requestedTag: 'v0.1.0-experimental'})),
  ];
  checks.forEach(check => check());
  console.log(`Project configuration self-test: ${checks.length}/${checks.length} passed`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
  const config = loadProjectConfig();
  if (args.includes('--self-test')) selfTest();
  else {
    if (args.includes('--release')) resolveReleaseTag(config, {event: value('--event'), ref: value('--ref'), requestedTag: value('--requested-tag')});
    const environmentFile = value('--github-env');
    if (environmentFile) fs.appendFileSync(environmentFile,
      `LIGHTNING_VERSION=${config.version}\nLIGHTNING_VERSION_CODE=${config.versionCode}\nLIGHTNING_TAG=${config.releaseTag}\n`);
    console.log(JSON.stringify(config));
  }
}
