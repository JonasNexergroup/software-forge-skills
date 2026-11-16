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

## Skill sources

Configure your agent or skill installer to discover skills from these paths (relative to this repository):

- `skills/`
- `upstream/mattpocock/skills/engineering/`
- `upstream/mattpocock/skills/productivity/`

This README does not configure skill discovery automatically. Avoid registering the entire upstream repository if you only want the selected categories. Keep the full upstream checkout available because skills may reference shared files.

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
