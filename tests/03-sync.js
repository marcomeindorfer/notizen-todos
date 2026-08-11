/* Abgleich: Warteschlange, Zusammenführen, zwei Geräte. */
load("tests/harness.js");

function frisch() {
  netz.failing = false; netz.failNth = null; netz.status = null;
  drainMicrotasks();
  A.S = A.leer();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24) };
  A.queue = []; A.syncState = "lokal";
  netz.calls = []; netz.n = 0;
}

gruppe("Adressen");
t("Adressen zeigen unter /haushalte/<code>", () => {
  frisch();
  gleich(A.adresse("aufgaben"), "https://test.example/haushalte/" + "h".repeat(24) + "/aufgaben.json");
  gleich(A.adresse(""), "https://test.example/haushalte/" + "h".repeat(24) + ".json");
});
t("Kennungen enthalten keine für Firebase verbotenen Zeichen", () => {
  frisch();
  const ids = [];
  for (let i = 0; i < 50; i++) ids.push("a" + A.id6());
  gleich(ids.filter(x => /[./$#[\]]/.test(x)), []);
});

gruppe("Warteschlange");
t("Fehlgeschlagene Schreibvorgänge gehen in die Warteschlange", () => {
  frisch();
  netz.failing = true;
  A.senden("aufgaben/a1", { t: "A" });
  A.senden("aufgaben/a2", { t: "B" });
  drainMicrotasks();
  gleich(A.queue.length, 2);
});
t("Ein Fehler mitten im Nachsenden verliert die restlichen Einträge nicht", () => {
  frisch();
  A.queue = [{ pfad: "aufgaben/a1", wert: 1 }, { pfad: "aufgaben/a2", wert: 2 }, { pfad: "aufgaben/a3", wert: 3 }];
  netz.failNth = 1;
  A.flush();
  drainMicrotasks();
  gleich(A.queue.length, 3, "alle drei bleiben erhalten");
  gleich(A.queue.map(q => q.pfad), ["aufgaben/a1", "aufgaben/a2", "aufgaben/a3"], "Reihenfolge bleibt");
});
t("Wiederholtes Schreiben auf denselben Pfad staut sich nicht auf", () => {
  frisch();
  netz.failing = true;
  for (let i = 0; i < 60; i++) A.senden("notizen/n1", { titel: "Stand " + i });
  drainMicrotasks();
  gleich(A.queue.length, 1, "nur der jüngste Stand");
  gleich(A.queue[0].wert.titel, "Stand 59");
});
t("Erfolgreiches Nachsenden leert die Warteschlange", () => {
  frisch();
  A.queue = [{ pfad: "aufgaben/a1", wert: 1 }, { pfad: "aufgaben/a2", wert: 2 }];
  A.flush();
  drainMicrotasks();
  gleich(A.queue.length, 0);
});
t("Ohne eingerichteten Haushalt wird nichts gesendet", () => {
  frisch();
  A.cfg = { db: "", hid: "" };
  netz.calls = [];
  A.senden("aufgaben/a1", 1);
  drainMicrotasks();
  gleich(netz.calls.length, 0);
});
t("Verweigert die Datenbank den Zugriff, hört die App auf zu senden", () => {
  frisch();
  netz.status = 403;
  A.senden("aufgaben/a1", 1);
  drainMicrotasks();
  gleich(A.syncState, "verweigert");
  const vorher = netz.calls.length;
  A.flush(); drainMicrotasks();
  gleich(netz.calls.length, vorher, "kein blinder weiterer Versuch");
  gleich(A.queue.length, 1, "die Änderung bleibt erhalten");
});
t("Nach einem vorübergehenden Serverfehler wird weiter versucht", () => {
  frisch();
  netz.status = 500;
  A.senden("aufgaben/a1", 1);
  drainMicrotasks();
  wahr(A.syncState !== "verweigert", "kein Dauerfehler");
  netz.status = null;
  A.flush(); drainMicrotasks();
  gleich(A.queue.length, 0, "geht nach der Erholung raus");
});

gruppe("Zusammenführen");
t("Einträge, die es nur auf einer Seite gibt, bleiben erhalten", () => {
  frisch();
  A.S.aufgaben = { a1: { t: "Lokal", erstellt: 1700000000000 } };
  A.zusammenfuehren({ aufgaben: { a2: { t: "Fern", erstellt: 1700000000000 } } });
  wahr(A.S.aufgaben.a1 && A.S.aufgaben.a2, "beide da");
});
t("Bei gleicher Kennung gewinnt der jüngere Stand", () => {
  frisch();
  A.S.notizen = { n1: { titel: "Lokal neu", geaendert: 2000000000000 } };
  A.zusammenfuehren({ notizen: { n1: { titel: "Fern alt", geaendert: 1000000000000 } } });
  gleich(A.S.notizen.n1.titel, "Lokal neu");
  A.S.notizen = { n1: { titel: "Lokal alt", geaendert: 1000000000000 } };
  A.zusammenfuehren({ notizen: { n1: { titel: "Fern neu", geaendert: 2000000000000 } } });
  gleich(A.S.notizen.n1.titel, "Fern neu");
});
t("Ein Zurücknehmen des Hakens überlebt den Abgleich", () => {
  frisch();
  /* Gerät A hakt ab, Gerät B nimmt später zurück. B darf nicht verlieren,
     nur weil die abgehakte Fassung ein „fertig" trägt. */
  const abgehakt = { t: "Müll", erstellt: 1700000000000, fertig: 1700000900000 };
  A.S.aufgaben = { a1: { t: "Müll", erstellt: 1700000000000, ts: 1700001000000 } };
  A.zusammenfuehren({ aufgaben: { a1: abgehakt } });
  wahr(!A.S.aufgaben.a1.fertig, "bleibt offen");
});
t("Ein Anheften überlebt den Abgleich", () => {
  frisch();
  A.S.notizen = { n1: { titel: "N", erstellt: 1700000000000, geaendert: 1700000000000, oben: true, ts: 1700009000000 } };
  A.zusammenfuehren({ notizen: { n1: { titel: "N", erstellt: 1700000000000, geaendert: 1700005000000 } } });
  gleich(A.S.notizen.n1.oben, true);
});
t("Ein leerer Fernstand löscht nichts", () => {
  frisch();
  A.S.aufgaben = { a1: { t: "Bleibt", erstellt: 1700000000000 } };
  A.S.notizen = { n1: { titel: "Bleibt", erstellt: 1700000000000 } };
  A.zusammenfuehren({});
  wahr(A.S.aufgaben.a1 && A.S.notizen.n1, "beides bleibt");
});
t("Listen werden mitgeführt", () => {
  frisch();
  A.zusammenfuehren({ kategorien: { k_neu: { n: "Neue Liste", f: "#4A2D6E", art: "beides", pos: 9 } } });
  wahr(A.S.kategorien.k_neu, "neue Liste kam an");
  wahr(A.S.kategorien.k_all, "Startlisten bleiben");
});
t("Einstellungen des eigenen Geräts haben Vorrang", () => {
  frisch();
  A.S.einst = { notizSort: "eigen" };
  A.zusammenfuehren({ einst: { notizSort: "geaendert" } });
  gleich(A.S.einst.notizSort, "eigen");
});
t("Bei gleichem Stand wird nicht unnötig hochgeladen", () => {
  frisch();
  A.S.aufgaben = { a1: { t: "Gleich", erstellt: 1700000000000 } };
  netz.calls = [];
  A.zusammenfuehren({ aufgaben: { a1: { t: "Gleich", erstellt: 1700000000000 } }, notizen: {}, kategorien: A.S.kategorien });
  drainMicrotasks();
  const wurzel = netz.calls.filter(c => /haushalte\/h+\.json$/.test(c.url));
  gleich(wurzel.length, 0);
});

gruppe("Zwei Geräte");
t("Eine angelegte Aufgabe wird übertragen", () => {
  frisch();
  const id = A.aufgabeAnlegen("Kinderwagen abholen morgen");
  drainMicrotasks();
  const gesendet = netz.calls.find(c => c.url.includes("/aufgaben/" + id));
  wahr(gesendet && gesendet.method === "PUT", "wurde übertragen");
  gleich(JSON.parse(gesendet.body).t, "Kinderwagen abholen");
});
t("Ein Teilpfad-Ereignis der Gegenseite wird eingespielt", () => {
  frisch();
  A.verbinden();
  letzteQuelle().feuern("put", { path: "/aufgaben/a9", data: { t: "Von drüben", erstellt: 1700000000000 } });
  gleich(A.S.aufgaben.a9.t, "Von drüben");
});
t("Ein Löschereignis entfernt den Eintrag", () => {
  frisch();
  A.S.aufgaben = { a9: { t: "Weg", erstellt: 1700000000000 } };
  A.verbinden();
  letzteQuelle().feuern("put", { path: "/aufgaben/a9", data: null });
  wahr(!A.S.aufgaben.a9);
});
t("Unsinnige Daten aus der Leitung legen die App nicht lahm", () => {
  frisch();
  A.verbinden();
  const q = letzteQuelle();
  (q.hoerer.put || []).forEach(f => f({ data: "{kein json" }));
  (q.hoerer.patch || []).forEach(f => f({ data: "auch kaputt" }));
  wahr(true, "kein Absturz");
});
t("Der erste vollständige Stand wird zusammengeführt, nicht übernommen", () => {
  frisch();
  A.S.aufgaben = { lokal: { t: "Nur hier", erstellt: 1700000000000 } };
  A.verbinden();
  letzteQuelle().feuern("put", { path: "/", data: { aufgaben: { fern: { t: "Nur dort", erstellt: 1700000000000 } } } });
  wahr(A.S.aufgaben.lokal && A.S.aufgaben.fern, "beide Seiten vereint");
});

bilanz();
