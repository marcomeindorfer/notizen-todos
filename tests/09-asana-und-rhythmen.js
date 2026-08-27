/* Zwei Erweiterungen: der Import aus Asana und die frei einstellbaren Rhythmen,
   die sich schon beim Anlegen mitschreiben lassen. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", name: "" };
  A.queue = []; A.tab = "heute"; A.katFilter = "alle"; A.aufSuche = "";
  A.offeneUnter = {}; A.asanaStand = null;
  A.asanaOpt.erledigteMit = false;
  A.asanaOpt.listeAus = "abschnitt";
  A.asanaOpt.alteTermine = true;
  A.asanaWahl = {};
  A.schnellWohin = "heute"; A.schnellWdh = "";
  Object.keys(elemente).forEach(k => delete elemente[k]);
  document.getElementById("sheet").innerHTML = "";
  meldungen.alert.length = 0;
  netz.calls = [];
}
const tagVor = n => A.iso(new Date(Date.now() - n * 86400000));
const tagNach = n => A.iso(new Date(Date.now() + n * 86400000));

/* Eine Asana-CSV, wie sie tatsächlich herauskommt: Kopfzeile, Anführungszeichen,
   ein Komma und ein Zeilenumbruch mitten in der Beschreibung, ein verdoppeltes
   Anführungszeichen, eine Unteraufgabe über „Parent task". */
const CSV = '"Task ID","Created At","Completed At","Name","Section/Column","Assignee","Due Date","Tags","Notes","Projects","Parent task"\r\n' +
  '"1201","2026-01-05","","Bad renovieren","Wohnung","Marco","' + tagNach(3) + '","Haus","Angebot einholen, dann entscheiden","Umbau",""\r\n' +
  '"1202","2026-01-06","","Fliesen aussuchen","Wohnung","Marco","","","Zeile eins\nZeile zwei mit ""Zitat""","Umbau","Bad renovieren"\r\n' +
  '"1203","2026-01-07","2026-02-01","Handwerker anrufen","Wohnung","Marco","","","","Umbau","Bad renovieren"\r\n' +
  '"1204","2026-01-08","","Steuer 2025","Papierkram","Marco","' + tagVor(20) + '","Finanzen","","Umbau",""\r\n';

gruppe("CSV lesen");
t("Kommas, Umbrüche und doppelte Anführungszeichen im Feld", () => {
  const zeilen = A.csvLesen(CSV);
  gleich(zeilen.length, 5, "Kopfzeile plus vier Aufgaben");
  gleich(zeilen[0].length, 11);
  gleich(zeilen[2][3], "Fliesen aussuchen");
  gleich(zeilen[2][8], 'Zeile eins\nZeile zwei mit "Zitat"');
});
t("Ein Byte-Order-Mark stört den ersten Spaltennamen nicht", () => {
  const zeilen = A.csvLesen("﻿" + CSV);
  gleich(zeilen[0][0], "Task ID");
});
t("Leere Zeilen fallen weg", () => {
  gleich(A.csvLesen("a,b\n\n1,2\n\n").length, 2);
});

gruppe("Asana deuten");
t("Spalten werden über ihre Namen gefunden, nicht über ihre Stelle", () => {
  const sp = A.asanaSpalten(["Notes", "Name", "Due Date"]);
  gleich(sp.name, 1); gleich(sp.notizen, 0); gleich(sp.faellig, 2);
});
t("Fehlt die Namensspalte, sagt der Import das", () => {
  const d = A.asanaLesen("x.csv", '"Notes"\n"nur Text"\n');
  wahr(d.fehler, "Fehler gemeldet: " + d.fehler);
});
t("Aufgaben kommen mit Termin, Beschreibung und Abschnitt an", () => {
  const d = A.asanaLesen("projekt.csv", CSV);
  gleich(d.aufgaben.length, 4);
  const bad = d.aufgaben[0];
  gleich(bad.t, "Bad renovieren");
  gleich(bad.faellig, tagNach(3));
  gleich(bad.abschnitt, "Wohnung");
  gleich(bad.etikett, "Haus");
  wahr(d.aufgaben[2].fertig > 0, "Erledigtes trägt einen Zeitpunkt");
});
t("Abschnittszeilen sind keine Aufgaben", () => {
  const d = A.asanaLesen("x.csv", '"Type","Name"\n"section","Wohnung"\n"task","Streichen"\n');
  gleich(d.aufgaben.map(a => a.t), ["Streichen"]);
});
t("„Parent task“ wird über Name und über Kennung aufgelöst", () => {
  const d = A.asanaLesen("projekt.csv", CSV);
  const e = A.asanaEltern(d.aufgaben);
  gleich(e["1202"], "1201", "über den Namen");
  const mitId = A.asanaLesen("x.csv",
    '"Task ID","Name","Parent task"\n"9","Thema",""\n"10","Punkt","Thema (9)"\n');
  gleich(A.asanaEltern(mitId.aufgaben)["10"], "9", "über „Name (Kennung)“");
});
t("Enkel hängen sich an den obersten Vorfahren", () => {
  const d = A.asanaLesen("x.csv",
    '"Task ID","Name","Parent task"\n"1","Oben",""\n"2","Mitte","Oben"\n"3","Unten","Mitte"\n');
  const e = A.asanaEltern(d.aufgaben);
  gleich(e["2"], "1"); gleich(e["3"], "1", "genau eine Ebene");
});
t("Ein Ring bringt die Auflösung nicht zum Stehen", () => {
  const d = A.asanaLesen("x.csv",
    '"Task ID","Name","Parent task"\n"1","A","B"\n"2","B","A"\n');
  const e = A.asanaEltern(d.aufgaben);
  wahr(true, "kein Aufhängen");
});

