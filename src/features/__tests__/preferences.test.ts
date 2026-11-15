import { DEFAULT_PREFERENCES, isFollowingHandle, preferencesStore, toggleFollow, toggleInterest } from '@/features/preferences/store';

beforeEach(() => preferencesStore.set(DEFAULT_PREFERENCES));

describe('preferences', () => {
  it('keeps the original casing of followed handles (the HF author filter is case-sensitive)', () => {
    toggleFollow(' Qwen ');
    expect(preferencesStore.get().following).toEqual(['Qwen']);
    expect(isFollowingHandle(preferencesStore.get().following, 'qwen')).toBe(true);
    toggleFollow('qwen');
    expect(preferencesStore.get().following).toEqual([]);
  });

  it('normalizes interests to lowercase', () => {
    toggleInterest('Robotics');
    expect(preferencesStore.get().interests).toEqual(['robotics']);
  });
});
