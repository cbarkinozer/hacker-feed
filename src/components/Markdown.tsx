import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { parseMarkdown, type Block, type Span } from '@/lib/markdown';
import { openExternal } from '@/lib/navigation';
import { fonts, radius, spacing, useColors } from '@/theme';

const HEADING: Record<number, TextStyle> = {
  1: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  3: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  4: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  5: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  6: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
};

function Spans({ spans, style }: { spans: Span[]; style?: TextStyle }) {
  const c = useColors();
  return (
    <Text style={[styles.body, { color: c.textSecondary }, style]} maxFontSizeMultiplier={1.8} selectable>
      {spans.map((s, i) => (
        <Text
          key={i}
          onPress={s.href ? () => openExternal(s.href!) : undefined}
          accessibilityRole={s.href ? 'link' : undefined}
          style={[
            s.bold && { fontWeight: '700', color: c.text },
            s.italic && { fontStyle: 'italic' },
            s.code && {
              fontFamily: fonts.mono,
              fontSize: 14,
              backgroundColor: c.codeBackground,
            },
            s.href && { color: c.link },
          ]}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function MdImage({ src, alt }: { src: string; alt: string }) {
  const c = useColors();
  const [ratio, setRatio] = useState(16 / 9);
  const [failed, setFailed] = useState(false);
  if (failed || /\.(mp4|webm|mov)(\?|$)/i.test(src)) return null;
  return (
    <Image
      source={src}
      accessibilityLabel={alt || 'Image'}
      style={[styles.image, { aspectRatio: ratio, backgroundColor: c.surface }]}
      contentFit="contain"
      onLoad={(e) => e.source.width && e.source.height && setRatio(Math.max(0.4, e.source.width / e.source.height))}
      onError={() => setFailed(true)}
    />
  );
}

function BlockView({ block }: { block: Block }) {
  const c = useColors();
  switch (block.type) {
    case 'heading':
      return (
        <Spans
          spans={block.spans}
          style={{
            ...HEADING[block.level],
            color: c.text,
            marginTop: spacing.md,
          }}
        />
      );
    case 'paragraph':
      return <Spans spans={block.spans} />;
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: c.accent }]}>
          <Spans spans={block.spans} style={{ fontStyle: 'italic' }} />
        </View>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((spans, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[styles.body, { color: c.textMuted, minWidth: 20 }]}>{block.ordered ? `${i + 1}.` : '•'}</Text>
              <View style={{ flex: 1 }}>
                <Spans spans={spans} />
              </View>
            </View>
          ))}
        </View>
      );
    case 'code':
      return (
        <ScrollView horizontal style={[styles.code, { backgroundColor: c.codeBackground }]} contentContainerStyle={{ padding: spacing.md }}>
          <Text
            selectable
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              lineHeight: 19,
              color: c.text,
            }}>
            {block.text}
          </Text>
        </ScrollView>
      );
    case 'image':
      return <MdImage src={block.src} alt={block.alt} />;
    case 'hr':
      return (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: c.border,
            marginVertical: spacing.sm,
          }}
        />
      );
    case 'table':
      return (
        <ScrollView horizontal style={[styles.table, { borderColor: c.border }]}>
          <View>
            {[block.header, ...block.rows].map((row, r) => (
              <View
                key={r}
                style={[
                  styles.row,
                  {
                    borderColor: c.border,
                    backgroundColor: r === 0 ? c.surface : undefined,
                  },
                ]}>
                {row.map((cell, j) => (
                  <View key={j} style={styles.cell}>
                    <Spans
                      spans={cell}
                      style={{
                        fontSize: 13,
                        lineHeight: 18,
                        fontWeight: r === 0 ? '700' : '400',
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
  }
}

/** Renders Markdown with the app's typography. `base` resolves relative links/images. */
export const Markdown = memo(function Markdown({ source, base, maxBlocks = 400 }: { source: string; base?: string; maxBlocks?: number }) {
  const blocks = useMemo(() => parseMarkdown(source, base).blocks.slice(0, maxBlocks), [source, base, maxBlocks]);
  return (
    <View style={styles.root}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  body: { fontSize: 16, lineHeight: 25 },
  quote: { borderLeftWidth: 3, paddingLeft: spacing.md },
  list: { gap: spacing.xs },
  listItem: { flexDirection: 'row', gap: spacing.xs },
  code: { borderRadius: radius.md },
  image: { width: '100%', borderRadius: radius.md },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { width: 150, padding: spacing.sm },
});
