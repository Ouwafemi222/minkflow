import type { CharacterId, CharacterPose, Theme, VisualFor } from '@minkflow/contracts';
import { fadeUp } from '../anim';
import { Icon } from '../icons';
import { Card, Heading, SafeArea, type TemplateProps } from '../layout';

const LOOKS: Record<CharacterId, { skin: string; hair: string; style: 'short' | 'curly' | 'long' | 'side' }> = {
  alex: { skin: '#E8B896', hair: '#2A2438', style: 'short' },
  sam: { skin: '#C47A4A', hair: '#3D2914', style: 'curly' },
  rio: { skin: '#F0C7A0', hair: '#1A1520', style: 'long' },
  kai: { skin: '#D4A574', hair: '#4A3728', style: 'side' },
};

const ARMS: Record<CharacterPose, { left: number; right: number }> = {
  talking: { left: 18, right: -26 },
  pointing: { left: 10, right: -82 },
  thinking: { left: 12, right: 62 },
  presenting: { left: 48, right: -52 },
  celebrating: { left: 125, right: -125 },
};

function HostCharacter({ id, pose, theme, frame }: { id: CharacterId; pose: CharacterPose; theme: Theme; frame: number }) {
  const look = LOOKS[id];
  const shirt = id === 'sam' || id === 'kai' ? theme.accent : theme.primary;
  const bob = Math.sin((frame / 16) * Math.PI * 2) * 6;
  const talking = pose === 'talking' || pose === 'presenting';
  const mouth = talking ? 10 + 6 * Math.abs(Math.sin(frame / 4.5)) : 8;
  const blink = frame % 96 < 5 ? 0.12 : 1;
  const arms = ARMS[pose];

  return (
    <svg width={480} height={700} viewBox="0 0 320 470" aria-hidden style={{ transform: `translateY(${bob}px)`, overflow: 'visible' }}>
      <ellipse cx="160" cy="452" rx="92" ry="14" fill={theme.text} opacity={0.12} />
      <rect x="112" y="318" width="36" height="118" rx="18" fill={theme.surface} />
      <rect x="172" y="318" width="36" height="118" rx="18" fill={theme.surface} />
      <rect x="108" y="418" width="44" height="22" rx="10" fill={theme.text} opacity={0.85} />
      <rect x="168" y="418" width="44" height="22" rx="10" fill={theme.text} opacity={0.85} />
      <g transform={`rotate(${arms.left} 118 188)`}>
        <rect x="96" y="188" width="32" height="132" rx="16" fill={shirt} />
        <circle cx="112" cy="328" r="18" fill={look.skin} />
      </g>
      <rect x="108" y="168" width="104" height="168" rx="36" fill={shirt} />
      <rect x="128" y="196" width="64" height="88" rx="16" fill={theme.text} opacity={0.12} />
      <g transform={`rotate(${arms.right} 202 188)`}>
        <rect x="192" y="188" width="32" height="132" rx="16" fill={shirt} />
        <circle cx="208" cy="328" r="18" fill={look.skin} />
      </g>
      <rect x="146" y="148" width="28" height="28" rx="10" fill={look.skin} />
      {look.style === 'long' ? <ellipse cx="160" cy="128" rx="78" ry="92" fill={look.hair} /> : null}
      {look.style === 'curly' ? <circle cx="160" cy="78" r="78" fill={look.hair} /> : null}
      <circle cx="160" cy="100" r="58" fill={look.skin} />
      {look.style === 'short' ? <ellipse cx="160" cy="58" rx="54" ry="34" fill={look.hair} /> : null}
      {look.style === 'side' ? <path d="M108 86 C118 40 206 48 214 96 C186 60 128 70 108 86Z" fill={look.hair} /> : null}
      {look.style === 'long' ? <path d="M108 96 C116 50 204 50 212 96 C198 70 122 70 108 96Z" fill={look.hair} /> : null}
      <ellipse cx="140" cy="98" rx="8" ry={8 * blink} fill="#F7F4EF" />
      <ellipse cx="180" cy="98" rx="8" ry={8 * blink} fill="#F7F4EF" />
      <circle cx="142" cy="99" r="3.4" fill="#1A1520" />
      <circle cx="182" cy="99" r="3.4" fill="#1A1520" />
      {id === 'kai' ? (
        <g fill="none" stroke="#1A1520" strokeWidth="4" opacity={0.75}>
          <ellipse cx="140" cy="98" rx="16" ry="12" />
          <ellipse cx="180" cy="98" rx="16" ry="12" />
          <path d="M156 98 H164" />
        </g>
      ) : null}
      <path d={`M146 124 Q160 ${124 + mouth} 174 124`} fill="none" stroke="#7A4A32" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function CharacterExplains({ visual, theme, frame, captions }: TemplateProps<VisualFor<'character_explains'>>) {
  return (
    <SafeArea captions={captions} style={{ flexDirection: 'row', alignItems: 'center', gap: 40 }}>
      <div style={{ flex: '0 0 520px', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', ...fadeUp(frame, 0) }}>
        <HostCharacter id={visual.character} pose={visual.pose} theme={theme} frame={frame} />
      </div>
      <div style={{ flex: 1, minWidth: 0, ...fadeUp(frame, 8) }}>
        <Card theme={theme} style={{ padding: '44px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            {visual.prop ? (
              <div style={{ background: theme.background, borderRadius: 20, padding: 14 }}>
                <Icon id={visual.prop} size={56} color={theme.accent} />
              </div>
            ) : null}
            <Heading theme={theme} style={{ fontSize: 52 }}>
              {visual.heading}
            </Heading>
          </div>
          {visual.points.map((point, i) => (
            <div
              key={i}
              style={{
                ...fadeUp(frame, 14 + i * 8),
                display: 'flex',
                gap: 18,
                alignItems: 'flex-start',
                fontSize: 36,
                lineHeight: 1.35,
                color: theme.text,
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: i === 0 ? theme.primary : theme.accent,
                  marginTop: 12,
                  flex: '0 0 18px',
                }}
              />
              <span>{point}</span>
            </div>
          ))}
        </Card>
      </div>
    </SafeArea>
  );
}
