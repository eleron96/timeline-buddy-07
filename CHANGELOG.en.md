# Changelog

All notable changes to this project should be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Updated dashboard widget creation UI: fields inside the modal no longer clip at the edges, and focus/content render fully.
- Improved dashboard grid behavior: widgets can no longer overlap during drag/resize.
- `Members -> Tasks` now remembers user list preferences: `A-Z / Z-A` sorting and `grouped / ungrouped` mode.
- In timeline calendar mode, date selection animation now highlights only the selected date instead of the full column.

### Added
- Added milestone creation on timeline by double-clicking a date (in day header and milestone row).
- If multiple milestones share the same date, timeline shows all dots and tooltip displays the full list for that day.
- Added baseline release tracking:
  - version in `VERSION`,
  - human-readable changelog in `CHANGELOG.md` and `CHANGELOG.en.md`,
  - technical deployment log in `infra/releases.log` (timestamp, version, backup, environment).
- Added app version in account settings: a small clickable version label at the bottom opens a modal with latest changes.

### Fixed
- Extended interface localization (including widget creation and timeline task form/details) so key fields and actions are no longer left in English.
- Fixed dashboard grid collision: a small widget can no longer be placed on top of a large one (strict no-overlap during drag/resize).

### Infrastructure
- `infra/scripts/prod-compose.sh` now treats each remote deployment as a release: it auto-bumps patch version in `VERSION` and appends a new record to `infra/releases.log`.
- Added `infra/scripts/deploy-remote.sh` (and `make deploy-remote`) for remote deployment with synchronization of `VERSION` and `infra/releases.log` back to the local repository.
- Fixed release step ordering in `prod-compose.sh`: version is bumped before web build and rolled back on build failure, so UI version matches the deployed release version.
- Automated changelog release flow: entries from `Unreleased` are now moved into the new version section in both `CHANGELOG.md` and `CHANGELOG.en.md`.
- `deploy-remote.sh` now also syncs changelog files back to the local repository after remote deployment.

## [0.1.0] - 2026-02-13
### Added
- Introduced baseline release versioning with `VERSION`.
- Added project-level changelog file (`CHANGELOG.md`).
- Added deployment release log file (`infra/releases.log`).
- Added automatic deployment log append in `infra/scripts/prod-compose.sh`.