gruppe("Asana übernehmen");
function einlesen() {
  frisch();
  const d = A.asanaLesen("projekt.csv", CSV);
  A.asanaStand = { dateien: 1, aufgaben: d.aufgaben, kaputt: [], eltern: A.asanaEltern(d.aufgaben) };
}
t("Erledigte bleiben standardmäßig draußen", () => {
  einlesen();
  A.asanaUebernehmen();
  const namen = A.aufListe().map(a => a.t).sort();
  gleich(namen, ["Bad renovieren", "Fliesen aussuchen", "Steuer 2025"]);
});
t("Mit Schalter kommen sie mit, samt Erledigt-Zeitpunkt", () => {
  einlesen();
  A.asanaOpt.erledigteMit = true;
  A.asanaUebernehmen();
  const h = A.aufListe().find(a => a.t === "Handwerker anrufen");
  wahr(h && h.fertig > 0, "erledigt übernommen");
});
t("Unteraufgaben hängen sich richtig ein", () => {
  einlesen();
  A.asanaUebernehmen();
  const bad = A.aufListe().find(a => a.t === "Bad renovieren");
  gleich(A.kinderVon(bad.id).map(k => k.t), ["Fliesen aussuchen"]);
});
t("Abschnitte werden zu Listen", () => {
  einlesen();
  A.asanaUebernehmen();
  const namen = Object.values(A.S.kategorien).map(k => k.n);
  wahr(namen.indexOf("Wohnung") >= 0 && namen.indexOf("Papierkram") >= 0, "beide Abschnitte: " + namen);
  const st = A.aufListe().find(a => a.t === "Steuer 2025");
  gleich(A.kat(st.kat).n, "Papierkram");
});
t("Die Listenquelle lässt sich umstellen", () => {
  einlesen();
  A.asanaOpt.listeAus = "etikett";
  A.asanaUebernehmen();
  const bad = A.aufListe().find(a => a.t === "Bad renovieren");
  gleich(A.kat(bad.kat).n, "Haus");
});
t("Ohne Liste bleibt ohne Liste", () => {
  einlesen();
  A.asanaOpt.listeAus = "keine";
  A.asanaUebernehmen();
  wahr(A.aufListe().every(a => !a.kat), "keine Zuordnung");
  gleich(Object.keys(A.S.kategorien).length, 4, "keine neue Liste angelegt");
});
t("Vergangene Termine landen im Sammeln", () => {
  einlesen();
  A.asanaUebernehmen();
  const st = A.aufListe().find(a => a.t === "Steuer 2025");
  gleich(st.wann, null, "kein überfälliger Berg beim Umzug");
  const bad = A.aufListe().find(a => a.t === "Bad renovieren");
  gleich(bad.wann, tagNach(3), "künftige Termine bleiben");
});
t("Wer will, behält sie als überfällig", () => {
  einlesen();
  A.asanaOpt.alteTermine = false;
  A.asanaUebernehmen();
  gleich(A.aufListe().find(a => a.t === "Steuer 2025").wann, tagVor(20));
});
t("Beschreibungen werden zur Notiz an der Aufgabe", () => {
  einlesen();
  A.asanaUebernehmen();
  const f = A.aufListe().find(a => a.t === "Fliesen aussuchen");
  wahr(/Zeile zwei/.test(f.notiz), "mehrzeilige Beschreibung angekommen");
});
t("Ein zweiter Durchlauf legt nichts doppelt an", () => {
  einlesen();
  A.asanaUebernehmen();
  const vorher = Object.keys(A.S.aufgaben).length;
  const d = A.asanaLesen("projekt.csv", CSV);
  A.asanaStand = { dateien: 1, aufgaben: d.aufgaben, kaputt: [], eltern: A.asanaEltern(d.aufgaben) };
  A.asanaUebernehmen();
  gleich(Object.keys(A.S.aufgaben).length, vorher, "nichts kam hinzu");
});
t("Die Maske und der Bericht zeichnen ohne Fehler", () => {
  einlesen();
  A.asanaImport();
  A.asanaStand = { dateien: 1, aufgaben: A.asanaLesen("p.csv", CSV).aufgaben, kaputt: [], eltern: {} };
  const html = A.asanaMaske();
  wahr(html.length > 200 && /Vorschau|übernehmen/.test(html), "Bericht steht");
});

