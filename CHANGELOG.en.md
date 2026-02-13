# Changelog

All notable changes to this project should be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2026-02-13
### Fixed
- Finalized edge settings for the auth page: compression and caching of Keycloak resources now apply correctly on production.

## [0.1.6] - 2026-02-13
### Changed
- Improved authentication page load speed: Keycloak static resources are now compressed at the edge and cached by the browser.

### Fixed
- Fixed the “Latest changes” modal: it now shows only the current release block without pulling older versions.

## [0.1.5] - 2026-02-13
### Fixed
- In English UI, widget creation now fully translates `Type` and `Period`, including all option values inside those selectors.
- In widget advanced filters, all rule parts are translated (fields, operators, and rule-group match modes).
- The “latest changes” modal now hides technical sections and shows only user-facing product updates.

## [0.1.4] - 2026-02-13
### Changed
- Updated dashboard widget creation UI: fields inside the modal no longer clip at the edges, and focus/content render fully.
- Improved dashboard grid behavior: widgets can no longer overlap during drag/resize.
- `Members -> Tasks` now remembers user list preferences: `A-Z / Z-A` sorting and `grouped / ungrouped` mode.
- In timeline calendar mode, date selection animation now highlights only the selected date instead of the full column.

### Added
- Added milestone creation on timeline by double-clicking a date (in day header and milestone row).
- If multiple milestones share the same date, timeline shows all dots and tooltip displays the full list for that day.
- Added app version in account settings: a small clickable version label at the bottom opens a modal with latest changes.

### Fixed
- Extended interface localization (including widget creation and timeline task form/details) so key fields and actions are no longer left in English.
- Fixed dashboard grid collision: a small widget can no longer be placed on top of a large one (strict no-overlap during drag/resize).
- Fixed version display: the version shown in UI now always matches the deployed release.

## [0.1.0] - 2026-02-13
### Added
- Introduced baseline release versioning with `VERSION`.
- Added project-level changelog file (`CHANGELOG.md`).
- Added deployment release log file (`infra/releases.log`).
- Added automatic deployment log append in `infra/scripts/prod-compose.sh`.
