# SLC Presenter

Offline church presentation software for Windows, with schedules, songs, Scripture, media, themes, Preview, Live, and Audience Output workflows.

## Development

```powershell
npm install
npm run dev
```

Run the lightweight browser-only UI prototype (no Electron or local database required):

```powershell
npm run prototype
```

Prototype edits are saved in browser storage. Use this mode for UI layout and workflow iteration; desktop-only imports and hardware output are intentionally unavailable.

Run the desktop application:

```powershell
npm run desktop
```

## Tests

```powershell
npm test
npm run build
```

## Windows installer

```powershell
npm run dist:win
```

The installer is generated under `release/`.