gruppe("Von Hand aussortieren");
t("Vorgabe ist: alles kommt mit", () => {
  einlesen();
  gleich(A.asanaAuswahl().length, A.asanaMoeglich().length);
});
t("Themen stehen vor ihren Punkten", () => {
  einlesen();
  const namen = A.asanaMoeglich().map(a => a.t);
  gleich(namen[0], "Bad renovieren");
  wahr(namen.indexOf("Fliesen aussuchen") === 1, "der Punkt folgt direkt: " + namen);
});
t("Eine einzelne Aufgabe lässt sich aussortieren und zurückholen", () => {
  einlesen();
  const st = A.asanaMoeglich().find(a => a.t === "Steuer 2025");
  A.asanaSetzen(st.schluessel, false);
  wahr(A.asanaAuswahl().every(a => a.t !== "Steuer 2025"), "draußen");
  A.asanaSetzen(st.schluessel, true);
  wahr(A.asanaAuswahl().some(a => a.t === "Steuer 2025"), "wieder drin");
});
t("Mit dem Thema gehen seine Punkte", () => {
  einlesen();
  const thema = A.asanaMoeglich().find(a => a.t === "Bad renovieren");
  A.asanaSetzen(thema.schluessel, false);
  const drin = A.asanaAuswahl().map(a => a.t);
  wahr(drin.indexOf("Fliesen aussuchen") < 0, "keine zusammenhanglosen Punkte: " + drin);
  wahr(drin.indexOf("Steuer 2025") >= 0, "Unbeteiligtes bleibt unberührt");
});
t("Ein zurückgeholter Punkt holt sein Thema mit", () => {
  einlesen();
  const thema = A.asanaMoeglich().find(a => a.t === "Bad renovieren");
  const punkt = A.asanaMoeglich().find(a => a.t === "Fliesen aussuchen");
  A.asanaSetzen(thema.schluessel, false);
  A.asanaSetzen(punkt.schluessel, true);
  const drin = A.asanaAuswahl().map(a => a.t);
  wahr(drin.indexOf("Bad renovieren") >= 0, "das Thema kam mit: " + drin);
});
t("Alle und Keine", () => {
  einlesen();
  A.asanaAlle(false);
  gleich(A.asanaAuswahl().length, 0);
  A.asanaAlle(true);
  gleich(A.asanaAuswahl().length, A.asanaMoeglich().length);
});
t("Übernommen wird nur, was ausgewählt ist", () => {
  einlesen();
  const st = A.asanaMoeglich().find(a => a.t === "Steuer 2025");
  A.asanaSetzen(st.schluessel, false);
  A.asanaUebernehmen();
  const namen = A.aufListe().map(a => a.t);
  wahr(namen.indexOf("Steuer 2025") < 0, "aussortiert blieb draußen: " + namen);
  wahr(namen.indexOf("Bad renovieren") >= 0, "der Rest kam an");
});
t("Ist nichts ausgewählt, passiert nichts", () => {
  einlesen();
  A.asanaAlle(false);
  A.asanaUebernehmen();
  gleich(Object.keys(A.S.aufgaben).length, 0);
});

