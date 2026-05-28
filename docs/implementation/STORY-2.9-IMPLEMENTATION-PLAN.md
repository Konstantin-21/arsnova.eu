<!-- markdownlint-disable MD013 -->

# Story 2.9 - Implementierungsplan: Asynchrone Quiz-Modi und Feedback-Strategien

**Epic 2 - Live-Sitzung & Lobby**  
**Ziel:** arsnova.eu ergaenzt den bestehenden host-gesteuerten Live-Quiz-Flow um zwei asynchrone Pacing-Modi, ohne eine zweite Quiz-Infrastruktur aufzubauen. Der Performance-Impact muss minimal bleiben; bestehende Vote-, Scorecard-, Leaderboard-, Bonus- und Exportpfade werden wiederverwendet.

**Backlog-Bezug:** `Story 2.9 Asynchrone Quiz-Modi und Feedback-Strategien` in [`../../Backlog.md`](../../Backlog.md)  
**Architekturbezug:** `ADR-0013`, `ADR-0014`, `ADR-0019`, `ADR-0025`, bestehende Data-Stripping-Regel aus Story 2.4  
**Status:** Planungsdokument / vor Implementierung

---

## Zielbild

Lehrpersonen koennen beim Start einer Quiz-Instanz einen Pacing-Modus waehlen:

1. **Synchron (host-gesteuert):** bestehender Ablauf ohne Regression.
2. **Asynchron manuell (Self-Paced):** Teilnehmende bearbeiten Frage fuer Frage im eigenen Tempo.
3. **Asynchron zeitgesteuert (timeboxed):** Teilnehmende bearbeiten Frage fuer Frage im eigenen Tempo, aber jede Frage hat ein eigenes Zeitfenster.

Fuer asynchrone Modi wird zusaetzlich festgelegt:

- **Sofortiges Feedback:** eigene Korrektheit, Punkte und Aufloesung nach jeder Frage.
- **Verzoegertes Feedback:** nur Eingangsbestaetigung pro Frage, fachliche Rueckmeldung erst nach Quizabschluss.

Die Host-/Presenter-Ansicht zeigt bei asynchronen Sessions ein Live-Dashboard mit aggregiertem Fortschritt pro Frage. Einzelantworten oder personenbezogene Verlaufsdaten werden nicht oeffentlich sichtbar.

---

## Harte Leitplanken

1. **Kein zweiter Quiz-Stack.** Keine neue Async-App, keine neue Route, kein paralleles Vote-Modell.
2. **Bestehende Votes bleiben Quelle der Wahrheit.** Antworten, Timeouts, Score, Leaderboard, Bonuscodes und Exporte laufen ueber `Vote`, `VoteAnswer`, bestehende Scoring-Helfer und vorhandene Ergebnislogik.
3. **Redis nur fuer transienten Fortschritt.** Teilnehmendenfortschritt, aktuelle Async-Frage und per-Participant-Frage-Startzeit werden kurzlebig in Redis gehalten; keine langlebige `AsyncProgress`-Tabelle im ersten Schritt.
4. **Keine neue Library.** Keine State-Machine-, Chart- oder Dashboard-Bibliothek. UI nutzt Angular Signals, bestehende Komponenten und einfache CSS/HTML-Strukturen.
5. **Keine breite Komponenten-Aufblaehung.** Bestehende `session-vote`, `session-host` und `session-present` werden gezielt erweitert; neue Dateien nur fuer klar geteilte Typ-/Helperlogik.
6. **Performance zuerst.** Keine Vollaggregation aller Votes pro Polling-Tick. Dashboard-Daten werden gecacht, gebatcht oder ueber kleine Redis-/SQL-Aggregate berechnet.
7. **Data-Stripping bleibt unverhandelbar.** Loesungen und `isCorrect` duerfen in verzoegertem Feedback nicht vor Abschluss an Teilnehmende gelangen.

---

## Wiederverwendung bestehender Funktionalitaet

