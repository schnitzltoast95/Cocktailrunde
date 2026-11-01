---
name: Cocktailrunde
description: Eine gemeinsame Cocktailkarte mit persönlichen Notizen.
colors:
  page-ground: "#f2f4f1"
  light-nav: "#fafbf8"
  paper: "#fffdfa"
  paper-raised: "#ffffff"
  paper-deep: "#e9eeeb"
  rule: "#cbd3cf"
  ink: "#25313a"
  muted-ink: "#53616b"
  plum: "#823b50"
  plum-on: "#fff7ee"
  note: "#e3eff0"
  note-ink: "#284048"
typography:
  headline:
    fontFamily: "Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.85rem, 6vw, 2.4rem)"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 720
    lineHeight: 1.25
  body:
    fontFamily: "Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.94rem"
    lineHeight: 1.5
  note:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "0.94rem"
    lineHeight: 1.3
rounded:
  paper-sheet: "12px"
  field: "9px"
  filter: "999px"
spacing:
  page-x: "20px"
  page-top: "29px"
  sheet-gap: "21px"
components:
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper-sheet}"
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.plum-on}"
    rounded: "{rounded.field}"
    height: "50px"
  filter-selected:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.plum-on}"
    rounded: "{rounded.filter}"
  annotation:
    backgroundColor: "{colors.note}"
    textColor: "{colors.note-ink}"
---

# Design System: Cocktailrunde

## Overview

**Creative North Star: „Die gemeinsam beschriebene Karte“**

Die App zeigt eine echte Cocktailkarte als Arbeitsfläche für gemeinsame Erinnerungen. Helles Papier trägt die gesamte Ansicht, einschließlich Kopf und Navigation. Die einzige ausgeprägte Geste sind kurze, farblich abgesetzte Notizen direkt beim jeweiligen Cocktail.

**Key Characteristics:**
- Menünamen, Zutaten, Preis und Bewertungen bleiben in einer schnell lesbaren Zeile.
- Personen und Urteil stehen unmittelbar an der Karte; längere Notizen öffnen sich mit dem Drink.
- Papierdetails beschränken sich auf eine feine Bindungslinie und leichte Höhenstaffelung.

## Colors

Die Palette verbindet helles, neutrales Papier mit Pflaumentinte und einem kühlen Notizton.

### Primary
- **Pflaumentinte** (`#823b50`): Filterauswahl, Links und Hauptaktion; `#fff7ee` ist die Schrift darauf.

### Secondary
- **Gemeinschaftsnotiz** (`#e3eff0`): Bereits gespeicherte Bewertungen am Drink; `#284048` ist ihre Schrift.

### Neutral
- **Seitenpapier** (`#f2f4f1`): heller Seitenhintergrund ohne dunklen Rahmen.
- **Helle Navigation** (`#fafbf8`): Appkopf und untere Navigation.
- **Menüpapier** (`#fffdfa`): Menüabschnitte und Panels.
- **Erhöhtes Papier** (`#ffffff`): Eingaben und sekundäre Aktionen.
- **Abgesetztes Papier** (`#e9eeeb`): private Notizen und leere Zustände.
- **Tinte** (`#25313a`), **Nebentext** (`#53616b`) und **Regel** (`#cbd3cf`): lesbare Hierarchie auf Papier.

**Die Notizregel.** Kühles Blaugrün kennzeichnet die Meinungen auf der Karte; private, noch lokale Einträge bleiben papierfarben und tragen einen Textstatus.

## Typography

**Display und Body:** Segoe UI mit Systemschriften als Ersatz. **Notiztext:** Georgia oder Times New Roman, kursiv. Die Serifenschrift markiert nur freie Kommentare, nicht Labels oder Bedienelemente.

### Hierarchy
- **Seitenüberschrift:** 750, `clamp(1.85rem, 6vw, 2.4rem)`, 1.12, leicht eng gesetzt.
- **Drinkname:** 720, `1rem`, 1.25.
- **Fließtext:** etwa `0.94rem`, 1.5.
- **Notiz:** kursiv, `0.94rem`, 1.3.
- **Label:** `0.88rem`, 700 für Felder.

## Layout

Eine Spalte von höchstens 820 px, auf dem Telefon 14–20 px Seitenrand. Suche und Filter stehen über der Karte. Menüabschnitte sind Papierflächen mit 21 px Abstand; die einzelnen Drinks werden durch feine Regeln getrennt. Die Navigation bleibt unten und berücksichtigt Safe Areas. Ab 700 px wachsen die Seitenränder auf 35 px.

## Elevation & Depth

Papierflächen liegen mit einem leichten, nach unten versetzten Schatten auf dem hellen Grund (`0 12px 25px rgba(36, 50, 58, .08)`). Der Bewertungsdialog hebt sich stärker ab (`0 24px 56px rgba(15, 9, 13, .42)`). Innere Notizen und Zeilen bleiben flach.

## Shapes

Menüblätter und Panels haben 12 px Radius, Eingaben 9 px. Filter sind pillenförmig. Die dünne rosa Linie links im Menüblatt deutet eine Bindung an; sie ist ein Detail, keine Navigation oder Statusanzeige.

## Components

### Buttons
- **Hauptaktion:** Pflaumentinte, helle Schrift, mindestens 50 px Höhe.
- **Sekundär:** helles Papier, feiner Rand, mindestens 44–48 px Höhe.
- **Fokus:** sichtbare 3 px Kontur mit Abstand.

### Chips
- **Normal:** Papier und feiner Rand; mindestens 44 px hoch.
- **Gewählt:** volle Pflaumenfläche und helle Schrift, zusätzlich höhere Schriftstärke.

### Karten und Menüliste
- **Menüblatt:** warmer Papierton, 12 px Radius, Bindungslinie, ein Schatten pro Abschnitt.
- **Drink:** Name, Zutaten und Preis zuerst; vorhandene Bewertungen darunter als zugeschriebene Notizstreifen. Die ganze Zeile öffnet den Bewertungsdialog.

### Inputs und Navigation
- **Eingaben:** helles Papier, 1 px Regel, dunkle Tinte und gut sichtbare Platzhalter.
- **Navigation:** heller Streifen unten; der aktive Bereich bekommt eine leicht abgesetzte Papierfläche mit Pflaumentinte.

## Do's and Don'ts

### Do:
- **Do** show the author and verdict beside the drink, even when no free-text note exists.
- **Do** label pending and local-only notes in words.
- **Do** keep menu text, actions and filters familiar and easy to tap.

### Don't:
- **Don't** invent cocktail photos, tasting impressions or quotes.
- **Don't** fill the page with tape, stamps or decorative handwriting.
- **Don't** hide the price or rating action behind notebook decoration.
