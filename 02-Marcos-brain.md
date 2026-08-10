# Marco's brain

Aufgaben und Notizen in einer App. Ersatz für Google Notizen.
**Version 1.8**, Stand 10. August 2026. Datei rund 96 KB, davon 79 KB Skript,
1449 Zeilen, 108 Funktionen.

Voraussetzung: Lies zuerst `00-Grundlagen-und-Infrastruktur.md`.

Frühere Namen: die App hieß zwischenzeitlich *Tagwerk* und *Klarkopf*. Der interne
Speicherschlüssel heißt deshalb bis heute `tagwerk.v1` und **darf nicht geändert werden**,
sonst verwaisen alle Daten.

---

## 1. Warum es diese App gibt

Google Notizen kennt nur Listen. Marcos tatsächliches System ist aber zweistufig:

- Dinge mit **Termin** – heute, morgen, diese Woche, danach.
- Dinge im **Vorrat** – eine Liste wie „Geburt", aus der gezielt in den Tag gezogen wird.

Genau diese Unterscheidung ist das Kernkonzept der App. Dazu kommt die Freude am sichtbar
Erledigten am Ende des Tages, die Keep ebenfalls nicht bietet.

---

## 2. Datenmodell

Speicherschlüssel `tagwerk.v1`, Zugangsdaten unter `tagwerk.v1.cfg`,
Warteschlange unter `tagwerk.v1.q`.

```
S = {
  aufgaben:    { id: aufgabenObjekt },
  notizen:     { id: notizObjekt },
  kategorien:  { id: {n, f, art, pos} },     // "Listen" in der Oberfläche
  einst:       { notizSort: "erstellt"|"geoeffnet"|"geaendert"|"eigen" },
  version:     "1.8"
}
```

### Aufgabe

```js
{
  t: "Kinderwagen abholen",   // Text
  wann: null,                 // siehe unten
  kat: "k_geb"|null,          // Liste
  fertig: zeitstempel|null,   // Zeitpunkt des Abhakens
  erstellt: zeitstempel,
  pos: sortierposition,       // streng aufsteigend, für eigene Reihenfolge
  notiz: "Telefon 0170…"|null,
  wdh: "taeglich"|"woechentlich"|"monatlich"|null
}
```

**Das Feld `wann` kennt fünf Zustände** – das ist der Kern des Konzepts:

| Wert | Bedeutung |
|---|---|
| `"2026-08-14"` | konkreter Tag |
| `"woche"` | diese Woche, ohne festen Tag |
| `"danach"` | irgendwann später |
| `null` | nur gesammelt, liegt in seiner Liste und taucht im Tagesgeschäft nicht auf |
| Datum in der Vergangenheit | wird als überfällig angezeigt |

### Notiz

```js
{
  titel: "…",                 // leer? wird aus den ersten 60 Zeichen des Textes erzeugt
  html: "<h3>…</h3><p>…</p>", // bereinigtes HTML
  kat: "k_arb"|null,
  art: "frei"|"karte"|"buch"|"input"|"projekt",
  archiv: false,
  oben: true,                 // angeheftet, steht immer ganz oben
  erstellt, geaendert, geoeffnet,   // Zeitstempel
  pos: sortierposition        // für eigene Reihenfolge
}
```

### Startlisten

`Allgemein`, `Geburt`, `Arbeit`, `Ideen` – frei erweiterbar, mit Farbe aus einer Palette
von acht Werten. Listen gelten gleichermaßen für Aufgaben und Notizen.

---

## 3. Die fünf Ansichten

### Heute
Oben der **Tagesbogen**: „3 von 7 erledigt" mit Fortschrittsbalken, der sich beim Abhaken
füllt. Beim Antippen springt der Kreis auf, ein Ring pulsiert nach außen, der Haken zeichnet
sich – bewusst als kleine Belohnung gebaut.

