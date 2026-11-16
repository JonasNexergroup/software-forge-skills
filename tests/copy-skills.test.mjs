import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { copySkills } from '../scripts/copy-skills.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill copier test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = path.join(root, 'skills.yaml');
  const output = path.join(root, '.agents', 'skills');
  function skill(name) {
    const folder = path.join(root, 'sources', name);
    fs.mkdirSync(path.join(folder, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'SKILL.md'), `# ${name}\n`);
    fs.writeFileSync(path.join(folder, 'scripts', 'run.sh'), '#!/bin/sh\necho ok\n', { mode: 0o755 });
    return folder;
  }
  function yaml(text) {
    fs.writeFileSync(manifest, text);
    return manifest;
  }
  const run = () => copySkills(manifest, output, () => {});
  return { root, manifest, output, skill, yaml, run };
}

test('copies whole skill folders, nested files and paths containing spaces', async t => {
  const f = fixture(t);
  const source = f.skill('my skill');
  f.skill('another');
  f.yaml('skills:\n  - "sources/my skill" # comment\n  - sources/another\n');
  const results = await f.run();
  assert.equal(results.length, 2);
  assert.equal(fs.readFileSync(path.join(f.output, 'my skill', 'SKILL.md'), 'utf8'), '# my skill\n');
  const copiedScript = path.join(f.output, 'my skill', 'scripts', 'run.sh');
  assert.equal(fs.readFileSync(copiedScript, 'utf8'), fs.readFileSync(path.join(source, 'scripts', 'run.sh'), 'utf8'));
  if (process.platform !== 'win32') assert.ok(fs.statSync(copiedScript).mode & 0o111);
  assert.equal(fs.readdirSync(f.output).some(name => name.startsWith('.copy-skills-')), false);
});

test('refresh removes stale selected files but preserves unrelated skills and sources', async t => {
  const f = fixture(t);
  const source = f.skill('one');
  f.yaml('skills: [sources/one]\n');
  await f.run();
  const target = path.join(f.output, 'one');
  fs.writeFileSync(path.join(target, 'stale.txt'), 'old');
  fs.writeFileSync(path.join(source, 'SKILL.md'), '# Updated\n');
  fs.mkdirSync(path.join(f.output, 'unrelated'));
  fs.writeFileSync(path.join(f.output, 'unrelated', 'keep.txt'), 'keep');
  await f.run();
  assert.equal(fs.existsSync(path.join(target, 'stale.txt')), false);
  assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), '# Updated\n');
  assert.equal(fs.readFileSync(path.join(f.output, 'unrelated', 'keep.txt'), 'utf8'), 'keep');
  assert.equal(fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8'), '# Updated\n');
});

test('absolute source paths work', async t => {
  const f = fixture(t);
  const source = f.skill('one');
  f.yaml(`skills: [${JSON.stringify(source)}]\n`);
  await f.run();
  assert.ok(fs.existsSync(path.join(f.output, 'one', 'SKILL.md')));
});

for (const [name, text, pattern] of [
  ['malformed YAML', 'skills: [\n', /Invalid YAML/],
  ['duplicate YAML keys', 'skills: [sources/one]\nskills: [sources/two]\n', /Invalid YAML/],
  ['empty list', 'skills: []\n', /non-empty skills list/],
  ['missing list', 'paths: [sources/one]\n', /non-empty skills list/],
  ['unknown fields', 'skills: [sources/one]\nextra: true\n', /non-empty skills list/],
  ['non-string entry', 'skills: [123]\n', /folder path string/],
  ['blank entry', 'skills: [" "]\n', /folder path string/],
  ['missing source', 'skills: [sources/missing]\n', /Skill folder missing/],
]) {
  test(`rejects ${name} without creating output`, async t => {
    const f = fixture(t);
    f.skill('one');
    f.yaml(text);
    await assert.rejects(f.run(), pattern);
    assert.equal(fs.existsSync(f.output), false);
  });
}

test('validates later entries before replacing existing skills', async t => {
  const f = fixture(t);
  const source = f.skill('one');
  f.yaml('skills: [sources/one]\n');
  await f.run();
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'changed');
  f.yaml('skills: [sources/one, sources/missing]\n');
  await assert.rejects(f.run(), /Skill folder missing/);
  assert.equal(fs.readFileSync(path.join(f.output, 'one', 'SKILL.md'), 'utf8'), '# one\n');
});

test('rejects a category folder without SKILL.md', async t => {
  const f = fixture(t);
  f.skill('one');
  f.yaml('skills: [sources]\n');
  await assert.rejects(f.run(), /must contain a regular SKILL.md/);
  assert.equal(fs.existsSync(f.output), false);
});

test('rejects duplicate destination names', async t => {
  const f = fixture(t);
  const first = f.skill('one');
  const second = path.join(f.root, 'elsewhere', 'one');
  fs.cpSync(first, second, { recursive: true });
  f.yaml('skills: [sources/one, elsewhere/one]\n');
  await assert.rejects(f.run(), /Duplicate skill folder name/);
  assert.equal(fs.existsSync(f.output), false);
});

test('rejects case-insensitive name collisions', async t => {
  const f = fixture(t);
  f.skill('one');
  const second = path.join(f.root, 'elsewhere', 'ONE');
  fs.mkdirSync(second, { recursive: true });
  fs.writeFileSync(path.join(second, 'SKILL.md'), '# ONE');
  f.yaml('skills: [sources/one, elsewhere/ONE]\n');
  await assert.rejects(f.run(), /Duplicate skill folder name/);
});

test('rejects output inside source or containing source', async t => {
  const f = fixture(t);
  const source = f.skill('one');
  f.yaml('skills: [sources/one]\n');
  for (const output of [source, path.join(source, 'output'), path.dirname(source)]) {
    await assert.rejects(copySkills(f.manifest, output, () => {}), /must not overlap/);
  }
});

test('does not replace a non-skill destination', async t => {
  const f = fixture(t);
  f.skill('one');
  f.yaml('skills: [sources/one]\n');
  const target = path.join(f.output, 'one');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'keep.txt'), 'keep');
  await assert.rejects(f.run(), /Refusing to replace/);
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'keep');
});

test('does not replace a destination repository', async t => {
  const f = fixture(t);
  f.skill('one');
  f.yaml('skills: [sources/one]\n');
  await f.run();
  fs.mkdirSync(path.join(f.output, 'one', '.git'));
  await assert.rejects(f.run(), /Refusing to replace/);
});

test('rejects output file', async t => {
  const f = fixture(t);
  f.skill('one');
  f.yaml('skills: [sources/one]\n');
  fs.mkdirSync(path.dirname(f.output), { recursive: true });
  fs.writeFileSync(f.output, 'not a folder');
  await assert.rejects(f.run(), /Output must be a real directory/);
});

test('rejects links inside source skills', async t => {
  const f = fixture(t);
  const source = f.skill('one');
  f.yaml('skills: [sources/one]\n');
  try {
    fs.symlinkSync(path.join(source, 'SKILL.md'), path.join(source, 'linked.md'));
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Creating file symlinks requires Windows privileges.');
    throw error;
  }
  await assert.rejects(f.run(), /Unsupported link/);
  assert.equal(fs.existsSync(f.output), false);
});

test('rejects a linked destination without touching its referent', async t => {
  const f = fixture(t);
  const source = f.skill('one');
  f.yaml('skills: [sources/one]\n');
  fs.mkdirSync(f.output, { recursive: true });
  fs.symlinkSync(source, path.join(f.output, 'one'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.run(), /Refusing to replace/);
  assert.equal(fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8'), '# one\n');
});