| Bedarf        | Wiederverwenden                                                                                         | Erweiterung                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Antwortabgabe | `vote.submit`, `SubmitVoteInputSchema`, `Vote`, `VoteAnswer`                                            | Async-Modus erlaubt beliebige Frage statt nur `Session.currentQuestion`; Timeout als servervalidierter Nullpunkt-Vote |
| Bewertung     | `calculateVoteScore`, `evaluateShortAnswer`, `evaluateNumericAnswer`, `selectEffectiveCompetitionVotes` | Gemeinsame Helper fuer Scorecard/Review extrahieren, keine zweite Scoring-Engine                                      |
| Timings       | `resolveEffectiveQuestionTimer`, serverzeitbasierte Countdown-Logik                                     | Per-Participant-Frage-Startzeit in Redis statt globalem `statusChangedAt`                                             |
| Feedback      | `QuestionStudentDTO`, `QuestionRevealedDTO`, `PersonalScorecardDTO`                                     | Batched Async-Review fuer Abschluss; Scorecard-Endpunkt kontrolliert fuer Async freigeben                             |
| Leaderboard   | bestehende Ranking- und Team-Leaderboard-Logik                                                          | Timeouts als 0-Punkte-Votes einschliessen                                                                             |
| Bonuscodes    | `generateBonusTokens`, `getPersonalResult`                                                              | Session-Ende unveraendert nutzen; Async-Completion loest nicht automatisch Bonusgenerierung aus                       |
| Export        | `session.getExportData`, `SessionExportDTO`                                                             | Pacing-/Feedback-Metadaten und Timeout-/Completion-Aggregate ergaenzen                                                |
| Live-Updates  | bestehende tRPC Subscriptions/EventEmitter-Pattern                                                      | schmale Async-Dashboard-Subscription mit gecachtem Payload                                                            |
| UI            | `session-vote`, `session-host`, `session-present`, bestehende Antwort-Controls                          | Async-Zustandszweig innerhalb derselben Komponenten                                                                   |

---

## Nicht-Ziele

- Kein langfristiger Hausaufgabenmodus mit mehrtaegiger Retention.
- Keine Benutzerkonten, keine neuen Rollen und keine Redaktionsverwaltung.
- Keine parallele Persistenz einzelner Fortschrittsschritte in PostgreSQL.
- Keine personenbezogene Host-Heatmap.
- Keine neue Presenter-Route.
- Keine Ueberarbeitung aller Quiz-Einstellungen ausserhalb der fuer 2.9 noetigen Felder.
- Keine perfekte Offline-Fortsetzung. Bei Serverneustart bleiben gespeicherte Votes erhalten; transienter Async-Fortschritt darf aus Votes rekonstruiert werden.

---

## Daten- und Vertragsmodell

### Minimaler Prisma-Zuschnitt

Neue Felder, bevorzugt als Strings mit Zod-Enums validiert, um Prisma-Enum-Migrationen und Folgekosten gering zu halten:

| Modell    | Feld                                        | Zweck                                               |
| --------- | ------------------------------------------- | --------------------------------------------------- |
| `Quiz`    | `pacingMode String @default("SYNCHRONOUS")` | Default fuer neue Sessions aus diesem Quiz          |
| `Quiz`    | `asyncFeedbackMode String?`                 | `IMMEDIATE` oder `DELAYED`, nur fuer async relevant |
| `Session` | `pacingMode String @default("SYNCHRONOUS")` | tatsaechlicher Modus der gestarteten Instanz        |
| `Session` | `asyncFeedbackMode String?`                 | Snapshot fuer laufende Instanz                      |

Keine neue Tabelle fuer Fortschritt. Beantwortete und abgeschlossene Fragen werden aus `Vote` abgeleitet.

### Shared Types

In `libs/shared-types/src/schemas.ts`:

- `QuizPacingModeEnum = z.enum(["SYNCHRONOUS", "ASYNC_MANUAL", "ASYNC_TIMEBOXED"])`
- `AsyncFeedbackModeEnum = z.enum(["IMMEDIATE", "DELAYED"])`
- Erweiterung von Quiz-Upload-, Import-/Export-, Session-Create-, Session-Info- und Export-DTOs.
- Validierung: `asyncFeedbackMode` ist nur bei async Modi gueltig; bei `SYNCHRONOUS` wird es auf `null` normalisiert.

