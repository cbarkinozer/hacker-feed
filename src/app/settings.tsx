import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Section } from '@/components/DetailParts';
import { AppText, Button, Chip, ContentColumn, Segmented } from '@/components/ui';
import { UnofficialNotice } from '@/components/UnofficialNotice';
import { topSignals } from '@/features/activity/affinity';
import { resetAffinity, useAffinity } from '@/features/activity/store';
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
import { clearHfSession, useHfSession } from '@/features/auth/session';
import { useHfSignIn } from '@/features/auth/useHfSignIn';
import { verifyKaggleCredentials } from '@/features/kaggle/api';
import { clearKaggleCredentials, saveKaggleCredentials, useKaggleCredentials } from '@/features/kaggle/credentials';
import { describeError } from '@/lib/http';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

const KIND_CHIP: Partial<Record<(typeof ALL_KINDS)[number], string>> = {
  community: 'Community articles',
  hn: 'Hacker News',
  video: 'Videos',
  kaggle: 'Kaggle datasets',
};
const GOALS = [10, 20, 40, 70];

/** Hugging Face account via OAuth (PKCE). The token stays on this device. */
function AccountSection() {
  const session = useHfSession();
  const { ready, busy, error, signIn } = useHfSignIn();
  const c = useColors();
  return (
    <Section title="Hugging Face account">
      <AppText variant="caption" tone="muted">
        Sign in to upvote papers from the app. HackerFeed only asks to read your public profile and post comments for you. Your token stays
        on this device and you can revoke it any time in your Hugging Face settings.
      </AppText>
      {session ? (
        <View style={styles.chips}>
          <Chip label={`Signed in as ${session.username}`} selected />
          <Button label="Sign out" icon="log-out-outline" variant="secondary" onPress={() => void clearHfSession()} />
        </View>
      ) : (
        <View style={styles.chips}>
          <Button
            label={busy ? 'Signing in…' : 'Sign in with Hugging Face'}
            icon="log-in-outline"
            onPress={() => void signIn()}
            disabled={!ready || busy}
          />
        </View>
      )}
      {error ? (
        <AppText variant="caption" style={{ color: c.danger }}>
          {error}
        </AppText>
      ) : null}
    </Section>
  );
}

/** Kaggle username + API key, kept on-device (Keychain/Keystore on native) and sent only to kaggle.com. */
function KaggleSection() {
  const c = useColors();
  const saved = useKaggleCredentials();
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const creds = { username: username.trim(), key: key.trim() };
    if (!creds.username || !creds.key) return;
    setBusy(true);
    try {
      await verifyKaggleCredentials(creds);
      await saveKaggleCredentials(creds);
      setKey('');
      setStatus({ ok: true, text: 'Connected. Competitions now appear under Trending → Contests.' });
    } catch (err) {
      setStatus({ ok: false, text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const field = [styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }];
  return (
    <Section title="Kaggle">
      <AppText variant="caption" tone="muted">
        Datasets work without an account. For competitions, create an API token at kaggle.com/settings and enter your username and key. They
        stay on this device and are only sent to kaggle.com.
      </AppText>
      {saved ? (
        <View style={styles.chips}>
          <Chip label={`Connected as ${saved.username}`} selected />
          <Button
            label="Disconnect"
            icon="log-out-outline"
            variant="secondary"
            onPress={() => {
              void clearKaggleCredentials();
              setStatus(null);
            }}
          />
        </View>
      ) : (
        <>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Kaggle username"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Kaggle username"
            style={field}
          />
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="API key"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel="Kaggle API key"
            onSubmitEditing={connect}
            style={field}
          />
          <View style={styles.chips}>
            <Button label={busy ? 'Checking…' : 'Connect'} icon="key-outline" onPress={connect} />
          </View>
        </>
      )}
      {status ? (
        <AppText variant="caption" style={{ color: status.ok ? c.link : c.danger }}>
          {status.text}
        </AppText>
      ) : null}
    </Section>
  );
}

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
  const learned = topSignals(useAffinity());
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
          <AppText variant="caption" tone="muted">
            Layout
          </AppText>
          <View style={styles.negative}>
            <Segmented
              options={[
                { value: 'comfortable', label: 'Cards' },
                { value: 'compact', label: 'Compact list' },
              ]}
              value={prefs.density}
              onChange={(d) => setPreference('density', d)}
            />
          </View>
        </Section>

        <Section title="Home feed shows">
          <View style={styles.chips}>
            {ALL_KINDS.filter((k) => k !== 'competition').map((k) => (
              <Chip
                key={k}
                label={KIND_CHIP[k] ?? `${KIND_LABEL[k]}s`}
                selected={prefs.homeKinds.includes(k)}
                onPress={() => toggleHomeKind(k)}
              />
            ))}
          </View>
        </Section>

        <Section title="Weekly reading goal">
          <AppText variant="caption" tone="muted">
            How many things you aim to open each week. Progress shows in You.
          </AppText>
          <View style={styles.chips}>
            {GOALS.map((g) => (
              <Chip key={g} label={`${g} / week`} selected={prefs.weeklyGoal === g} onPress={() => setPreference('weeklyGoal', g)} />
            ))}
          </View>
        </Section>

        <AccountSection />

        <KaggleSection />

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
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            {learned.length
              ? `Learned from what you open and save: ${learned.join(', ')}.`
              : 'For You also learns from what you open and save. Nothing has been learned yet.'}
          </AppText>
          {learned.length ? (
            <View style={styles.chips}>
              <Button label="Reset learned interests" icon="refresh" variant="secondary" onPress={resetAffinity} />
            </View>
          ) : null}
        </Section>

        <Section title="Following">
          <AppText variant="caption" tone="muted">
            Follow Hugging Face users or organizations, Hacker News users, or video channels (e.g. &quot;Qwen&quot;, &quot;google&quot;) to
            see their latest models and articles in Home → Following.
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
            HackerFeed {Constants.expoConfig?.version ?? ''} is an open-source reader that combines public Hugging Face, Hacker News and
            Kaggle data with HackerTube&apos;s video catalog (ODC-By 1.0, derived from open-index/hacker-news). All trademarks belong to
            their owners.
          </AppText>
          <View style={styles.chips}>
            <Button
              label="Source code"
              icon="logo-github"
              variant="secondary"
              onPress={() => openExternal('https://github.com/cbarkinozer/hacker-feed')}
            />
            <Button label="HackerTube" icon="open-outline" variant="secondary" onPress={() => openExternal('https://hackertube.org')} />
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
