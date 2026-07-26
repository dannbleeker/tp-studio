import { beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { STORAGE_KEYS } from '@/services/storage/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('locale preference', () => {
  it('defaults to English', () => {
    expect(s().locale).toBe('en');
  });

  it('persists a choice to the prefs blob', () => {
    s().setLocale('pseudo');
    expect(s().locale).toBe('pseudo');
    const raw = globalThis.localStorage.getItem(STORAGE_KEYS.prefs);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).locale).toBe('pseudo');
  });

  it('restores the default on "Restore defaults"', () => {
    s().setLocale('pseudo');
    s().resetPreferencesToDefaults();
    expect(s().locale).toBe('en');
  });

  it('falls back to English on a tampered or downgrade-stale stored value', () => {
    // A value written by a future build that shipped a locale this build
    // doesn't know. It must degrade, not put an unknown id into the store.
    globalThis.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ locale: 'de' }));
    resetStoreForTest();
    expect(s().locale).toBe('en');

    globalThis.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ locale: 42 }));
    resetStoreForTest();
    expect(s().locale).toBe('en');
  });
});

describe('document locale seam', () => {
  it('is absent from a document that never set one', () => {
    const restored = importFromJSON(exportToJSON(s().doc));
    expect(restored.locale).toBeUndefined();
    expect('locale' in restored).toBe(false);
  });

  it('round-trips a set value', () => {
    const base = JSON.parse(exportToJSON(s().doc));
    const restored = importFromJSON(JSON.stringify({ ...base, locale: 'en' }));
    expect(restored.locale).toBe('en');
  });

  it('drops an unrecognized value rather than failing the whole import', () => {
    // The forward-compat case: a doc saved by a newer build must still open.
    const base = JSON.parse(exportToJSON(s().doc));
    const restored = importFromJSON(JSON.stringify({ ...base, locale: 'de', title: 'Kept' }));
    expect(restored.locale).toBeUndefined();
    expect(restored.title).toBe('Kept');
  });
});
