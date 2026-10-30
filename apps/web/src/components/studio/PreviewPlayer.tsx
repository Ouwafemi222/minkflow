'use client';

import '@minkflow/render/fonts';
import { VIDEO, type RenderManifest, type Scene, type Theme } from '@minkflow/contracts';
import { ExplainerVideo } from '@minkflow/render/compositions';
import { Player, type PlayerRef } from '@remotion/player';
import { forwardRef, useMemo } from 'react';

interface Props {
  projectId: string;
  scenes: Scene[];
  theme: Theme;
  captionsEnabled: boolean;
  watermark: string | null;
  audioUrls: Record<string, string>;
  logoUrl: string | null;
}

/** Live in-browser preview using the same Remotion composition as the final render. */
export const PreviewPlayer = forwardRef<PlayerRef, Props>(function PreviewPlayer({ projectId, scenes, theme, captionsEnabled, watermark, audioUrls, logoUrl }, ref) {
  const manifest = useMemo<RenderManifest>(
    () => ({
      manifestVersion: 1,
      projectId,
      revisionId: projectId,
      fps: VIDEO.fps,
      width: VIDEO.width,
      height: VIDEO.height,
      theme,
      captionsEnabled,
      watermark,
      scenes: scenes.map((scene) => {
        const src = scene.voiceAssetId ? audioUrls[scene.voiceAssetId] : undefined;
        return { scene, audio: src ? { src, durationMs: 1 } : null, logoSrc: logoUrl };
      }),
    }),
    [projectId, scenes, theme, captionsEnabled, watermark, audioUrls, logoUrl],
  );
  const durationInFrames = Math.max(1, scenes.reduce((n, s) => n + s.durationFrames, 0));
  return (
    <Player
      ref={ref}
      component={ExplainerVideo}
      inputProps={{ manifest }}
      durationInFrames={durationInFrames}
      compositionWidth={VIDEO.width}
      compositionHeight={VIDEO.height}
      fps={VIDEO.fps}
      controls
      acknowledgeRemotionLicense
      style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden' }}
    />
  );
});
