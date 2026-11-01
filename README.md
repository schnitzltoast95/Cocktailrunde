# Cocktailrunde

Offline-first cocktail diary for a small group of friends. Product requirements are in [PRODUCT.md](PRODUCT.md).

## Current state

The web prototype can browse and search the supplied Fuego menu, save personal ratings locally, and reopen after an initial online visit without a connection. The [Supabase project and private group database](supabase/SETUP.md) are connected. E-Mail and password login is configured without email confirmation for the private test group. Two accounts are enrolled, and ratings have synchronized between Android devices, including one saved offline first. Members can generate invitation codes so friends join from the app. The menu shows attributed group notes directly at each cocktail, with a "Mit Notizen" filter and a light paper notebook design. Android builds have been tested on a connected phone. The visual system is in [DESIGN.md](DESIGN.md). An iOS package has not been built.

## Data rules

- Bars and cocktails receive stable IDs, so a revised menu does not break older ratings.
- A cocktail belongs to a specific bar. Identically named drinks in different bars are separate entries.
- Ingredient tags come from menu evidence; taste tags can be curated separately. A rating records one person's experience, not a fact about the cocktail.
- Ratings have their own IDs and authors. Repeated visits can create separate ratings for the same cocktail.
- Offline writes must be saved on the device before a sync attempt. The group feed shows the latest locally available copy and tells the user when unsynced entries remain.

## Catalog

`web/catalog.json` follows `data/catalog.schema.json`. Its 165 Fuego entries come from a supplied menu PDF; each records its source page. The original PDF stays outside the public repository. The combined menu line “Bacardi Cola / Bacardi Orange” is split into two separately ratable entries. Anything not established by the menu, such as sweetness, stays unspecified until rated.

Regenerate the catalog with the bundled Python runtime containing `pdfplumber`:

```powershell
python -X utf8 tools/import_fuego.py sources/Cocktaikarte-Fuego-2026-1.pdf
```

Run the prototype from `web/` through a local HTTP server, for example `python -m http.server 8765 --directory web`, then open `http://localhost:8765/`. The offline cache becomes available after the first successful load.

## Proposed implementation

The prototype stores ratings in IndexedDB on each device. Once configured, the sync client uploads pending ratings and caches group ratings locally. The web app is bundled with Capacitor for Android; iOS can follow. The app opens and accepts local ratings without a connection. Login and sharing need a connection at least for initial account setup; new offline ratings reach friends after synchronization.

The implemented visual system is recorded in [DESIGN.md](DESIGN.md), with a machine-readable Impeccable sidecar at `.impeccable/design.json`.

## Android Debug Build

The Capacitor Android project is in `android/`. Its current application ID, `app.friends.cocktails`, is provisional until release naming is decided. After editing files in `web/`, sync the bundled assets before building:

```powershell
npm install
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

The expected output is `android/app/build/outputs/apk/debug/app-debug.apk`. The release APK uses a local signing key under `.signing/`, which is excluded from Git and must be backed up separately. Build it with `cd android; .\gradlew.bat assembleRelease`. The resulting APK is under `android/app/build/outputs/apk/release/`. iOS packaging will require a Mac with Xcode.
