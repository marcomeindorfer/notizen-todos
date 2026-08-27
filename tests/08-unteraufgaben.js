/* Unteraufgaben: Struktur, Abhaken, Löschen, Umhängen - und vor allem die
   Anzeigeregel, dass jede abhakbare Zeile je Abschnitt genau einmal steht. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", name: "" };
  A.queue = []; A.tab = "heute"; A.katFilter = "alle"; A.aufSuche = "";
  A.offeneUnter = {};
  A.wochenVersatz = 0; A.wocheFertig = true;
  Object.keys(elemente).forEach(k => delete elemente[k]);
  document.getElementById("sheet").innerHTML = "";
  meldungen.alert.length = 0;
  netz.calls = [];
}
const tagVor = n => A.iso(new Date(Date.now() - n * 86400000));
const anlegen = (t, felder) => {
  const id = A.aufgabeAnlegen(t);
  Object.assign(A.S.aufgaben[id], felder || {});
  return id;
};
/* Eine Hauptaufgabe mit Punkten, wie sie im Alltag entsteht */
function thema(felder, kinderFelder) {
  const haupt = anlegen("Kinderzimmer streichen", felder);
  const kinder = (kinderFelder || []).map((f, i) => {
    const id = A.aufgabeAnlegen("Schritt " + (i + 1), null, null, haupt);
    Object.assign(A.S.aufgaben[id], f || {});
    return id;
  });
  return { haupt, kinder };
}
const ansicht = tab => { A.tab = tab; A.render(); return document.getElementById("view").innerHTML; };

gruppe("Struktur");
t("Eine Unteraufgabe trägt die Kennung ihrer Hauptaufgabe", () => {
  frisch();
  const { haupt, kinder } = thema({}, [{}, {}]);
  gleich(A.S.aufgaben[kinder[0]].eltern, haupt);
  gleich(A.kinderVon(haupt).map(k => k.id), kinder);
  wahr(A.istUnter(A.S.aufgaben[kinder[0]]), "gilt als Unteraufgabe");
  wahr(!A.istUnter(A.S.aufgaben[haupt]), "die Hauptaufgabe nicht");
});
t("Eine Unteraufgabe kann alles, was eine Hauptaufgabe kann", () => {
  frisch();
  const { kinder } = thema({}, [{}]);
  const k = kinder[0];
  A.verschieben(k, A.heute());
  A.aufAendern(k, { kat: "k_arb", wdh: "woechentlich", notiz: "Details" });
  const u = A.S.aufgaben[k];
  gleich(u.wann, A.heute());
  gleich(u.kat, "k_arb");
  gleich(u.wdh, "woechentlich");
  gleich(u.notiz, "Details");
});
t("Genau eine Ebene: das Kind eines Kindes wird dessen Geschwister", () => {
  frisch();
  const { haupt, kinder } = thema({}, [{}]);
  const enkel = A.aufgabeAnlegen("Noch tiefer", null, null, kinder[0]);
  gleich(A.S.aufgaben[enkel].eltern, haupt);
  gleich(A.kinderVon(kinder[0]).length, 0);
});
t("Zeigt die Kennung ins Leere, gilt der Eintrag wieder als Hauptaufgabe", () => {
  frisch();
  const { haupt, kinder } = thema({}, [{}]);
  delete A.S.aufgaben[haupt];
  wahr(!A.istUnter(A.S.aufgaben[kinder[0]]), "steht wieder für sich");
  gleich(A.gruppen(a => !a.fertig).map(g => g.haupt.id), [kinder[0]]);
});
t("Der Dublettenhinweis gilt je Ebene", () => {
  frisch();
  const haupt = anlegen("Anrufen");
  const zweites = anlegen("Thema");
  const unten = A.aufgabeAnlegen("Anrufen", null, null, zweites);
  wahr(unten && A.S.aufgaben[unten], "die Unteraufgabe entsteht trotzdem");
  wahr(A.S.aufgaben[haupt], "die gleichnamige Hauptaufgabe bleibt");
});