### Redis-Schluessel

Kleiner Helper in `apps/backend/src/lib/asyncQuizProgress.ts`:

```text
async-quiz:participant:{sessionId}:{participantId}
  currentQuestionIndex
  questionStartedAt
  completedAt?

async-quiz:dashboard:{sessionId}
  optional gecachter Summary-Snapshot mit kurzer TTL
```

TTL an Session-Cleanup-Fenster koppeln, z. B. 24h plus kleiner Puffer. Votes bleiben davon unabhaengig in PostgreSQL.

---

## Backend-Strategie

### Session-Status

Asynchrone Quiz-Sessions laufen global als `ACTIVE` mit `currentQuestion = null`.

Gruende:

- `vote.submit` kann bereits Fragen zulassen, wenn `currentQuestion` nicht numerisch ist.
- Es braucht keinen neuen `SessionStatus`.
- Bestehende Session-Lifecycle- und Cleanup-Logik bleibt nutzbar.
- Der Host steuert nicht pro Frage, sondern sieht Dashboard und beendet die Session.

Synchroner Flow bleibt unveraendert.

### Neue oder erweiterte Endpunkte

| Endpunkt                                                       | Typ                     | Zweck                                                                                                    |
| -------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `session.startAsyncQuiz` oder Erweiterung von `session.create` | Host-Mutation           | Session mit `pacingMode != SYNCHRONOUS` direkt in `ACTIVE/currentQuestion=null` starten                  |
| `session.getAsyncParticipantState`                             | Public Query            | naechste/offene Frage, beantwortete Anzahl, Completion-Status, erlaubtes Feedback                        |
| `session.getAsyncQuestion`                                     | Public Query            | liefert `QuestionStudentDTO` oder kontrolliert `QuestionRevealedDTO` fuer genau eine teilnehmende Person |
| `session.advanceAsyncQuestion`                                 | Public Mutation         | setzt transienten Redis-Fortschritt auf naechste Frage, ohne DB-Schreiblast                              |
| `vote.submit` erweitert                                        | Public Mutation         | akzeptiert async Frage, wenn Session async und Frage zum Quiz gehoert                                    |
| `vote.submit` oder `vote.recordTimeout`                        | Public Mutation         | erzeugt servervalidierten 0-Punkte-Vote bei timeboxed Timeout                                            |
| `session.getAsyncPersonalReview`                               | Public Query            | batched Abschlussrueckmeldung statt N Scorecard-Roundtrips                                               |
| `session.getAsyncDashboard`                                    | Host Query/Subscription | aggregierter Fortschritt pro Frage fuer Host/Presenter                                                   |

Wenn moeglich wird `vote.submit` nur erweitert statt ein zweiter Vote-Endpunkt eingefuehrt. Ein separater `recordTimeout` ist nur vertretbar, wenn die Timeout-Validierung dadurch klarer und sicherer bleibt.

### Timeout als 0-Punkte-Vote

Timeouts werden als `Vote` ohne Antwortauswahl und mit `score = 0` gespeichert:

- nutzt den bestehenden Unique-Constraint `sessionId_participantId_questionId_round`
- verhindert spaetere Doppelabgabe
- fliesst automatisch in Export, Completion und Scorecard ein
- vermeidet neue Tabellen und Sonderpfade

Die normale manuelle Antwortvalidierung bleibt streng. Ein leerer SC/MC-Vote ist nur erlaubt, wenn:

1. Session `ASYNC_TIMEBOXED` ist,
2. Redis-Frage-Startzeit existiert,
3. effektive Deadline serverseitig abgelaufen ist,
4. noch kein Vote fuer diese Frage existiert.

### Dashboard-Aggregation

Ziel: maximal kleine, seltene Berechnung.

Empfohlene Berechnung:

