import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate } from '@angular/service-worker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';

const { footerBundleQueryMock, healthStatsQueryMock, swVersionUpdatesSubscribeMock } = vi.hoisted(
  () => ({
    footerBundleQueryMock: vi.fn(),
    healthStatsQueryMock: vi.fn(),
    swVersionUpdatesSubscribeMock: vi.fn(),
  }),
);

vi.mock('./core/trpc.client', () => ({
  trpc: {
    health: {
      footerBundle: {
        query: footerBundleQueryMock,
      },
      stats: {
        query: healthStatsQueryMock,
      },
    },
  },
}));

describe('AppComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    footerBundleQueryMock.mockResolvedValue({
      check: { status: 'ok' },
      stats: { serviceStatus: 'stable', loadStatus: 'healthy' },
    });
    healthStatsQueryMock.mockResolvedValue({
      openSessions: 1,
      activeSessions: 1,
      totalParticipants: 5,
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
      completedSessions: 2,
      activeBlitzRounds: 0,
      maxParticipantsSingleSession: 5,
      dailyHighscores: Array.from({ length: 30 }, (_, index) => ({
        date: `2026-05-${String(index + 1).padStart(2, '0')}`,
        count: 0,
        updatedAt: null,
      })),
      maxParticipantsStatisticUpdatedAt: null,
      serviceStatus: 'stable',
      loadStatus: 'healthy',
    });
    vi.stubGlobal('requestIdleCallback', vi.fn());
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('rendert den Update-Banner als auffaelliges Callout mit primaerer CTA', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    component.updateAvailable.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.app-update-banner') as HTMLElement | null;
    const action = fixture.nativeElement.querySelector(
      '.app-update-banner__action',
    ) as HTMLButtonElement | null;

    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('Neue Version bereit');
    expect(banner?.textContent).toContain('Aktualisieren für den neuesten Stand.');
    expect(action?.textContent).toContain('Jetzt aktualisieren');
    expect(fixture.nativeElement.querySelector('.app-update-banner__inner')).toBeTruthy();

    fixture.destroy();
  });

  it('laedt PWA-Updates per Seitenreload statt per activateUpdate', () => {
    const activateUpdateMock = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: activateUpdateMock,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const reloadPageSpy = vi
      .spyOn(component as unknown as { reloadPage: () => void }, 'reloadPage')
      .mockImplementation(() => undefined);

    component.reloadWithUpdate();
    component.reloadWithUpdate();

    expect(component.updateReloading()).toBe(true);
    expect(reloadPageSpy).toHaveBeenCalledTimes(1);
    expect(activateUpdateMock).not.toHaveBeenCalled();

    fixture.destroy();
  });

  it('stellt im Dev-Modus einen globalen Trigger fuer den Update-Banner bereit', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const win = window as Window & { __triggerUpdateBanner?: () => void };
    expect(typeof win.__triggerUpdateBanner).toBe('function');

    win.__triggerUpdateBanner?.();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.app-update-banner') as HTMLElement | null;
    expect(banner?.textContent).toContain('Neue Version bereit');

    fixture.destroy();
  });

  it('unterdrueckt Footer-Status-Polling auf Join- und Session-Live-Routen', async () => {
    window.history.pushState({}, '', '/de/join/ABC123');
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(footerBundleQueryMock).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-server-status-widget'),
    ).toBeNull();

    fixture.destroy();
    window.history.pushState({}, '', '/');
  });

  it('blendet Footer-Links zu Help, News-Archiv und Legal aus, wenn die App offline ist', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.onOffline();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('News-Archiv');
    expect(text).not.toContain('So funktioniert’s');
    expect(text).not.toContain('Impressum');
    expect(text).not.toContain('Datenschutz');

    fixture.destroy();
  });
});
