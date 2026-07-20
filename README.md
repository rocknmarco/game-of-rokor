# Insel der Ruinen – Tobor Web Edition

Eine browser- und mobilfähige Umsetzung der Tobor-Episode „Insel der Ruinen 1.3“. Die Webapp verwendet die originalen 284 Räume, Übersetzungen, Objektgrafiken und Geräusche und bildet die Tobor-Spielregeln in JavaScript und Canvas nach.

## Spielen

```bash
npm install
npm run dev
```

Danach die von Vite angezeigte lokale Adresse öffnen. Alternativ kann unter Windows `Spiel-starten.bat` doppelt angeklickt werden.

## Steuerung

- `WASD` oder Pfeiltasten: laufen
- `E` oder `Enter`: Rucksack am oberen Spielfeldrand öffnen
- `Pfeiltasten` im Rucksack: Gegenstand und Aktion wählen
- `Enter`: gewählte Rucksackaktion ausführen oder Meldung schließen
- `M`: Inselkarte öffnen
- `Esc`: Dialog, Rucksack, Karte oder Spiel schließen

Touch-Steuerung und grundlegende Gamepad-Eingaben sind ebenfalls eingebaut. Der Spielstand wird automatisch im Browser gespeichert. Verlorene Leben werden sofort in diesem Autosave verbucht; bei null Leben wird er beendet und kann nicht zum Zurückdrehen des Versuchs benutzt werden. Eine gefundene Uhr kann zusätzlich im Rucksack benutzt werden: Sie wird wie im Original verbraucht und legt einen geschützten Uhr-Spielstand an, der anschließend auf dem Titelbildschirm separat geladen werden kann. Spätere Autosaves und ein verlorenes Spiel überschreiben diesen Rücksetzpunkt nicht.

## Enthaltene Originalfunktionen

- 284 original angeordnete Räume auf sieben Ebenen
- originale Tobor-Gegenstände, Schlüssel, Türen, Schalter, Teleporter, Tunnel und Gegner
- obere Rucksackleiste mit Benutzen, Ablegen, Ansehen und Klonen
- kompakte Aufnahme-, Hinweis-, Gewinn- und Verlustmeldungen
- vorgeladene originale Schritt-, Aufnahme-, Tür-, Pflanzen-, Doppelgänger-, Schalter-, Schuss- und Explosionsgeräusche
- originale Naturmusik in bewaldeten Räumen
- automatischer lokaler Spielstand plus separater Uhr-Spielstand im Browser
- Tastatur-, Touch- und grundlegende Gamepad-Bedienung

Die Episodendaten liegen unter `public/games/insel-der-ruinen`. Die Tobor-Audiodateien liegen unter `public/audio`. Grundlage ist das Open-Source-Projekt [Fausti/Tobor](https://github.com/Fausti/Tobor); ergänzende Hinweise zu den Episodenautoren stehen in `public/games/insel-der-ruinen/Credits.txt`.

## Deployment auf einem Webhosting

Das Deployment sieht also so aus:

```text
Projektdateien
     ↓
npm run build
     ↓
dist
     ↓
Inhalt nach public_html hochladen
     ↓
https://spiel.deine-domain.de
```

`npm install`, `npm run dev` und die BAT-Datei werden auf Hostinger nicht benötigt. Sie sind nur für die lokale Entwicklung gedacht.
