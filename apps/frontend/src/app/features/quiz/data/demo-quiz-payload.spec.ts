import { describe, expect, it } from 'vitest';
import { getDemoQuizPayload, getDemoQuizSeedFingerprint } from './demo-quiz-payload';

describe('getDemoQuizSeedFingerprint', () => {
  it('ändert sich mit exportVersion, Motiv-URL und komplettem Payload (Demo-Reseed)', () => {
    const de = getDemoQuizSeedFingerprint('de');
    expect(de).toMatch(/^de\|25\|/);
    expect(de).toContain(
      'https://upload.wikimedia.org/wikipedia/commons/b/b4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375_%28cropped%29.jpg',
    );
    expect(de.split('|').length).toBeGreaterThanOrEqual(5);
  });

  it('unterscheidet Locales', () => {
    expect(getDemoQuizSeedFingerprint('de')).not.toBe(getDemoQuizSeedFingerprint('en'));
  });

  it('markiert Frage 2 und 4 im Showcase explizit ohne Lesephase', () => {
    const payload = getDemoQuizPayload('de') as {
      quiz?: { questions?: Array<{ skipReadingPhase?: boolean }> };
    };

    expect(payload.quiz?.questions?.[1]?.skipReadingPhase).toBe(true);
    expect(payload.quiz?.questions?.[3]?.skipReadingPhase).toBe(true);
  });

  it('nutzt fuer die KI-oder-Foto-Frage ein lokales Asset und neutrale Alt-Texte', () => {
    const expectedAltByLocale = {
      de: 'Dachszene',
      en: 'Rooftop scene',
      es: 'Escena en una azotea',
      fr: 'Scène de toit',
      it: 'Scena sul tetto',
    } as const;

    for (const [locale, alt] of Object.entries(expectedAltByLocale)) {
      const payload = getDemoQuizPayload(locale as keyof typeof expectedAltByLocale) as {
        quiz?: { questions?: Array<{ text?: string; type?: string }> };
      };
      const question = payload.quiz?.questions?.find((q) => q.type === 'SINGLE_CHOICE');

      expect(question?.text).toContain(
        `![${alt}](/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png)`,
      );
      expect(question?.text).not.toContain('cdn.imago-images.de');
      expect(question?.text).not.toContain('0105048862');
    }
  });

  it('enthält eine 1.2ea-taugliche SHORT_TEXT-Frage mit Varianten und Buchstabendrehern', () => {
    const payload = getDemoQuizPayload('de') as {
      quiz?: {
        questions?: Array<{
          text?: string;
          type?: string;
          difficulty?: string;
          answers?: Array<{ text?: string; isCorrect?: boolean }>;
          shortTextMaxLength?: number;
          shortTextEvaluationMode?: string;
          shortTextToleranceLevel?: string;
          shortTextAllowPartialCredit?: boolean;
          shortTextTrimWhitespace?: boolean;
          shortTextNormalizeWhitespace?: boolean;
        }>;
      };
    };

    const shortTextQuestion = payload.quiz?.questions?.find(
      (question) => question.type === 'SHORT_TEXT',
    );

    expect(shortTextQuestion?.text).toContain('individuell abstimmen');
    expect(shortTextQuestion?.text).toContain('Buchstabendreher');
    expect(shortTextQuestion?.difficulty).toBe('HARD');
    expect(shortTextQuestion?.shortTextMaxLength).toBe(32);
    expect(shortTextQuestion?.shortTextEvaluationMode).toBe('auto');
    expect(shortTextQuestion?.shortTextToleranceLevel).toBe('medium');
    expect(shortTextQuestion?.shortTextAllowPartialCredit).toBe(true);
    expect(shortTextQuestion?.shortTextTrimWhitespace).toBe(true);
    expect(shortTextQuestion?.shortTextNormalizeWhitespace).toBe(true);
    expect(shortTextQuestion?.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Peer Instruction', isCorrect: true }),
        expect.objectContaining({ text: 'Peer-Instruction', isCorrect: true }),
        expect.objectContaining({ text: 'Mazur-Methode', isCorrect: true }),
        expect.objectContaining({ text: 'Mazur Methode', isCorrect: true }),
      ]),
    );
  });

  it('enthält eine sehr anspruchsvolle numerische SHORT_TEXT-Frage mit Einheit und Toleranz', () => {
    const payload = getDemoQuizPayload('de') as {
      quiz?: {
        questions?: Array<{
          text?: string;
          type?: string;
          difficulty?: string;
          answers?: Array<{ text?: string; isCorrect?: boolean }>;
          shortTextEvaluationKind?: string;
          numericInputKind?: string;
          numericToleranceMode?: string;
          numericRelativeTolerancePercent?: number;
          numericUnitFamily?: string;
          numericRequireUnit?: boolean;
          numericAcceptEquivalentUnits?: boolean;
        }>;
      };
    };

    const numericShortTextQuestion = payload.quiz?.questions?.find(
      (question) =>
        question.type === 'SHORT_TEXT' && question.shortTextEvaluationKind === 'numeric_unit',
    );

    expect(numericShortTextQuestion?.text).toContain('Schallgeschwindigkeit');
    expect(numericShortTextQuestion?.text).toContain('58 cm');
    expect(numericShortTextQuestion?.difficulty).toBe('HARD');
    expect(numericShortTextQuestion?.numericInputKind).toBe('decimal');
    expect(numericShortTextQuestion?.numericToleranceMode).toBe('relative');
    expect(numericShortTextQuestion?.numericRelativeTolerancePercent).toBe(2);
    expect(numericShortTextQuestion?.numericUnitFamily).toBe('time');
    expect(numericShortTextQuestion?.numericRequireUnit).toBe(true);
    expect(numericShortTextQuestion?.numericAcceptEquivalentUnits).toBe(true);
    expect(numericShortTextQuestion?.answers).toEqual([
      expect.objectContaining({ text: '1,69 ms', isCorrect: true }),
    ]);
  });
});
