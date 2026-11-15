import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Section } from '@/components/DetailParts';
import { AppText, Button, Chip, ContentColumn, Segmented } from '@/components/ui';
import { UnofficialNotice } from '@/components/UnofficialNotice';
import { KIND_LABEL } from '@/features/feed/types';
import {
  ALL_KINDS,
  setPreference,
  SUGGESTED_INTERESTS,
  isFollowingHandle,
  toggleFollow,
  toggleHomeKind,
  toggleInterest,
  usePreferences,
  type ThemePreference,
} from '@/features/preferences/store';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function AddInput({ placeholder, onAdd, label }: { placeholder: string; onAdd: (v: string) => void; label: string }) {
  const c = useColors();
  const [value, setValue] = useState('');
  const submit = () => {
    const v = value
      .trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/huggingface\.co\//, '')
      .split('/')[0];
    if (v) onAdd(v);
    setValue('');
  };
  return (
    <View style={styles.addRow}>
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel={label}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
      />
      <Button label="Add" onPress={submit} />
    </View>
  );
}

export default function SettingsScreen() {
  const prefs = usePreferences();
  const c = useColors();
  const customInterests = prefs.interests.filter((i) => !SUGGESTED_INTERESTS.includes(i));

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ContentColumn>
        <UnofficialNotice />

        <Section title="Appearance">
          <View style={styles.negative}>
            <Segmented options={THEMES} value={prefs.theme} onChange={(t) => setPreference('theme', t)} />
          </View>
        </Section>

        <Section title="Home feed shows">
          <View style={styles.chips}>
            {ALL_KINDS.map((k) => (
              <Chip
                key={k}
                label={KIND_LABEL[k] === 'Article' ? 'Community articles' : `${KIND_LABEL[k]}s`}
                selected={prefs.homeKinds.includes(k)}
                onPress={() => toggleHomeKind(k)}
              />
            ))}
          </View>
        </Section>

        <Section title="Topics for For You">
          <AppText variant="caption" tone="muted">
            Items mentioning these topics rank higher. Everything stays on this device.
          </AppText>
          <View style={styles.chips}>
            {[...SUGGESTED_INTERESTS, ...customInterests].map((t) => (
              <Chip key={t} label={t} selected={prefs.interests.includes(t)} onPress={() => toggleInterest(t)} />
            ))}
          </View>
          <AddInput placeholder="Add a topic" label="Add a topic" onAdd={toggleInterest} />
        </Section>

        <Section title="Following">
          <AppText variant="caption" tone="muted">
            Follow Hugging Face users or organizations (e.g. &quot;Qwen&quot;, &quot;google&quot;) to see their latest models and articles
            in Home → Following.
          </AppText>
          {prefs.following.length ? (
            <View style={styles.chips}>
              {prefs.following.map((h) => (
                <Chip key={h} label={`${h}  ✕`} accessibilityLabel={`Unfollow ${h}`} selected onPress={() => toggleFollow(h)} />
              ))}
            </View>
          ) : null}
          <AddInput
            placeholder="Username or org"
            label="Follow a user or organization"
            onAdd={(h) => !isFollowingHandle(prefs.following, h) && toggleFollow(h)}
          />
        </Section>

        <Section title="About">
          <AppText variant="caption" tone="secondary">
            huggingface-mobile {Constants.expoConfig?.version ?? ''} is an open-source, community-built client that reads public Hugging
            Face data. Hugging Face and the 🤗 logo are trademarks of Hugging Face, Inc.
          </AppText>
          <View style={styles.chips}>
            <Button
              label="Source code"
              icon="logo-github"
              variant="secondary"
              onPress={() => openExternal('https://github.com/cbarkinozer/huggingface-mobile')}
            />
            <Button label="huggingface.co" icon="open-outline" variant="secondary" onPress={() => openExternal('https://huggingface.co')} />
          </View>
        </Section>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  negative: { marginHorizontal: -spacing.lg },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
});
