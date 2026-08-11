# Marco's brain

Aufgaben und Notizen in einer App. Ersatz für Google Notizen.
**Version 2.0**, Stand 11. August 2026. Datei rund 106 KB, 1870 Zeilen.
Die Testreihen unter `tests/` prüfen 151 Punkte, Aufruf mit `./tests/run.sh`.

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

Speicherschlüssel `tagwerk.v1`, Zugangsdaten unter `tagwerk.v1.cfg`
(dort steht auch der optionale Gerätename `name`), Warteschlange unter `tagwerk.v1.q`.

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
  von: "Marco"|null,          // wer abgehakt hat, nur wenn ein Gerätename gesetzt ist
  erstellt: zeitstempel,
  pos: sortierposition,       // streng aufsteigend, für eigene Reihenfolge
  ts: zeitstempel,            // reiner Abgleichsstempel, siehe Grundlagen Abschnitt 5
  notiz: "Telefon 0170…"|null,
  notizId: "n…"|null,         // verbundene Notiz
  wdh: "taeglich"|"zweitaeglich"|"woechentlich"|"monatlich"|null,
  wdhTag: 0..6|null           // fester Wochentag, nur bei "woechentlich"
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
  ts: zeitstempel,            // reiner Abgleichsstempel
  aufgabe: "a…"|null,         // verbundene Aufgabe
  pos: sortierposition        // für eigene Reihenfolge
}
```

### Startlisten

`Allgemein`, `Geburt`, `Arbeit`, `Ideen` – frei erweiterbar, mit Farbe aus einer Palette
von acht Werten. Listen gelten gleichermaßen für Aufgaben und Notizen.

---

## 3. Die fünf Ansichten

### Heute
Neu: **Diese Woche noch** – der Topf `wann:"woche"` lebte bisher nur in der Wochenansicht
und war auf dem Hauptbildschirm unsichtbar. Jetzt stehen bis zu drei Einträge kompakt auf
„Heute", jeder mit einem Knopf, der ihn in den Tag holt.

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

### Schnelleingabe an zwei Stellen

Oben auf „Heute" das gewohnte Feld. Zusätzlich ein runder Knopf über der Navigationsleiste –
in Daumenreichweite, weil die App oft einhändig bedient wird und der obere Bildschirmrand
dafür die schlechteste Stelle ist. Er öffnet ein kleines Fenster mit Feld und Zielauswahl
(Heute · Morgen · Diese Woche · Nur sammeln) und bleibt nach dem Anlegen offen, damit
mehrere Dinge am Stück hineingehen. Auf der Notizansicht legt derselbe Knopf eine Notiz an.

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

### Kurze Wege in den Tag

Der häufigste Handgriff – etwas aus dem Vorrat oder aus dem Überfälligen in den heutigen
Tag holen – ist ein Tipp, kein Weg durch ein Fenster. Aufgaben ohne Termin und überfällige
Aufgaben tragen direkt in der Zeile die Knöpfe **Heute** und **Morgen**; der Knopf für den
bereits gesetzten Termin entfällt. Im Kopf der Überfällig-Sektion steht zusätzlich
**Alle auf heute**.

### Löschen
Kurze Rückfrage in einem kompakten Blatt, danach zusätzlich sieben Sekunden lang eine
Rücknahme-Leiste. Gilt für Aufgaben und Notizen gleichermaßen.

### Wiederholungen
Täglich, **alle 2 Tage**, wöchentlich, monatlich. Beim Abhaken entsteht automatisch der
nächste Termin. Lag die Aufgabe lange, springt der Folgetermin so weit vor, dass er in der
Zukunft liegt – statt fünf verpasste Wochen nachzuliefern.

Bei „wöchentlich" lässt sich ein **fester Wochentag** wählen; ohne Wahl bleibt es beim
Abstand von sieben Tagen. Bei „monatlich" wird der Monatstag auf den letzten gültigen Tag
des Zielmonats begrenzt – der 31. Januar führt zum 28. Februar, nicht zum 3. März.

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

**Sicherheit:** `sauberHtml()` läuft, bevor HTML gespeichert oder angezeigt wird. Es entfernt

- ganze Blöcke, die in einer Notiz nichts zu suchen haben (`script`, `style`, `iframe`,
  `object`, `embed`, `form`, `meta`, `base` …),
- alle `on…`-Attribute – auch wenn sie mit `/` oder einem Umbruch statt eines Leerzeichens
  abgetrennt sind (`<img/onerror=…>` kam vorher durch),
- Adressen in `href`/`src`, die Code ausführen könnten. Erlaubt bleiben `http`, `https`,
  `mailto`, `tel`, relative Adressen und eingefügte Bilder als `data:image/…;base64`.
  Entities werden vor der Prüfung aufgelöst, sonst wäre `java&#115;cript:` erst im Browser
  wieder ein Schema.

