# macOS builds

SLC Presenter is packaged for both current Mac architectures:

- `arm64` for Apple Silicon Macs (M1 and newer)
- `x64` for Intel Macs

The macOS packages must be created on macOS because DMG creation, application signing, and notarization use Apple tooling. The `macOS Release` GitHub Actions workflow runs the complete test suite and produces both a DMG and ZIP for each architecture.

## Run from GitHub

Open **Actions → macOS Release → Run workflow**. Download the `slc-presenter-macos-arm64` or `slc-presenter-macos-x64` artifact after both jobs pass.

Pushing a version tag such as `v0.1.26` also runs the workflow and attaches the packages to the GitHub release.

## Run on a Mac

```sh
npm ci
npm test
npm run dist:mac:arm64
```

Use `npm run dist:mac:x64` on an Intel Mac. Output is written to `installer/`.

## Apple signing and notarization

Unsigned builds are suitable for internal testing but macOS will identify them as coming from an unidentified developer. For normal distribution, add these repository secrets:

- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

The workflow passes these values only to electron-builder. Certificates and passwords must never be committed to the repository. When the secrets are present, electron-builder signs, notarizes, and staples the application automatically.