gruppe("Anzeige: jede Zeile genau einmal");
t("Steht die Hauptaufgabe selbst an, ist sie die Zeile", () => {
  frisch();
  const { haupt } = thema({ wann: A.heute() }, [{}, {}]);
  const { faellig, faelligFlach } = A.topfHeute();
  gleich(faellig.length, 1);
  gleich(faellig[0].haupt.id, haupt);
  wahr(faellig[0].eigen, "mit eigener Zeile");
  gleich(faelligFlach.map(a => a.id), [haupt]);
});
t("Steht nur eine Unteraufgabe an, kommt die Hauptaufgabe als Kopfzeile mit", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: null }, [{ wann: A.heute() }, {}]);
  const { faellig, faelligFlach } = A.topfHeute();
  gleich(faellig.length, 1);
  gleich(faellig[0].haupt.id, haupt);
  wahr(!faellig[0].eigen, "die Hauptaufgabe ist nur der Zusammenhang");
  gleich(faellig[0].treffer.map(a => a.id), [kinder[0]]);
  gleich(faelligFlach.map(a => a.id), [kinder[0]], "gezählt wird die Unteraufgabe");
});
t("Beides zugleich gibt es nicht - die eigene Zeile schlägt die Kopfzeile", () => {
  frisch();
  const { haupt } = thema({ wann: A.heute() }, [{ wann: A.heute() }]);
  const { faellig } = A.topfHeute();
  gleich(faellig.length, 1, "nur ein Eintrag");
  wahr(faellig[0].eigen, "die Hauptaufgabe steht mit eigener Zeile da");
  gleich(faellig[0].treffer.length, 0);
});
t("Eine Unteraufgabe ohne eigenen Termin taucht nirgends allein auf", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute() }, [{}]);
  const html = ansicht("heute");
  wahr(html.includes(">Kinderzimmer streichen"), "das Thema steht da");
  wahr(!html.includes("data-dnd=\"" + kinder[0] + "\""), "der Punkt hat keine eigene Zeile");
});
t("Aufgeklappt stehen die Punkte unter der Zeile", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute() }, [{}, {}]);
  A.offeneUnter[haupt] = true;
  const html = ansicht("heute");
  wahr(html.includes("data-dnd=\"" + kinder[0] + "\""), "erster Punkt sichtbar");
  wahr(html.includes("data-dnd=\"" + kinder[1] + "\""), "zweiter Punkt sichtbar");
  wahr(html.includes("ubox_" + haupt), "eigener Kasten zum Umsortieren");
});
t("Der Fortschritt steht in der Zeile", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute() }, [{}, {}, {}]);
  A.haken(kinder[0]);
  const zeile = A.aufZeile({ id: haupt, ...A.S.aufgaben[haupt] }, {});
  wahr(zeile.includes(">1/3"), "1 von 3 erledigt");
  wahr(zeile.includes("unterKlappen('" + haupt + "')"), "und ist der Schalter");
});
t("In der Woche steht ein Thema an jedem Tag, an dem etwas davon ansteht", () => {
  frisch();
  const tage = A.wochenTage(0);
  const { haupt, kinder } = thema({ wann: tage[0] }, [{ wann: tage[2] }]);
  const amMontag = A.gruppen(a => a.wann === tage[0] && !a.fertig);
  const amMittwoch = A.gruppen(a => a.wann === tage[2] && !a.fertig);
  wahr(amMontag.length === 1 && amMontag[0].eigen, "Montag die Hauptaufgabe selbst");
  wahr(amMittwoch.length === 1 && !amMittwoch[0].eigen, "Mittwoch als Kopfzeile");
  gleich(amMittwoch[0].treffer.map(a => a.id), [kinder[0]]);
});
t("In den Listen erbt ein Punkt ohne eigene Liste die der Hauptaufgabe", () => {
  frisch();
  const { haupt, kinder } = thema({ kat: "k_geb", wann: null }, [{}]);
  gleich(A.listeVon(A.S.aufgaben[kinder[0]]), "k_geb");
  const html = ansicht("listen");
  wahr(!/Ohne Liste/.test(html), "nichts landet unter „Ohne Liste“");
});
t("Steht eine Unteraufgabe für sich, nennt sie ihr Thema", () => {
  frisch();
  const { kinder } = thema({ wann: null }, [{ wann: tagVor(3) }]);
  const zeile = A.aufZeile({ id: kinder[0], ...A.S.aufgaben[kinder[0]] }, { datum: true });
  wahr(zeile.includes("↳ Kinderzimmer streichen"), "Zusammenhang steht an der Zeile");
  const ohne = A.aufZeile({ id: kinder[0], ...A.S.aufgaben[kinder[0]] }, { ohneEltern: true });
  wahr(!ohne.includes("↳ Kinderzimmer"), "unter einer Kopfzeile nicht doppelt");
});

