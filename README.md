# Software Forge Skills

Personal skills plus selected skill categories from [Matt Pocock's skills repository](https://github.com/mattpocock/skills).

## Layout

```text
skills/                              # Our own skills
upstream/mattpocock/                  # Upstream Git submodule (do not edit)
  skills/engineering/                # Selected upstream category
  skills/productivity/               # Selected upstream category
```

Git submodules reference an entire repository at a specific commit. Other upstream categories are present, but are not part of our selected skill sources.

## Install selected skills

Requirements: **Node.js 18.17+ and npm**, plus Bash or PowerShell (Windows PowerShell 5.1 and PowerShell 7 are supported). Both wrappers use the same implementation and a proper YAML parser.

From this repository, initialize the submodule and install the script dependency once:

```sh
git submodule update --init --recursive
npm ci
```

Edit `skills.yaml` to choose the individual skill folders you want. The supplied file lists all 27 engineering and productivity skills present at the initial pinned upstream commit. New upstream skills are not automatically added to this list.

```yaml
skills:
  - upstream/mattpocock/skills/engineering/tdd
  - upstream/mattpocock/skills/productivity/handoff
  # Add your own skill once its folder exists:
  # - skills/my-skill
```

Run either script with a YAML file and an output directory, usually your target project's `.agents/skills`:

**Bash** (including Git Bash on Windows):

```sh
bash ./scripts/copy-skills.sh ./skills.yaml ../my-project/.agents/skills
```

**PowerShell**:

```powershell
.\scripts\copy-skills.ps1 -Manifest .\skills.yaml -OutputFolder ..\my-project\.agents\skills
```

You can also install into this repository for local use by passing `.agents/skills` as the output folder. This location is ignored by Git.

### Copy behavior

- Source paths are relative to the **YAML file's directory**, not your current directory. Absolute source paths are also supported. Use forward slashes in YAML for portability, and quote paths with YAML-special characters.
- The output path is relative to your **current working directory** unless absolute.
- Each entry must name an individual folder containing `SKILL.md`, not a category folder. Globs and environment-variable expansion are not supported.
- The entire folder, including nested support files, is copied to `<output>/<source-folder-name>/`. No symlinks are created.
- Every entry is validated and all copies are staged before selected destination folders are replaced. Missing skills and duplicate destination names fail before any copying. Name collision checks are case-insensitive for portability.
- **Re-running replaces each selected destination skill folder completely**, removing stale files and any local modifications in that folder. Customize skills in the source repository instead.
- Unrelated output folders remain untouched. Removing a skill from the YAML does not uninstall a previously copied skill; remove that destination folder manually.
- The installer rejects source/output overlap, source-tree links or special files, linked destinations, and existing destinations that are not skill folders or contain a Git repository.
- Only listed skill folders are copied. References to shared files outside those folders are not copied or rewritten; check those skills' external requirements before using them.

After updating the submodule, run the installer again to refresh the copies in your target project.

Run the automated tests with `npm test`.

### Direct discovery alternative

If your agent supports registering external skill locations, you can instead point it at `skills/`, `upstream/mattpocock/skills/engineering/`, and `upstream/mattpocock/skills/productivity/`. Avoid registering the whole upstream repository if you only want those categories.

## Clone

```sh
git clone --recurse-submodules https://github.com/JonasNexergroup/software-forge-skills.git sw-factory-skills
cd sw-factory-skills
```

If you already cloned without submodules:

```sh
git submodule update --init --recursive
```

## Update Matt's skills

Run from the repository root with a clean submodule checkout:

```sh
# Fetch the latest commit from the configured upstream main branch.
git submodule update --init --remote upstream/mattpocock

# Review the change in pinned upstream commits.
git diff --submodule=log -- upstream/mattpocock

# After reviewing and testing the skills, record the new version.
git add upstream/mattpocock
git commit -m "Update Matt Pocock skills"
git push origin main
```

Updates are deliberate, not automatic: normal clones and pulls use the commit pinned in this repository. Updating the submodule updates both selected categories together, along with the rest of upstream.

After pulling changes to this repository, synchronize your local checkout to its pinned version:

```sh
git pull --ff-only
git submodule update --init --recursive
```

## Automated upstream update PRs

The workflow `.github/workflows/update-mattpocock.yml` checks upstream daily at 07:00 UTC and opens or updates a pull request when the pinned submodule commit changes. It can also be started manually under **Actions > Update Matt Pocock skills > Run workflow**. Updates are not merged automatically.

Before the first run, enable **Settings > Actions > General > Workflow permissions > Allow GitHub Actions to create and approve pull requests**. The workflow requests `contents: write` and `pull-requests: write` and uses the built-in `GITHUB_TOKEN`; no personal token is needed. Organization policies may prevent these permissions or third-party actions, in which case an organization administrator must allow them.

Pull requests created with `GITHUB_TOKEN` do not normally trigger other pull-request workflows. If you later add required PR checks, use a GitHub App token or another approved token strategy to trigger those checks.

Scheduled workflows run on the default branch. GitHub may delay scheduled runs and may disable schedules in inactive public repositories after 60 days.

## Our own skills

Add each skill under `skills/<skill-name>/SKILL.md`, with any supporting files beside it. Use distinct names to avoid collisions with upstream skills. Keep customizations outside the submodule so upstream updates do not overwrite them.

## Upstream license

Matt's skills retain their upstream MIT license in `upstream/mattpocock/LICENSE`. Preserve upstream attribution and license notices when redistributing or deriving skills from them.