1. Teilnehmerzahl aus `Session._count.participants` oder bestehender Presence-Helfer.
2. Vote-Aggregate per `groupBy(questionId)` fuer beantwortet/timeout.
3. Optional Korrektheit aus `score > 0` fuer scored types, nur aggregiert.
4. Redis-Fortschritt fuer "begonnen" und "aktuell bei Frage X" nur best effort.
5. Summary-Cache mit kurzer TTL (z. B. 1000-2000 ms) und Invalidierung bei Vote/Timeout/Advance.

Keine Dashboard-Abfrage darf pro Frage und pro Teilnehmendem eigene SQL-Queries ausloesen.

---

## Frontend-Strategie

### Session-Start / Quiz-Konfiguration

Betroffene Stellen:

- `quiz-edit` fuer Defaultwerte, falls Quiz-spezifisch konfigurierbar
- Session-Startdialog / Startlogik in Quiz-Liste, Preview und Host
- `QuizStoreService` Import/Export-Normalisierung

UI-Regel:

- Sync bleibt Default.
- Async-Modi werden als bewusst gewaehlt dargestellt.
- Feedback-Strategie erscheint nur bei Async.
- Nicht unterstuetzte Kombinationen werden im Startdialog deaktiviert, nicht erst im Live-Flow.

### Teilnehmendenansicht

Betroffene Primaerdateien:

- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`

Vorgehen:

- bestehende Antwortcontrols fuer SC/MC/Short Text/Freetext/Rating weiterverwenden
- `currentQuestion` weiterhin als Rendergrundlage nutzen
- neue Computeds fuer `isAsyncQuiz`, `asyncFeedbackMode`, `asyncProgress`
- manuelle Navigation als kleiner Zweig um bestehende `submitVote()`-Logik
- timeboxed Countdown auf bestehender Countdown-Anzeige aufbauen, aber mit per-Participant-`activeAt`
- Abschlussreview als eigener Abschnitt innerhalb der bestehenden Finished-/Scorecard-UI

Keine neue `AsyncVoteComponent`, solange die bestehende Komponente mit klaren Computeds beherrschbar bleibt. Wenn Komplexitaet steigt, nur kleine presentational components extrahieren, keine neue Feature-Domaene.

### Host- und Presenter-Dashboard

Betroffene Primaerdateien:

- `apps/frontend/src/app/features/session/session-host/session-host.component.*`
- `apps/frontend/src/app/features/session/session-present/session-present.component.*`

Vorgehen:

- bei async Quiz statt Frage-Steuerbuttons ein Dashboard anzeigen
- vorhandene Karten-/Balkenstile aus Ergebnisvisualisierung wiederverwenden
- keine neue Chart-Bibliothek
- Dashboard-Snapshot 1-2x pro Sekunde maximal aktualisieren oder subscription-getrieben nach Cache-Invalidierung
- Korrektheitsdarstellung nur aggregiert und mit Beamer-Schutz

---

## Implementierungsphasen

## Phase 1: Vertrag und Defaults

Ziel: Modus kann beschrieben werden, ohne bestehendes Verhalten zu aendern.

| #   | Task                         | Beschreibung                                                            |
| --- | ---------------------------- | ----------------------------------------------------------------------- |
| 1.1 | Zod-Enums ergaenzen          | `QuizPacingModeEnum`, `AsyncFeedbackModeEnum`, Validierungshelper       |
| 1.2 | Prisma-Felder ergaenzen      | Vier String-Felder auf `Quiz`/`Session`, Defaults fuer Sync             |
| 1.3 | Upload/Create DTOs erweitern | `quiz.upload`, `session.create`, `SessionInfoDTO`                       |
| 1.4 | Import/Export normalisieren  | alte Quiz-JSONs auf Sync defaulten, async Kombinationen validieren      |
| 1.5 | Tests fuer Defaults          | Schema-Tests und Importnormalizer-Tests fuer fehlende/ungueltige Felder |

Akzeptanz fuer Phase 1:

- bestehende Tests laufen ohne UI-Aenderung
- ein bestehendes Quiz startet weiterhin synchron
- kein neuer Runtime-Pfad fuer Async ist aktiv

## Phase 2: Async-Session-Start und Backend-Progress

Ziel: Async-Session kann gestartet werden und liefert teilnehmerbezogenen Zustand.

| #   | Task                        | Beschreibung                                                                                   |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| 2.1 | `session.create` verzweigen | Bei Async: `status=ACTIVE`, `currentQuestion=null`, `pacingMode`/`asyncFeedbackMode` speichern |
| 2.2 | Redis-Helper bauen          | `get/set/clear` fuer per-Participant-Progress, TTL, best-effort Fehlerbehandlung               |
| 2.3 | Async-State-Endpunkt        | naechste unbeantwortete Frage aus Votes ableiten, Redis-Fortschritt nur als Beschleunigung     |
| 2.4 | Async-Question-Endpunkt     | `QuestionStudentDTO` fuer offene Frage; bei erlaubtem Feedback `QuestionRevealedDTO`           |
| 2.5 | Unit-/Routertests           | Startmodus, State-Rekonstruktion aus Votes, Data-Stripping bei delayed feedback                |

Performance-Vorgabe:

- State-Endpunkt nutzt maximal eine Query fuer Session+Quizfragen und eine Query fuer eigene Votes.
- Kein Join ueber alle Teilnehmer fuer einzelne Teilnehmendenabfragen.

## Phase 3: Vote- und Timeout-Pfad

Ziel: vorhandener Vote-Pfad traegt Async ohne zweite Scoring-Engine.

| #   | Task                              | Beschreibung                                                                         |
| --- | --------------------------------- | ------------------------------------------------------------------------------------ |
| 3.1 | `vote.submit` async-faehig machen | Frage muss zum Session-Quiz gehoeren; `currentQuestion`-Gate nur fuer Sync erzwingen |
| 3.2 | Per-Participant-Timer pruefen     | Timeboxed nutzt Redis-`questionStartedAt` und `resolveEffectiveQuestionTimer`        |
| 3.3 | Timeout-Vote                      | servervalidierter 0-Punkte-Vote, idempotent ueber bestehenden Unique-Constraint      |
| 3.4 | Cache invalidieren                | bestehende Vote-Cache-Invalidierung plus Async-Dashboard-Invalidierung               |
| 3.5 | Tests                             | Antwort in Async manual, zu spaete Antwort, Timeout, Doppelabgabe, falsche Quizfrage |

Performance-Vorgabe:

- Pro Vote keine neue Vollaggregation.
- Timeout nutzt denselben Schreibpfad wie Vote oder eine kleine gemeinsame Helper-Funktion.
- Keine synchronen Dashboard-Neuberechnungen im Vote-Hotpath; nur Cache/Event invalidieren.

## Phase 4: Teilnehmenden-UI

Ziel: Async Quiz ist fuer Teilnehmende nutzbar, ohne bestehende Vote-UI zu duplizieren.

| #   | Task                  | Beschreibung                                                                                |
| --- | --------------------- | ------------------------------------------------------------------------------------------- |
| 4.1 | SessionInfo auswerten | `pacingMode`/`asyncFeedbackMode` in `session-vote` aufnehmen                                |
| 4.2 | Async-Frage laden     | statt globaler Current-Question-Subscription gezielt `getAsyncQuestion` nutzen              |
| 4.3 | Manuelle Navigation   | nach gespeichertem Vote Button "Naechste Frage" anzeigen                                    |
| 4.4 | Timeboxed Navigation  | Countdown aus per-Participant-`activeAt`; Timeout erzeugt 0-Punkte-Vote und wechselt weiter |
| 4.5 | Feedback-Zweige       | immediate zeigt bestehende Scorecard/Aufloesung; delayed nur Eingangsbestaetigung           |
| 4.6 | Abschlussreview       | `getAsyncPersonalReview` als ein batched Request, nicht N Scorecard-Queries                 |
| 4.7 | Specs                 | Component-Tests fuer Manual, Timeboxed, Immediate, Delayed, Timeout                         |

Repo-Bloat-Grenze:

- Keine neue Async-Feature-Route.
- Keine Duplikate fuer Antwortbuttons.
- Neue Template-Bloecke nur dort, wo der Zustand wirklich anders ist.

## Phase 5: Host-/Presenter-Dashboard

Ziel: Lehrperson sieht Fortschritt, ohne Daten preiszugeben oder Last zu erzeugen.

| #   | Task            | Beschreibung                                                                                        |
| --- | --------------- | --------------------------------------------------------------------------------------------------- |
| 5.1 | Dashboard-DTO   | kompakter Summary-Typ: pro Frage `answered`, `timeout`, `open`, `completed`, optional `correctRate` |
| 5.2 | Backend-Summary | SQL-`groupBy` + Redis-Fortschritt; kurzer Cache; Event-Invalidierung                                |
| 5.3 | Host-UI         | Session-Steuerbereich fuer Async durch Dashboard + Session-Ende ersetzen                            |
| 5.4 | Presenter-UI    | Fortschrittsansicht ohne Loesungsverrat; Korrektheit nur optional/aggregiert                        |
| 5.5 | Tests           | Routertest fuer Aggregation, Component-Spec fuer Anzeige und Beamer-Schutz                          |

Performance-Vorgabe:

- Dashboard-Snapshot maximal alle 1-2 Sekunden neu berechnen.
- Keine per-Teilnehmer-Zeilen im Payload.
- Payload-Groesse proportional zu Fragenzahl, nicht zu Teilnehmerzahl.

## Phase 6: Ergebnis, Bonus, Export

Ziel: Async fuegt sich in Abschluss- und Exportpfade ein.

| #   | Task                 | Beschreibung                                                                     |
| --- | -------------------- | -------------------------------------------------------------------------------- |
| 6.1 | Session-Ende         | `session.end`/bestehendes Finish generiert Bonuscodes wie bisher                 |
| 6.2 | Personal Result      | bestehendes `getPersonalResult` fuer Async unveraendert nutzbar halten           |
| 6.3 | Export-DTO erweitern | Pacing, Feedback, Completion-/Timeout-Aggregate aufnehmen                        |
| 6.4 | CSV-Export erweitern | vorhandenes `exportSessionResultsCsv()` um neue Metadaten/Zeilen ergaenzen       |
| 6.5 | Tests                | Export enthaelt Modus, Timeouts, Completion, keine personenbezogenen Zusatzdaten |

## Phase 7: Performance- und Regression-Absicherung

Ziel: minimale Last belegen und bestehende Live-Flows schuetzen.

| #   | Task                    | Beschreibung                                                                  |
| --- | ----------------------- | ----------------------------------------------------------------------------- |
| 7.1 | Hotpath-Review          | Vote, Async-State, Dashboard gegen ADR-0025 pruefen                           |
| 7.2 | Focused Load Smoke      | kleines Skript: 100-500 Teilnehmende, async manual/timeboxed, Dashboard offen |
| 7.3 | Sync-Regression         | bestehender synchroner Quiz-Smoke bleibt unveraendert                         |
| 7.4 | Browser-Viewport-Checks | Mobile Vote-Flow fuer beide Async-Modi pruefen                                |
| 7.5 | Dokumentation           | Backlog/Routes/Funktionsuebersicht nur gezielt aktualisieren                  |

---

## Betroffene Dateien

### Primaer

- `prisma/schema.prisma`
- `libs/shared-types/src/schemas.ts`
- `apps/backend/src/routers/session.ts`
- `apps/backend/src/routers/vote.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`
- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`
- `apps/frontend/src/app/features/session/session-present/session-present.component.ts`
- `apps/frontend/src/app/features/session/session-present/session-present.component.html`
- `apps/frontend/src/app/features/session/session-present/session-present.component.scss`
- `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`