gruppe("Nacheinander durchgehen");
t("Das Blatt zeigt eine Aufgabe mit Fortschritt und zwei Knöpfen", () => {
  einlesen();
  A.asanaDurchgehen(0);
  const html = document.getElementById("sheet").innerHTML;
  wahr(/1 von 3/.test(html), "Fortschritt steht da");
  wahr(/Aussortieren/.test(html) && /Übernehmen/.test(html), "beide Knöpfe");
  wahr(/Bad renovieren/.test(html), "die erste Aufgabe");
});
t("Entscheiden rückt weiter", () => {
  einlesen();
  A.asanaEntscheiden(0, true);
  wahr(/2 von 3/.test(document.getElementById("sheet").innerHTML), "zweite Aufgabe");
});
t("Aussortieren beim Durchgehen wirkt", () => {
  einlesen();
  const liste = A.asanaMoeglich();
  const stelle = liste.findIndex(a => a.t === "Steuer 2025");
  A.asanaEntscheiden(stelle, false);
  wahr(A.asanaAuswahl().every(a => a.t !== "Steuer 2025"), "draußen");
});
t("Am Ende steht wieder der Bericht", () => {
  einlesen();
  A.asanaDurchgehen(A.asanaMoeglich().length);
  const html = document.getElementById("sheet").innerHTML;
  wahr(/Jetzt übernehmen/.test(html), "zurück im Bericht");
});
t("Zurück nimmt den letzten Griff wieder auf", () => {
  einlesen();
  A.asanaEntscheiden(0, false);
  A.asanaDurchgehen(0);
  wahr(/1 von 3/.test(document.getElementById("sheet").innerHTML), "wieder bei der ersten");
});
t("Ohne gelesene Datei stürzt nichts ab", () => {
  frisch();
  A.asanaStand = null;
  gleich(A.asanaMoeglich().length, 0);
  gleich(A.asanaAuswahl().length, 0);
  A.asanaDurchgehen(0);
  A.asanaSetzen("x", true);
  wahr(true, "kein Absturz");
});

gruppe("Rhythmen");
/* Ferne Jahreszahlen, damit die Rechnung selbst geprüft wird und nicht das
   Nachrücken, das einen vergangenen Termin in die Zukunft schiebt. */
t("Jährlich springt ins nächste Jahr, der 29.2. auf den 28.", () => {
  gleich(A.naechsterTermin({ wann: "2090-03-14", wdh: "jaehrlich" }), "2091-03-14");
  gleich(A.naechsterTermin({ wann: "2096-02-29", wdh: "jaehrlich" }), "2097-02-28");
});
t("Benutzerdefiniert rechnet Zahl mal Einheit", () => {
  gleich(A.naechsterTermin({ wann: tagNach(1), wdh: "eigen", wdhZahl: 3, wdhEinheit: "tag" }), tagNach(4));
  gleich(A.naechsterTermin({ wann: tagNach(1), wdh: "eigen", wdhZahl: 2, wdhEinheit: "woche" }), tagNach(15));
  gleich(A.naechsterTermin({ wann: "2090-01-31", wdh: "eigen", wdhZahl: 1, wdhEinheit: "monat" }), "2090-02-28");
  gleich(A.naechsterTermin({ wann: "2090-05-10", wdh: "eigen", wdhZahl: 5, wdhEinheit: "jahr" }), "2095-05-10");
});
t("Ein längst vergangener Termin rückt bis in die Zukunft nach", () => {
  const n = A.naechsterTermin({ wann: "2020-03-14", wdh: "jaehrlich" });
  wahr(n > A.heute(), "liegt in der Zukunft: " + n);
  gleich(n.slice(5), "03-14", "bleibt am selben Kalendertag");
});
t("Unsinnige Zahlen werden eingefangen", () => {
  gleich(A.wdhZahlOk("0"), 1);
  gleich(A.wdhZahlOk("999"), 99);
  gleich(A.wdhZahlOk("abc"), 1);
  gleich(A.naechsterTermin({ wann: tagNach(1), wdh: "eigen", wdhZahl: 0, wdhEinheit: "tag" }), tagNach(2));
});
t("Der Text sagt, was gemeint ist", () => {
  gleich(A.wdhText({ wdh: "jaehrlich" }), "Jährlich");
  gleich(A.wdhText({ wdh: "eigen", wdhZahl: 1, wdhEinheit: "woche" }), "Jede Woche");
  gleich(A.wdhText({ wdh: "eigen", wdhZahl: 3, wdhEinheit: "monat" }), "Alle 3 Monate");
  gleich(A.wdhText({}), "");
});
t("Ein fester Wochentag gilt auch beim eigenen Wochenrhythmus", () => {
  const n = A.naechsterTermin({ wann: A.heute(), wdh: "eigen", wdhZahl: 2, wdhEinheit: "woche", wdhTag: 2 });
  gleich(A.wochentag(n), 2, "Mittwoch, bekommen " + n);
});

