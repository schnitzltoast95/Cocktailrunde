# Supabase Einrichtung

## Bereits eingerichtet

- Organisation `Cocktailrunde`, Projekt `voqtcevdtibtqiwczhua` in `eu-west-1`.
- Projekt URL und öffentlicher publishable key stehen in `web/supabase-config.js`. Ein `secret` oder `service_role` Schlüssel gehört niemals in die App.
- `migrations/001_initial.sql` wurde angewandt: `friend_groups`, `group_members` und `drink_ratings` mit Row Level Security. `migrations/002_restrict_auto_rls.sql` wurde ebenfalls angewandt.
- Die private Gruppe `Cocktailrunde` ist eingerichtet. Ihre ID bleibt außerhalb des öffentlichen Repositorys.
- E-Mail-Anmeldung ist aktiviert. Die App verwendet E-Mail und Passwort. Die E-Mail-Bestätigung ist für den privaten Testkreis deaktiviert.
- Das erste App-Konto ist in `group_members` eingetragen. Die App zeigt ihm die Gruppe an. Eine nicht angemeldete REST-Anfrage auf `friend_groups` wurde mit `401` abgewiesen.
- Eine echte Amaretto-Sour-Bewertung wurde lokal gespeichert, nach `drink_ratings` hochgeladen und in der Gruppenansicht wieder angezeigt.
- Das zweite bestätigte App-Konto ist in `group_members` eingetragen. Auf dessen Android-Gerät ist die Amaretto-Sour-Bewertung nach „Jetzt abgleichen“ sichtbar.
- `tests/rls_smoke.sql` wurde erfolgreich im SQL Editor ausgeführt: Das zweite Mitglied kann die erste Bewertung lesen, aber nicht ändern; eine simulierte Nichtmitglied-ID sieht weder Gruppe noch Bewertungen. Die Transaktionen wurden zurückgerollt.

## Selbstständige Einladungen

`migrations/003_self_service_invites.sql` ist angewandt und ergänzt Einladungen und Mitgliederverwaltung. Angemeldete Mitglieder können in der App einen Code erzeugen. Er gilt sieben Tage und für höchstens zehn Beitritte. Ein neuer Code ersetzt den vorherigen Code desselben Mitglieds. Ein Freund registriert sich mit eigenem Konto und gibt den Code unter „Gruppe“ ein. Gruppenmitglieder können ihren Anzeigenamen ändern und die Gruppe selbst verlassen. Codes werden nur persönlich geteilt; wer einen gültigen Code besitzt und angemeldet ist, kann beitreten.

Die Funktionen prüfen die Nutzer-ID und Mitgliedschaft in der Datenbank. Die App erhält weder direkte Schreibrechte für Einladungen noch für fremde Mitgliedschaften. `tests/invite_smoke.sql` wurde mit zurückgerollten Testschreibvorgängen erfolgreich ausgeführt.

## Noch erforderlich

1. Das aktualisierte Debug-APK unter `android/app/build/outputs/apk/debug/app-debug.apk` auf den Geräten installieren.
2. Mit einem vorhandenen Gruppenmitglied einen Code erzeugen und auf einem neuen Konto einlösen. Danach Mitgliederliste, Bewertungen, Codeablauf und Gruppenaustritt prüfen.

## Datenfluss

- Die App liest den Katalog und persönliche Bewertungen lokal.
- Neue Bewertungen werden zuerst in IndexedDB gespeichert. Angemeldete Mitglieder senden ausstehende Bewertungen danach an Supabase und laden die Gruppe nach.
- Offline bleiben neue Bewertungen lokal sichtbar; Freunde sehen sie erst nach erfolgreichem Abgleich.
- Für zeitgleiche Änderungen derselben Bewertung auf zwei Geräten gilt in der ersten Version der zuletzt erfolgreich synchronisierte Stand. Ein fehlgeschlagener Upload löscht die lokale Änderung nicht.

## Stand

Die Datenbank ist vorhanden, die App ist konfiguriert und die E-Mail-Bestätigung deaktiviert. Zwei Konten sind Mitglieder; Bewertungen wurden zwischen Android-Geräten und nach einem Offline-Test synchronisiert. Die Einladungsfunktionen sind aktiviert; Mitgliederliste und Abgleich wurden im Browser geprüft. Der Beitritt mit einem dritten, neuen Konto ist noch nicht praktisch getestet. Anonyme Abfragen und nicht autorisierte Änderungen sind gesperrt. Lokale Bewertungen funktionieren weiter.
