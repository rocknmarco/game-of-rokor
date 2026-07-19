# Rokor – Das Lichtarchiv

Ein eigenständiges, sonniges Pixel-Abenteuer für den Browser. Die Spielidee greift die Erkundungsgrammatik klassischer raumbasierter Adventures auf – zusammenhängende Bildschirmräume, Gegenstände, Schalter, Gefahren und versteckte Hinweise – erzählt aber eine neue Welt mit eigener Grafik und eigenen Rätseln.

## Spielen

```bash
npm install
npm run dev
```

Danach die von Vite angezeigte lokale Adresse öffnen.

## Steuerung

- `WASD` oder Pfeiltasten: laufen
- `E` oder `Enter`: sprechen, lesen, benutzen
- `Leertaste`: Sonnenstab einsetzen
- `M`: Inselkarte
- `Esc`: Dialog, Karte oder Spiel schließen

Touch-Steuerung und grundlegende Gamepad-Eingaben sind ebenfalls eingebaut. Der Spielstand wird automatisch im Browser gespeichert.

## Inhalt des ersten Kapitels

- neun nahtlos verbundene Räume auf der Insel Liora
- drei unterschiedliche Hauptprüfungen: Lichtspiegel, Druckplatte und Feuerbecken
- Inventar, Feldnotizen, Karte, Checkpoints und Autosave
- rundenähnliche Gegnerbewegung und einfacher Nahkampf
- ein vollständiger kleiner Handlungsbogen mit Ausblick auf Kapitel II

Titelmotiv und Sprite-Atlanten wurden eigens für dieses Projekt erzeugt. Figuren, Gegner und Rätselobjekte stammen aus `public/assets/tileset.png`. Der zusätzliche `public/assets/landscape-atlas.png` enthält zusammenpassende Wald-, Ufer-, Fels- und Maueranschlüsse; der Renderer wählt sie anhand der Nachbarfelder automatisch aus. Lichtstrahlen, Schatten und atmosphärische Effekte werden darüber im Canvas gezeichnet. Es werden keine Grafiken aus Tobor oder The Game of Robot verwendet.