gruppe("Rhythmus beim Anlegen");
t("Wörter im Text werden zum Rhythmus", () => {
  gleich(A.eingabeDeuten("Müll rausbringen wöchentlich").wdh, "woechentlich");
  gleich(A.eingabeDeuten("Zähne jährlich").wdh, "jaehrlich");
  gleich(A.eingabeDeuten("Kontrolle jedes Jahr").wdh, "jaehrlich");
  gleich(A.eingabeDeuten("Blumen alle 3 Tage gießen").wdh, "eigen");
  gleich(A.eingabeDeuten("Blumen alle 3 Tage gießen").wdhZahl, 3);
  gleich(A.eingabeDeuten("Blumen alle 3 Tage gießen").wdhEinheit, "tag");
  gleich(A.eingabeDeuten("Blumen alle 3 Tage gießen").text, "Blumen gießen");
});
t("Runde Zahlen werden zum passenden Namen", () => {
  gleich(A.eingabeDeuten("X alle 1 Woche").wdh, "woechentlich");
  gleich(A.eingabeDeuten("X alle 2 Tage").wdh, "zweitaeglich");
  gleich(A.eingabeDeuten("X alle 1 Jahr").wdh, "jaehrlich");
});
t("„jeden Montag“ setzt Rhythmus und Wochentag und findet den Termin", () => {
  const d = A.eingabeDeuten("Sport jeden Montag");
  gleich(d.wdh, "woechentlich");
  gleich(d.wdhTag, 0);
  gleich(A.wochentag(d.wann), 0, "Termin ist ein Montag");
  gleich(d.text, "Sport");
});
t("Ein Rhythmus ohne Termin beginnt heute", () => {
  frisch();
  const id = A.aufgabeAnlegen("Müll rausbringen wöchentlich");
  gleich(A.S.aufgaben[id].wann, A.heute());
  gleich(A.S.aufgaben[id].wdh, "woechentlich");
});
t("Ist der Rhythmus der ganze Text, bleibt er der Text", () => {
  frisch();
  const id = A.aufgabeAnlegen("Jährlich");
  gleich(A.S.aufgaben[id].t, "Jährlich");
  gleich(A.S.aufgaben[id].wdh, undefined, "nichts wird stillschweigend gedeutet");
});
t("Die Auswahl im Blatt „Schnell eintragen“ wird übernommen", () => {
  frisch();
  const id = A.aufgabeAnlegen("Zahnarzt", A.heute(), null, null, { wdh: "jaehrlich" });
  gleich(A.S.aufgaben[id].wdh, "jaehrlich");
});
t("Mitgeschriebenes schlägt die Auswahl", () => {
  frisch();
  const id = A.aufgabeAnlegen("Rasen mähen alle 2 Wochen", A.heute(), null, null, { wdh: "jaehrlich" });
  gleich(A.S.aufgaben[id].wdh, "eigen");
  gleich(A.S.aufgaben[id].wdhZahl, 2);
  gleich(A.S.aufgaben[id].wdhEinheit, "woche");
});
t("Beim Abhaken entsteht der nächste Termin nach dem eigenen Rhythmus", () => {
  frisch();
  const id = A.aufgabeAnlegen("Rasen mähen alle 2 Wochen");
  A.haken(id);
  const nachfolger = A.aufListe().find(a => !a.fertig && a.t === "Rasen mähen");
  wahr(nachfolger, "es gibt einen Nachfolger");
  gleich(nachfolger.wann, tagNach(14));
  gleich(nachfolger.wdh, "eigen");
});
t("Das Blatt zeigt alle sechs Rhythmen", () => {
  frisch();
  const id = A.aufgabeAnlegen("Etwas");
  A.aufgabeOeffnen(id);
  const html = document.getElementById("sheet").innerHTML;
  ["Täglich", "Alle 2 Tage", "Wöchentlich", "Monatlich", "Jährlich", "Benutzerdefiniert"]
    .forEach(l => wahr(html.indexOf(l) >= 0, l + " angeboten"));
});
t("Benutzerdefiniert bringt eine brauchbare Vorgabe mit", () => {
  frisch();
  const id = A.aufgabeAnlegen("Etwas");
  A.wdhSetzen(id, "eigen");
  gleich(A.S.aufgaben[id].wdhZahl, 3);
  gleich(A.S.aufgaben[id].wdhEinheit, "woche");
  const html = document.getElementById("sheet").innerHTML;
  wahr(/wdhzahl/.test(html), "Zahlenfeld steht im Blatt");
});

bilanz();
