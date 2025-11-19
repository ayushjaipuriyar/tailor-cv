# Requirements Document

## Introduction

This document defines the requirements for implementing an automated release cycle for the CV Tailor Chrome extension using GitHub Actions and semantic-release. The system will automate version management, changelog generation, and artifact creation for Chrome Web Store distribution.

## Glossary

- **Extension Release System**: The automated GitHub Actions workflow that manages versioning, changelog generation, and artifact packaging for the Chrome extension
- **Semantic Release**: An automated versioning tool that determines version numbers based on commit messages following conventional commit format
- **Extension Artifact**: A packaged ZIP file containing all Chrome extension files ready for Chrome Web Store submission
- **Release Branch**: The main branch where production releases are triggered
- **Prerelease Branch**: Development branches (dev/*, feature/*, hotfix/*) where prerelease versions are created

## Requirements

### Requirement 1

**User Story:** As a developer, I want the extension version to be automatically updated based on commit messages, so that I don't have to manually manage version numbers

#### Acceptance Criteria

1. WHEN a commit following conventional commit format is pushed to the main branch, THE Extension Release System SHALL analyze the commit message and determine the appropriate semantic version increment
2. THE Extension Release System SHALL update the version field in the extension manifest.json file to reflect the new semantic version
3. THE Extension Release System SHALL commit the updated manifest.json file back to the repository with a release commit message
4. IF the commit message contains breaking changes, THEN THE Extension Release System SHALL increment the major version number
5. WHERE a commit message indicates a new feature, THE Extension Release System SHALL increment the minor version number

### Requirement 2

**User Story:** As a developer, I want an automated changelog generated from commit messages, so that users can understand what changed in each release

#### Acceptance Criteria

1. WHEN a new release is created, THE Extension Release System SHALL generate a CHANGELOG.md file in the extension directory based on conventional commit messages
2. THE Extension Release System SHALL include all commits since the previous release in the changelog
3. THE Extension Release System SHALL categorize changelog entries by type (features, bug fixes, breaking changes)
4. THE Extension Release System SHALL commit the updated CHANGELOG.md file to the repository as part of the release process

### Requirement 3

**User Story:** As a developer, I want the extension files packaged into a distributable ZIP file, so that I can easily upload it to the Chrome Web Store

#### Acceptance Criteria

1. WHEN a release is created, THE Extension Release System SHALL create a ZIP archive containing all files from the extension directory
2. THE Extension Release System SHALL exclude development files (tests, node_modules, .gitignore) from the ZIP archive
3. THE Extension Release System SHALL attach the ZIP archive as a release asset to the GitHub release
4. THE Extension Release System SHALL name the ZIP file using the pattern "cv-tailor-extension-v{version}.zip" where version is the semantic version number

### Requirement 4

**User Story:** As a developer, I want GitHub releases created automatically with release notes, so that users can download specific versions and see what changed

#### Acceptance Criteria

1. WHEN a new version is released, THE Extension Release System SHALL create a GitHub release with the semantic version as the tag name
2. THE Extension Release System SHALL populate the GitHub release description with the generated release notes from the changelog
3. THE Extension Release System SHALL mark the release as a prerelease when triggered from prerelease branches
4. THE Extension Release System SHALL mark the release as a production release when triggered from the main branch

### Requirement 5

**User Story:** As a developer, I want the release workflow to run only when extension files change, so that we don't create unnecessary releases for non-extension changes

#### Acceptance Criteria

1. THE Extension Release System SHALL trigger only when commits are pushed to the main branch or prerelease branches
2. THE Extension Release System SHALL execute the release process for commits that modify files in the extension directory
3. WHERE commits only modify files outside the extension directory, THE Extension Release System SHALL skip the release process
4. THE Extension Release System SHALL validate that required secrets and permissions are configured before attempting a release

### Requirement 6

**User Story:** As a developer, I want prerelease versions created from development branches, so that I can test releases before promoting them to production

#### Acceptance Criteria

1. WHEN commits are pushed to dev/*, feature/*, or hotfix/* branches, THE Extension Release System SHALL create a prerelease version with appropriate prerelease identifiers
2. THE Extension Release System SHALL use different semantic-release configuration for prerelease branches
3. THE Extension Release System SHALL mark GitHub releases from prerelease branches as prereleases
4. THE Extension Release System SHALL not update the main CHANGELOG.md for prerelease versions
