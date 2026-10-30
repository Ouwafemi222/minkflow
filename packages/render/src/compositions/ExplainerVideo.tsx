import { AUDIO_LEAD_FRAMES, activeCaptionLine, groupCaptionLines, sceneOffsets, type RenderManifest, type RenderScene, type Theme } from '@minkflow/contracts';
import { useMemo } from 'react';
import { AbsoluteFill, Html5Audio, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { transitionStyle } from '../anim';
import { renderTemplate } from '../templates';

export type ExplainerProps = { manifest: RenderManifest };

function Captions({ scene, theme }: { scene: RenderScene['scene']; theme: Theme }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = useMemo(() => groupCaptionLines(scene.captions), [scene.captions]);
  const ms = ((frame - AUDIO_LEAD_FRAMES) / fps) * 1000;
  const line = activeCaptionLine(lines, ms);
  if (!line) return null;
  return (
    <div style={{ position: 'absolute', left: 160, right: 160, bottom: 70, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(11,16,32,0.82)', borderRadius: 18, padding: '14px 28px', fontSize: 46, lineHeight: 1.3, fontWeight: 600, textAlign: 'center', maxWidth: 1600 }}>
        {line.tokens.map((token, i) => (
          <span key={i} style={{ color: ms >= token.startMs ? '#FFFFFF' : 'rgba(255,255,255,0.6)', textShadow: ms >= token.startMs && ms < token.endMs ? `0 0 1px ${theme.accent}` : undefined }}>
            {token.text}
            {i < line.tokens.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function SceneView({ item, theme, captionsEnabled }: { item: RenderScene; theme: Theme; captionsEnabled: boolean }) {
  const frame = useCurrentFrame();
  const { scene } = item;
  const showCaptions = captionsEnabled && scene.captions.length > 0;
  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <AbsoluteFill style={transitionStyle(scene.transition, frame, scene.durationFrames)}>
        {renderTemplate({ scene, theme, frame, durationInFrames: scene.durationFrames, captions: showCaptions })}
      </AbsoluteFill>
      {item.audio ? (
        <Sequence from={AUDIO_LEAD_FRAMES} layout="none">
          <Html5Audio src={item.audio.src} />
        </Sequence>
      ) : null}
      {showCaptions ? <Captions scene={scene} theme={theme} /> : null}
    </AbsoluteFill>
  );
}

export function ExplainerVideo({ manifest }: ExplainerProps) {
  const offsets = sceneOffsets(manifest.scenes.map((s) => s.scene.durationFrames));
  const { theme } = manifest;
  const logo = manifest.scenes.find((s) => s.logoSrc)?.logoSrc ?? null;
  return (
    <AbsoluteFill style={{ background: theme.background, fontFamily: `${theme.fontFamily}, system-ui, sans-serif`, color: theme.text }}>
      {manifest.scenes.map((item, i) => (
        <Sequence key={item.scene.id} from={offsets[i]!} durationInFrames={item.scene.durationFrames} name={`${i + 1}. ${item.scene.template}`}>
          <SceneView item={item} theme={theme} captionsEnabled={manifest.captionsEnabled} />
        </Sequence>
      ))}
      {logo ? <Img src={logo} style={{ position: 'absolute', top: 40, right: 48, height: 64, objectFit: 'contain' }} /> : null}
      {manifest.watermark ? (
        <div style={{ position: 'absolute', top: 36, left: 48, fontSize: 28, fontWeight: 700, color: '#FFFFFF', opacity: 0.75, background: 'rgba(11,16,32,0.55)', padding: '8px 18px', borderRadius: 999 }}>
          {manifest.watermark}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
