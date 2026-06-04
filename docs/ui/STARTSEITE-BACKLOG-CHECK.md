# Startseite - Backlog-Funktionalitäts-Check

**Stand:** 2026-06-04

**Basis:** [Backlog.md](../../Backlog.md), aktuelle Startseiten-/Toolbar-Funktion, i18n- und Server-Status-Doku. Der frühere Stand vom 2026-03-20 ist ersetzt.

---

## Übersicht: Backlog vs. Startseite

| Backlog-Anforderung                  | Story        | Sichtbar/Erreichbar | Ziel                               | Status                                                   |
| ------------------------------------ | ------------ | ------------------- | ---------------------------------- | -------------------------------------------------------- |
| Theme-Umschalter (Light/Dark/System) | 6.1          | Header              | -                                  | ✅ umgesetzt                                             |
| Sprachwähler                         | 6.2          | Header              | Locale-URL                         | ✅ `de`, `en`, `fr`, `it`, `es`                          |
| Quiz-Presets (Seriös/Spielerisch)    | 1.11         | Header / Startseite | Quiz- und Home-Kontext             | ✅ umgesetzt                                             |
| Session erstellen                    | 2.1a, Epic 1 | Erstellen / Quiz    | `/quiz`                            | ✅ Quiz-Sammlung, Editor und Live-Start sind umgesetzt   |
| Quiz wählen                          | Epic 1       | Quiz-Sammlung       | `/quiz`                            | ✅ umgesetzt                                             |
| Q&A                                  | 8.1-8.4      | Session / Host      | Session-Kanal                      | ✅ Q&A-Kern umgesetzt; Delegation 8.5 bleibt offen       |
| Tempo-Blitzlicht                     | 8.8          | Startseite / Host   | `/feedback/:code`                  | ✅ Spotlight-Einstieg `Tempo-Feedback` umgesetzt         |
| Session-Code-Eingabe                 | 3.1          | Beitreten-Karte     | `/session/:code`                   | ✅ Join-Flow umgesetzt                                   |
| Zuletzt beigetretene Sessions        | -            | Beitreten-Karte     | `/session/:code`                   | ✅ Zusatzfeature                                         |
| Server-Status-Widget                 | 0.4 / 0.4a   | Footer / Hilfe      | `health.footerBundle`, `stats`     | ✅ Status, Rekordteilnehmende und Tagesrekorde umgesetzt |
| Impressum / Datenschutz              | 6.3          | Footer              | `/legal/imprint`, `/legal/privacy` | ✅ lokalisierte Legal-Markdown-Dateien                   |
| Trust-Badges / Produktversprechen    | -            | Startseite / Footer | -                                  | ✅ Zusatzfeature                                         |
| Offline-/PWA-Verhalten               | 6.4          | App-weit            | PWA                                | ✅ PWA und Update-Hinweis umgesetzt                      |

---

## Aktuelle Lücken, die nicht durch Startseiten-Links entstehen

- **6.5 Barrierefreiheit:** fortlaufender Audit- und Nachweispunkt.
- **6.6 Thinking Aloud:** qualitative UX-Testreihe und Umsetzung der Befunde offen.
- **8.5 Delegierbare Q&A-Moderation:** keine eigene Moderator-Route / kein Moderator-Token im Ist-Stand.
- **1.14a Word Cloud 2.0:** weiterer UI-/Layout-Ausbau offen.

---

## Pflege-Regel

- Diese Datei beschreibt **Erreichbarkeit von der Startseite**, nicht den gesamten Produktstatus.
- Der Produktstatus bleibt im [Backlog](../../Backlog.md) und in [APP-FUNKTIONSUEBERSICHT.md](../APP-FUNKTIONSUEBERSICHT.md) führend.
- Bei Änderungen an Startseiten-Texten oder Toolbar-Labels immer alle XLF-Locale-Dateien synchronisieren.
