# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Approved direction: a shared web codebase packaged for Android and iOS with Capacitor, designed for offline use from the start. Android is tested first. The private Supabase project and database schema are connected. Two Android devices have shared ratings, including one saved offline and synced later. Self-service invitation codes are available. Custom SMTP and hosting remain open.

## Users
Friends who regularly visit bars together, including Android and iPhone users. They want to remember which cocktails they tried and how much they liked them, even weeks later.

## Product Purpose
Keep a lasting record of drinks tried at specific bars and make past experiences easy to find before ordering again.

## Positioning
The app combines each bar's actual cocktail menu with personal taste notes and friends' ratings, usable during a bar visit even when connectivity is poor.

## Operating Context
People use the app on their phones in bars with large cocktail menus and sometimes unreliable internet. Initially, bars and their menus are supplied as PDF files and included as curated app data. End-user bar creation and automatic menu import are outside the initial scope.

## Capabilities and Constraints
- Browse cocktails by bar and search or filter by tags such as fruity, sour, gin, or apple.
- Record whether a drink was liked and describe taste dimensions such as sweetness, fruitiness, and sourness. The final set of dimensions and rating scale are open decisions.
- Review personal ratings over time.
- Friends in one group can see each other's personal ratings, with the author shown on each rating.
- Existing members can invite friends with a time-limited code; new members join with their own account. Members can see the group list and leave themselves.
- The bar catalog and already saved ratings must remain available offline. New ratings should save locally first and synchronize when a connection returns.
- Initial Android use is acceptable; iPhone support should remain possible.

## Evidence on Hand
The user's description of bar visits and desired workflow, plus the supplied Fuego menu at `sources/Cocktaikarte-Fuego-2026-1.pdf`. The first catalog contains only entries from that real menu; no demo drinks or invented bar data appear in the app.

## Product Principles
- Make recording a drink fast enough to do while out with friends.
- Keep personal opinions attributable to each person.
- Preserve new ratings despite a lost connection.
- Make the real bar menus useful for later discovery and recall.