gruppe("Abhaken");
t("Wer das Thema abhakt, hakt seine Punkte mit ab", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute() }, [{}, {}]);
  A.haken(haupt);
  wahr(A.S.aufgaben[haupt].fertig, "Thema erledigt");
  kinder.forEach(k => wahr(A.S.aufgaben[k].fertig, "Punkt erledigt"));
});
t("Rückgängig holt Thema und Punkte zurück", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute() }, [{}, {}]);
  A.haken(haupt);
  A.hinweisAktion();
  wahr(!A.S.aufgaben[haupt].fertig, "Thema wieder offen");
  kinder.forEach(k => wahr(!A.S.aufgaben[k].fertig, "Punkt wieder offen"));
});
t("Der letzte Punkt hakt das Thema nicht von selbst ab", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute() }, [{}]);
  A.haken(kinder[0]);
  wahr(!A.S.aufgaben[haupt].fertig, "das Thema bleibt offen");
  const html = document.getElementById("view").innerHTML;
  wahr(/Alle Unteraufgaben/.test(html), "aber die App sagt Bescheid");
});
t("Eine Wiederholung nimmt ihre Punkte mit", () => {
  frisch();
  const { haupt, kinder } = thema({ wann: A.heute(), wdh: "woechentlich" }, [{}, {}]);
  A.haken(haupt);
  const nachfolger = A.aufListe().find(a => !a.fertig && !a.eltern && a.id !== haupt);
  wahr(nachfolger, "es gibt einen Nachfolger");
  const neueKinder = A.kinderVon(nachfolger.id);
  gleich(neueKinder.length, 2);
  neueKinder.forEach(k => wahr(!k.fertig, "die Punkte stehen wieder offen da"));
});

gruppe("Löschen und Umhängen");
t("Mit dem Thema gehen seine Punkte, und mit ihm kommen sie zurück", () => {
  frisch();
  const { haupt, kinder } = thema({}, [{}, {}]);
  A.aufgabeLoeschen(haupt);
  gleich(Object.keys(A.S.aufgaben).length, 0, "nichts bleibt als Waise");
  A.hinweisAktion();
  gleich(Object.keys(A.S.aufgaben).length, 3, "alles ist wieder da");
  gleich(A.kinderVon(haupt).map(k => k.id), kinder);
});
t("Ein Punkt lässt sich herauslösen", () => {
  frisch();
  const { kinder } = thema({}, [{}]);
  A.herausloesen(kinder[0]);
  wahr(!A.S.aufgaben[kinder[0]].eltern, "steht für sich");
  A.hinweisAktion();
  wahr(A.S.aufgaben[kinder[0]].eltern, "und hängt nach der Rücknahme wieder");
});
t("Eine bestehende Aufgabe lässt sich unterordnen", () => {
  frisch();
  const haupt = anlegen("Großes Thema");
  const einzeln = anlegen("Bisher allein");
  A.unterordnen(einzeln, haupt);
  gleich(A.S.aufgaben[einzeln].eltern, haupt);
  gleich(A.kinderVon(haupt).map(k => k.id), [einzeln]);
});
t("Wer selbst Punkte hat, wird kein Punkt", () => {
  frisch();
  const { haupt } = thema({}, [{}]);
  const anderes = anlegen("Anderes Thema");
  A.unterordnen(haupt, anderes);
  wahr(!A.S.aufgaben[haupt].eltern, "bleibt Hauptaufgabe");
});
t("Duplizieren nimmt die Punkte mit", () => {
  frisch();
  const { haupt } = thema({}, [{}, {}]);
  A.verdoppeln(haupt);
  const themen = A.aufListe().filter(a => !a.eltern);
  gleich(themen.length, 2);
  const kopie = themen.find(x => x.id !== haupt);
  gleich(A.kinderVon(kopie.id).length, 2);
});

gruppe("Blatt");
t("Das Blatt der Hauptaufgabe zeigt Fortschritt, Liste und Eingabefeld", () => {
  frisch();
  const { haupt, kinder } = thema({}, [{}, {}]);
  A.haken(kinder[0]);
  A.aufgabeOeffnen(haupt);
  const html = document.getElementById("sheet").innerHTML;
  wahr(/1 von 2 erledigt/.test(html), "Fortschritt in Worten");
  wahr(html.includes("sbox_" + haupt), "Liste zum Umsortieren");
  wahr(html.includes("usheet_" + haupt), "Feld zum Anlegen");
  wahr(html.includes("unterLoeschen('" + haupt + "'"), "Punkt einzeln löschbar");
});
t("Das Blatt einer Unteraufgabe führt zurück zum Thema", () => {
  frisch();
  const { haupt, kinder } = thema({}, [{}]);
  A.aufgabeOeffnen(kinder[0]);
  const html = document.getElementById("sheet").innerHTML;
  wahr(/Unteraufgabe/.test(html), "als Unteraufgabe überschrieben");
  wahr(html.includes("aufgabeOeffnen('" + haupt + "')"), "Sprung zum Thema");
  wahr(html.includes("herausloesen('" + kinder[0] + "')"), "Herauslösen angeboten");
  wahr(!html.includes("usheet_" + kinder[0]), "keine zweite Ebene angeboten");
});

bilanz();
