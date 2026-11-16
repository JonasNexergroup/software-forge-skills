import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function exists(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Resolve existing ancestors too, so output-parent symlinks cannot hide overlap.
function canonical(file) {
  if (exists(file)) return fs.realpathSync(file);
  return path.join(canonical(path.dirname(file)), path.basename(file));
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function assertSkillTree(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) {
      throw new Error(`Unsupported link or special file in skill: ${file}`);
    }
    if (entry.isDirectory()) {
      if (entry.name === '.git') throw new Error(`Nested Git repository in skill: ${file}`);
      assertSkillTree(file);
    }
  }
}

export async function copySkills(manifestFile, outputFolder, log = console.log) {
  let parseDocument;
  try {
    ({ parseDocument } = await import('yaml'));
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error('Missing YAML dependency. Run npm ci in the skills repository first.');
  }

  const manifest = path.resolve(manifestFile);
  const document = parseDocument(fs.readFileSync(manifest, 'utf8'));
  if (document.errors.length) throw new Error(`Invalid YAML: ${document.errors[0].message}`);
  const config = document.toJS({ maxAliasCount: 100 });
  if (!config || Array.isArray(config) || typeof config !== 'object' ||
      Object.keys(config).some(key => key !== 'skills') ||
      !Array.isArray(config.skills) || config.skills.length === 0) {
    throw new Error('Expected a YAML mapping with a non-empty skills list of folder paths.');
  }

  const outputPath = path.resolve(outputFolder);
  const outputStat = exists(outputPath);
  if (outputStat && (!outputStat.isDirectory() || outputStat.isSymbolicLink())) {
    throw new Error(`Output must be a real directory, not a link or file: ${outputPath}`);
  }
  const output = canonical(outputPath);
  const names = new Set();
  const plans = config.skills.map(skillPath => {
    if (typeof skillPath !== 'string' || !skillPath.trim()) {
      throw new Error('Each skills entry must be a non-empty folder path string.');
    }
    const sourcePath = path.resolve(path.dirname(manifest), skillPath);
    const sourceStat = exists(sourcePath);
    if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
      throw new Error(`Skill folder missing or not a real directory: ${sourcePath}`);
    }
    const source = fs.realpathSync(sourcePath);
    const skillFile = exists(path.join(source, 'SKILL.md'));
    if (!skillFile?.isFile() || skillFile.isSymbolicLink()) {
      throw new Error(`Skill folder must contain a regular SKILL.md file: ${source}`);
    }
    const name = path.basename(sourcePath);
    // Case-insensitive checks keep manifests portable between Windows and Unix.
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error(`Duplicate skill folder name: ${name}`);
    names.add(key);
    if (name.startsWith('.') || /[<>:"|?*\\]/.test(name) || /[. ]$/.test(name) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) {
      throw new Error(`Skill folder name is not portable: ${name}`);
    }
    if (isWithin(source, output) || isWithin(output, source)) {
      throw new Error(`Source and output folders must not overlap: ${source} / ${output}`);
    }
    assertSkillTree(source);
    const target = path.join(output, name);
    const targetStat = exists(target);
    if (targetStat) {
      const targetSkill = exists(path.join(target, 'SKILL.md'));
      if (!targetStat.isDirectory() || targetStat.isSymbolicLink() ||
          !targetSkill?.isFile() || targetSkill.isSymbolicLink() || exists(path.join(target, '.git'))) {
        throw new Error(`Refusing to replace a link, repository, or non-skill destination: ${target}`);
      }
    }
    return { source, target, name, replace: Boolean(targetStat) };
  });

  // Validate every entry before writing; stage every copy before replacing skills.
  fs.mkdirSync(output, { recursive: true });
  const staging = fs.mkdtempSync(path.join(output, '.copy-skills-'));
  try {
    const fresh = path.join(staging, 'fresh');
    const backups = path.join(staging, 'backups');
    fs.mkdirSync(fresh);
    fs.mkdirSync(backups);
    for (const plan of plans) {
      fs.cpSync(plan.source, path.join(fresh, plan.name), { recursive: true, preserveTimestamps: true });
    }
    for (const plan of plans) {
      const backup = path.join(backups, plan.name);
      if (plan.replace) fs.renameSync(plan.target, backup);
      try {
        fs.renameSync(path.join(fresh, plan.name), plan.target);
      } catch (error) {
        if (plan.replace) fs.renameSync(backup, plan.target);
        throw error;
      }
      log(`${plan.replace ? 'Refreshed' : 'Copied'} ${plan.name} -> ${plan.target}`);
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  log(`Installed ${plans.length} skill(s) in ${output}`);
  return plans.map(plan => plan.target);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args.some(arg => !arg.trim())) {
    console.error('Usage: copy-skills.mjs <skills.yaml> <output-folder>');
    process.exitCode = 1;
  } else {
    try {
      await copySkills(...args);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