Darunter drei Abschnitte: **Überfällig** (rot markiert, „seit Dienstag"), **Für heute**,
und ganz unten **Heute geschafft** mit durchgestrichenen Einträgen. Letzterer verschwindet
um Mitternacht von allein, weil er am Zeitstempel `fertig` hängt.

### Woche
Sieben Tageskarten mit Vor- und Zurück-Blättern über Wochen. Erledigte sind
**standardmäßig sichtbar** und lassen sich ausblenden. Darunter zwei Sammelabschnitte:
„Diese Woche, ohne festen Tag" und „Danach".

### Listen
Kompakter Filterknopf statt langer Chipreihe. Je Liste die gesammelten Aufgaben ohne Datum
plus ein Eingabefeld zum Sammeln. Oben ein Suchfeld über **alle** Aufgaben inklusive
erledigter.

### Notizen
Suchfeld, Filterknopf, Kartenliste. Karten haben einen farbigen Rand in der Listenfarbe,
rechts Nadel, Archiv und Papierkorb. Bei Sortierung nach Zeit werden sie automatisch
gruppiert: Angeheftet, Heute, Diese Woche, Diesen Monat, Monatsnamen, Jahre.

### Mehr
Rückblick der letzten sieben Tage als Balken, Listenverwaltung, Aufräumfunktionen,
Google-Import, Sync, Sicherung, Zurücksetzen, Versionsnummer.

---

## 4. Besonderheiten der Bedienung

### Schnelleingabe versteht Zusätze
`eingabeDeuten()` erkennt beim Eintippen:
- `heute`, `morgen`, `übermorgen`, `woche`, `danach`, `irgendwann`
- Wochentage (`Freitag`, `Mo`, `Di`, …) – immer der nächste passende
- Datumsangaben `14.9.` – bei Vergangenheit automatisch das Folgejahr
- `#Geburt` – Zuordnung zur Liste, Präfix genügt

Beispiel: „Kinderwagen abholen morgen #Geburt" landet mit Datum in der richtigen Liste.

Nach dem Anlegen **bleibt der Fokus im Feld**, damit man mehrere Aufgaben am Stück eintippen kann.

### Ziehen und Ablegen
Der Knopf „Sortieren" tauscht Stift und Papierkorb gegen einen Greifpunkt. Umgesetzt mit
Pointer-Events und `touch-action:none` am Griff; beim Ziehen zeigt eine Linie das Ziel.
Vorhanden in Heute, Woche, Listen und Notizen.

Bei Notizen schaltet das Ablegen automatisch auf „Eigene Reihenfolge", weil manuelles Ordnen
neben einer Datumssortierung sinnlos wäre. **Achtung:** Anzeige und Ablegen müssen dieselbe
Sortierrichtung haben – ein früherer Fehler ließ gezogene Notizen ans andere Ende springen.

### Löschen
Kurze Rückfrage in einem kompakten Blatt, danach zusätzlich sieben Sekunden lang eine
Rücknahme-Leiste. Gilt für Aufgaben und Notizen gleichermaßen.

### Wiederholungen
Täglich, wöchentlich, monatlich. Beim Abhaken entsteht automatisch der nächste Termin.
Lag die Aufgabe lange, springt der Folgetermin so weit vor, dass er in der Zukunft liegt –
statt fünf verpasste Wochen nachzuliefern.

---

## 5. Der Notizeditor

`contenteditable` plus `document.execCommand`. Veraltet, aber in Chrome zuverlässig und
ohne Bibliothek nicht ersetzbar.

Werkzeugleiste nach Zweck geordnet: **Abschnitt, Text, Aufzählung, Nummerierte Liste**,
dann Auszeichnung (fett, kursiv, durchgestrichen), dann Trennlinie und Bild.

Schrift: moderne serifenlose Systemschrift, 17px, Zeilenhöhe 1,62. Abschnittsüberschriften
klein, versal, violett mit feiner Trennlinie – dadurch sieht man die Struktur beim Überfliegen.

**Vorlagen** beim Anlegen, abgeleitet aus den tatsächlichen Anwendungsfällen:
- *Leer*
- *Kartentext* – Anrede und Grußformel vorbereitet, wird nach dem Verschicken gelöscht
- *Buch oder Podcast* – Quelle, Kernaussagen, Zitate, Was ich mitnehme
- *Input oder Vortrag* – Anlass und Publikum, Kernbotschaft in einem Satz, Roter Faden,
  Beispiele, Schluss und Aufruf
- *Sammlung zu einem Thema* – Worum es geht, Offene Fragen, Gefundenes

**Bilder** werden vor dem Einfügen auf 1200 Pixel und JPEG-Güte 0,72 verkleinert. Ohne das
wäre der Browserspeicher nach etwa zwanzig Fotos voll. Gespeichert wird beim Tippen mit
600 ms Verzögerung, Zeitstempel steht unter dem Editor.

**Sicherheit:** `sauberHtml()` entfernt `<script>`-Blöcke und alle `on…`-Attribute, bevor
HTML gespeichert oder angezeigt wird.

---

## 6. Die Suche

`notizenSuchen(q, modus)` mit `modus` = `aktiv` | `archiv` | `alle`.

Gewichtung je Suchwort:
- Titel: **6 Punkte**
- Listenname: **3 Punkte**
- Text: **1 Punkt plus Häufigkeit**, gedeckelt bei 3

**Alle** eingegebenen Wörter müssen vorkommen. Treffer werden mit `<mark>` hervorgehoben,
der Ausschnitt beginnt in der Nähe des ersten Treffers.

Wichtig: Die Normalisierung nutzt `normText()` **ohne Kürzung**. Ein früherer Fehler nutzte
`slug()`, das nach 60 Zeichen abschneidet – in langen Notizen war dadurch ab Zeile drei
nichts mehr auffindbar.

---

## 7. Import aus Google Notizen

Unter „Mehr → Google-Notizen-Export einlesen". Takeout-Archiv entpacken, Ordner `Keep`
auswählen, alle Dateien gemeinsam markieren.

### Ablauf
- **JSON schlägt HTML.** Zu jeder Notiz gibt es beides; das JSON enthält Archivstatus,
  Etiketten und Zeitstempel sauber. Gibt es nur HTML, wird das gelesen.
- **Archivierte werden übersprungen**, Papierkorb immer. Ein Schalter erlaubt trotzdem die
  Übernahme (landet dann im Archiv von Marco's brain).
- **Etiketten werden zu Listen**, mit Farbe aus der Palette.
- **Checklisten wahlweise zu Aufgaben** – offene Punkte werden Aufgaben ohne Datum in der
  Liste des Etiketts, mit Herkunftsvermerk „Aus Google Notizen: …". Abgehakte fallen weg.
  Alternativ wird eine Notiz mit durchgestrichenen Punkten erzeugt.
- **Angepinnte** Notizen werden oben angeheftet.
- **Doppelte** werden über Titel plus Erstellzeitpunkt erkannt.
- Vor dem Import zeigt ein Bericht, was passieren wird.

### Was dabei zu beachten war
Google verpackt jeden Absatz in `<span style="font-size:7.2pt">`. Ungefiltert übernommen
wären alle Notizen unlesbar klein. `keepSaeubern()` wirft die Formatierung weg und behält
nur echte Auszeichnung: fett, kursiv, durchgestrichen, unterstrichen, Absätze, Umbrüche,
Listen, Links.

Checklisten liegen im JSON unter `listContent`, im HTML als `<li class="listitem">` mit
den Zeichen ☐ und ☑. **Beides muss behandelt werden** – anfangs war nur der JSON-Weg
umgesetzt, wodurch eine Checkliste ohne JSON-Partner als unbrauchbarer Fließtext ankam.

**Bilder aus Takeout** liegen als separate Dateien vor und lassen sich nicht übernehmen.
Der Bericht weist auf die Anzahl betroffener Notizen hin.

---

## 8. Teilen aus anderen Apps

Über `share_target` im Manifest erscheint die App im Android-Teilen-Menü. Geteilte Inhalte
können wahlweise als schnelle Aufgabe oder als Notiz mit vollem Text übernommen werden.

**Voraussetzung:** Die App muss über Chromes Menüpunkt „App installieren" installiert sein,
nicht nur als Verknüpfung über „Zum Startbildschirm hinzufügen". Dafür braucht es
`manifest.json`, Icons und einen Service Worker – alle drei sind vorhanden.

---

## 9. Aufräumen und Sicherung

- **Erledigtes älter als 30 Tage löschen** – ein Knopf unter „Mehr".
- **Überfälliges auf heute ziehen** – schiebt alles Liegengebliebene in den heutigen Tag.
- **Alles als Datei sichern** – der komplette Zustand als JSON zum Kopieren.
- **Sicherung einspielen** – ersetzt den Stand vollständig, mit Rückfrage.
- Unter „Mehr" steht außerdem, wie viel Speicher belegt ist und wie viele Bilder enthalten
  sind – der übliche Grund für vollen Speicher.

---

## 10. Gestaltung

Eigene Farbwelt, bewusst anders als der Küchenplan:

```
--paper #F4F2ED   warmes Papierweiß
--ink   #1B1A18   fast schwarz
--akz   #4A2D6E   tiefes Violett
--gold  #9A6512   Akzent für Archiv und Hinweise
--erf   #136B54   Erfolg, Haken, Fortschritt
--rot   #9B3327   Überfällig, Löschen
```

Icon: violettes Quadrat, drei Listenzeilen, oberste mit goldenem Haken.

**Antippflächen:** Der Abhak-Kreis misst optisch 26 Pixel, seine Trefferfläche wurde über
ein Pseudoelement (`inset: -9px`) auf gut 44 Pixel erweitert. Die Zeilenknöpfe haben
`min-height: 44px`. Grund: Die wichtigste Interaktion wird oft einhändig mit Kind auf dem
Arm ausgeführt.

Dialoge sitzen **mittig** im Bildschirm mit abgerundeten Ecken; nur bei sehr flachen
Ansichten (offene Tastatur im Querformat) rutschen sie nach unten.

---

## 11. Bekannte Grenzen und offene Ideen

- **Kein Erinnerungssystem.** Keine Benachrichtigungen, keine Weckzeiten. Wäre technisch
  über die Notification API möglich, ist aber bewusst nicht gebaut.
- **Keine Unteraufgaben.**
- **Keine Verknüpfung** zwischen Aufgabe und Notiz.
- **`execCommand` ist veraltet.** Funktioniert in Chrome, könnte aber irgendwann
  wegfallen. Ersatz wäre eine eigene Bearbeitungslogik oder eine Bibliothek.
- **Löschungen können beim Sync zurückkehren** – siehe Grundlagen, Abschnitt 5.
- Denkbar: Erinnerungen, wiederkehrende Notizvorlagen, Export einzelner Notizen als PDF.
