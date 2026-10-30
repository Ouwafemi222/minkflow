import { manifestDurationFrames, RenderManifestSchema } from '@minkflow/contracts';
import { Composition } from 'remotion';
import { COMPOSITION_ID, ExplainerVideo, type ExplainerProps } from './compositions';
import { sampleManifest } from './sample-manifest';
import { waitForFonts } from './fonts';

waitForFonts();

export function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={ExplainerVideo}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={manifestDurationFrames(sampleManifest)}
      defaultProps={{ manifest: sampleManifest } satisfies ExplainerProps}
      calculateMetadata={({ props }) => {
        const manifest = RenderManifestSchema.parse(props.manifest);
        return { durationInFrames: manifestDurationFrames(manifest), props: { manifest } };
      }}
    />
  );
}