Bis Version 1.8 fehlte alles außer `<script>` und den Leerzeichen-getrennten `on…`-Attributen.
Der Inhalt kommt aus dem Editor, aus geteilten Seiten und aus dem Google-Import – überall
kann fremdes HTML mitkommen.

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

## 12. Was in Version 2.0 dazugekommen ist

Zwölf Verbesserungen an der Bedienung, alle per Test abgesichert (`tests/07-neuerungen.js`):

1. **Heute/Morgen direkt auf der Zeile** – aus drei Tippern wird einer.
2. **„Alle auf heute"** im Kopf der Überfällig-Sektion, statt drei Ansichten entfernt.
3. **Leere Notizen werden beim Schließen verworfen** – wer anlegt und ohne Eingabe schließt,
   hinterlässt nichts. Verbundene Notizen sind ausgenommen.
4. **Schnelleingabe in Daumenreichweite** – siehe Abschnitt 4.
5. **Die Suche zeichnet nicht mehr alles neu.** `aufSucheAendern()` tauscht nur noch
   `#suchtreffer` aus. Das ist die in den Grundlagen beschriebene Falle „Vollständiges
   Neuzeichnen zerstört den Tastaturfokus" – sie war hier wieder eingezogen.
6. **Alle 2 Tage** und **fester Wochentag** bei der Wiederholung.
7. **„Diese Woche noch"** auf dem Hauptbildschirm.
8. **„Liegt seit N Tagen"** an gesammelten Aufgaben ab 14 Tagen (`LIEGT_AB`). Die ruhige
   Version einer Erinnerung – ohne Benachrichtigungen, die bewusst nicht gebaut sind.
9. **Rückblick mit Inhalt** – „Zeigen, was es war" listet die tatsächlich erledigten
   Aufgaben der letzten sieben Tage nach Tag gruppiert, nicht nur Balken.
10. **Eine Suche über Aufgaben und Notizen**, inklusive Archiv und Erledigtem.
11. **Aufgabe und Notiz verbinden** – `notizId` an der Aufgabe, `aufgabe` an der Notiz,
    ein Sprung in beide Richtungen. Kein Verknüpfungssystem, nur die zwei Knöpfe.
12. **Wer hat abgehakt** – optional. Steht unter „Mehr" ein Gerätename in `cfg.name`, wird
    er beim Abhaken in `von` vermerkt und erscheint in der Zeile und im Rückblick. Ohne
    Namen bleibt alles anonym wie bisher. Bewusst abschaltbar, weil eine Buchführung
    übereinander auch belasten kann.

## 13. Was in Version 1.9 behoben wurde

- **Änderungen konnten sich selbst rückgängig machen.** Abhaken, Zurücknehmen, Anheften,
  Archivieren, Verschieben, Liste wechseln, Wiederholung setzen – all das schrieb nur das
  einzelne Feld, ohne einen Zeitstempel zu hinterlassen. Beim Zusammenführen gewann dann die
  *alte* Fassung, weil sie durch ihr `fertig` den jüngeren Stempel trug. Jetzt geht jede
  Änderung durch `aufAendern()` beziehungsweise `notizAendern()` und führt einen reinen
  Abgleichsstempel `ts` mit. `geaendert` bleibt dem Inhalt vorbehalten, damit die Sortierung
  „zuletzt geändert" weiter stimmt. `stempel()` nimmt jetzt den **jüngsten** aller Zeitstempel
  statt des erstbesten.
- **Kennungen und Positionen kollidierten unter Last.** `id6()` hatte nur vier Zufallszeichen
  und `naechstePos()` zählte modulo 100 – bei einem Import mit hunderten Notizen in derselben
  Millisekunde konnten Einträge einander überschreiben, und die eigene Reihenfolge kippte.
  Beide zählen jetzt streng aufsteigend.
- **Der HTML-Bereiniger hatte Lücken** – siehe Abschnitt 5.
- **Die Warteschlange verlor Daten** und dauerhafte Verbindungsfehler blieben stumm –
  siehe Grundlagen, Abschnitt 5.
- **Archiviert/gelöscht/angepinnt** wurden im HTML-Rückfall des Google-Imports nur erkannt,
  wenn die Klasse allein stand (`class="archived"`, aber nicht `class="note archived"`).
- Denkbar: Erinnerungen, wiederkehrende Notizvorlagen, Export einzelner Notizen als PDF.