### Kleine neue Helper-Dateien, falls noetig

- `apps/backend/src/lib/asyncQuizProgress.ts`
- `apps/backend/src/lib/asyncQuizSummary.ts`
- `apps/frontend/src/app/features/session/async-quiz-progress.util.ts`

Neue Dateien sind nur gerechtfertigt, wenn sie bestehende Grossdateien entlasten und keine neue Domaene duplizieren.

### Tests

- `apps/backend/src/__tests__/session*.test.ts` oder fokussierter neuer Backend-Test fuer Async-Session
- `apps/backend/src/__tests__/vote*.test.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
- Export-/Quiz-Store-Specs fuer Import/Export und Defaults

---

## Performance-Budget

| Pfad                       | Budget / Leitplanke                                                              |
| -------------------------- | -------------------------------------------------------------------------------- |
| `vote.submit`              | hoechstens bestehende Vote-Queries plus kleine Async-Pruefung; keine Aggregation |
| Async-State pro Teilnehmer | O(Fragenzahl + eigene Votes), nicht O(Teilnehmerzahl)                            |
| Dashboard                  | O(Fragenzahl) Payload; Aggregation gecacht; keine personenbezogenen Details      |
| Timeboxed Countdown        | Client tickt lokal; Server prueft nur bei Submit/Timeout                         |
| Redis                      | kleine Hashes mit TTL; kein unbounded Eventlog                                   |
| SQL                        | keine neue Schreiboperation pro Navigation im Manual-Modus                       |
| Frontend                   | keine grossen neuen Komponentenbaeume; bestehende Antwort-Controls bleiben       |

---

## Risiken und Gegenmassnahmen

| Risiko                                        | Gegenmassnahme                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `session-vote.component` wird zu komplex      | nur kleine Computeds/Helper extrahieren; keine zweite Feature-Kopie                         |
| Dashboard erzeugt Lastspitzen                 | TTL-Cache, Event-Invalidierung, Payload pro Frage statt pro Teilnehmer                      |
| Delayed Feedback leakt Loesungen              | separate DTO-Gates und Tests gegen `isCorrect`/Loesungstexte vor Abschluss                  |
| Timeboxed Deadline durch Client manipulierbar | Redis-Startzeit + serverseitige Deadline-Pruefung, Client-Zeit nur Anzeige                  |
| Async und Peer Instruction kollidieren        | Peer Instruction im ersten 2.9-Schritt fuer Async deaktivieren und im Startdialog erklaeren |
| Restart verliert transienten Fortschritt      | aus Votes rekonstruieren; offene Frage startet im Zweifel neu, da kein Langzeitmodus        |
| Export wird zu breit                          | nur aggregierte neue Felder; keine Rohverlaeufe                                             |

---

## Erste sinnvolle Umsetzungseinheit

Ein schlanker MVP fuer 2.9 sollte nur Folgendes enthalten:

1. `ASYNC_MANUAL` + `DELAYED`
2. bestehende Fragetypen, keine Peer Instruction in Async
3. Fortschritt aus Votes ableiten
4. Abschlussreview als batched Query
5. einfaches Host-Dashboard: beantwortet/offen/abgeschlossen pro Frage

Danach:

1. `IMMEDIATE`
2. `ASYNC_TIMEBOXED` mit Timeout-Votes
3. optionale aggregierte Korrektheits-Heatmap
4. Export-Verfeinerung

Diese Reihenfolge haelt den Performance- und Repo-Impact klein und verhindert, dass der komplexeste Modus die Grundlagen dominiert.

---

## Abnahmekriterien fuer den Implementierungsplan

- Bestehende synchrone Sessions verhalten sich unveraendert.
- Async Manual funktioniert ohne neue Persistenz-Tabelle.
- Async Timeboxed erzeugt keine Timer-Schreiblast pro Sekunde.
- Dashboard aktualisiert sich live, ohne pro Update alle Teilnehmenden als Payload zu senden.
- Immediate/Delayed Feedback sind durch DTO-Tests gegen Loesungs-Leaks abgesichert.
- Keine neue externe Dependency.
- Neue Dateien bleiben auf Helper und Tests begrenzt.
