'use client';

import { Crop, Download, Maximize2, Music2, Play, Scan, Type } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadJobVideo } from '@/lib/download-video';
import { errorMessage } from '@/lib/client';
import type { ProjectView } from '@/lib/project-view';
import { PricingModal } from './PricingModal';

type Tool = 'caption' | 'soundtrack' | 'crop' | 'blur' | 'resolution';

const TRACKS = ['Calm piano', 'Upbeat guitar', 'Soft pads', 'News bed'];
const RESOLUTIONS = ['720p', '1080p', '4K'];

function captionKey(projectId: string) {
  return `minkflow.editCaption.${projectId}`;
}

export function VideoEditor({ view, jobId, jobType }: { view: ProjectView; jobId: string; jobType: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [caption, setCaption] = useState(() => ({
    text: view.doc.storyboard?.scenes[0]?.narration ?? view.project.title,
    size: 28,
  }));
  const [active, setActive] = useState<Tool>('caption');
  const [pricing, setPricing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captionReady, setCaptionReady] = useState(false);
  const src = `/api/jobs/${jobId}/download?inline=1`;
  const filename = `${view.project.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'video'}${jobType === 'preview' ? '-preview' : ''}.mp4`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(captionKey(view.project.id));
      if (raw) setCaption(JSON.parse(raw) as { text: string; size: number });
    } catch {
      /* keep default */
    }
    setCaptionReady(true);
  }, [view.project.id]);
  useEffect(() => {
    if (!captionReady) return;
    try {
      window.localStorage.setItem(captionKey(view.project.id), JSON.stringify(caption));
    } catch {
      /* ignore quota */
    }
  }, [caption, captionReady, view.project.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const play = () => {
      void el.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    };
    if (el.readyState >= 2) play();
    else el.addEventListener('loadeddata', play, { once: true });
    return () => el.removeEventListener('loadeddata', play);
  }, [src]);

  const tools = useMemo(
    () =>
      [
        { id: 'caption' as const, label: 'Caption', icon: Type },
        { id: 'soundtrack' as const, label: 'Soundtrack', icon: Music2 },
        { id: 'crop' as const, label: 'Crop', icon: Crop },
        { id: 'blur' as const, label: 'Blur edges', icon: Scan },
        { id: 'resolution' as const, label: 'Resolution', icon: Maximize2 },
      ] as const,
    [],
  );

  function onTool(id: Tool) {
    if (id === 'caption') {
      setActive('caption');
      return;
    }
    setActive(id);
    setPricing(true);
  }

  async function onDownload() {
    setBusy(true);
    setNotice(null);
    try {
      await downloadJobVideo(jobId, filename);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack video-editor-page" style={{ ['--gap' as string]: '16px' }}>
      <header className="spread">
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <Link href={`/studio/projects/${view.project.id}`} className="small">
            ← Back to project
          </Link>
          <h1 style={{ margin: 0 }}>{view.project.title}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {jobType === 'preview' ? 'Draft preview — add captions here, then render 1080p when you are ready.' : 'Final video. Caption size and text are free to edit on this page.'}
          </p>
        </div>
        <button className="btn primary" type="button" disabled={busy} onClick={() => void onDownload()}>
          <Download size={16} aria-hidden /> {busy ? 'Preparing…' : 'Download MP4'}
        </button>
      </header>

      {notice ? (
        <p className="alert error" role="alert">
          {notice}
        </p>
      ) : null}

      <div className="video-editor">
        <div className="video-stage">
          <video
            ref={videoRef}
            className="video-stage-player"
            src={src}
            controls
            playsInline
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() =>
              setNotice('The video is not available on this server. Open Studio at http://localhost:3000 on the computer that rendered it.')
            }
          />
          {caption.text.trim() ? (
            <p className="caption-overlay" style={{ fontSize: caption.size }}>
              {caption.text}
            </p>
          ) : null}
          {!playing ? (
            <button
              className="video-play"
              type="button"
              aria-label="Play video"
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                el.muted = false;
                void el.play().then(
                  () => setPlaying(true),
                  () => setNotice('Click play on the video to hear the voice. The browser blocked autoplay with sound.'),
                );
              }}
            >
              <Play size={28} aria-hidden />
            </button>
          ) : null}
        </div>

        <aside className="card stack video-tools" style={{ ['--gap' as string]: '14px' }}>
          <h2 style={{ margin: 0 }}>Edit</h2>
          <div className="tool-grid" role="toolbar" aria-label="Edit tools">
            {tools.map((tool) => (
              <button key={tool.id} type="button" className={`tool-btn${active === tool.id ? ' selected' : ''}`} onClick={() => onTool(tool.id)}>
                <tool.icon size={18} aria-hidden />
                {tool.label}
              </button>
            ))}
          </div>

          {active === 'caption' ? (
            <div className="stack" style={{ ['--gap' as string]: '10px' }}>
              <label className="field">
                Caption
                <textarea className="input" rows={4} maxLength={240} value={caption.text} onChange={(e) => setCaption((c) => ({ ...c, text: e.target.value }))} />
              </label>
              <label className="field">
                Size · {caption.size}px
                <input
                  type="range"
                  min={18}
                  max={72}
                  value={caption.size}
                  onChange={(e) => setCaption((c) => ({ ...c, size: Number(e.target.value) }))}
                />
              </label>
            </div>
          ) : null}

          {active === 'soundtrack' ? (
            <div className="stack" style={{ ['--gap' as string]: '8px' }}>
              <p className="muted small" style={{ margin: 0 }}>
                Add a tune under the voiceover.
              </p>
              {TRACKS.map((track) => (
                <button key={track} type="button" className="btn" onClick={() => setPricing(true)}>
                  {track}
                </button>
              ))}
            </div>
          ) : null}

          {active === 'crop' ? (
            <div className="stack">
              <p className="muted small" style={{ margin: 0 }}>
                Crop any side of the frame.
              </p>
              <button type="button" className="btn" onClick={() => setPricing(true)}>
                Crop frame
              </button>
            </div>
          ) : null}

          {active === 'blur' ? (
            <div className="stack" style={{ ['--gap' as string]: '8px' }}>
              <p className="muted small" style={{ margin: 0 }}>
                Soften a side of the video.
              </p>
              {['Blur left', 'Blur right', 'Blur top', 'Blur bottom'].map((side) => (
                <button key={side} type="button" className="btn" onClick={() => setPricing(true)}>
                  {side}
                </button>
              ))}
            </div>
          ) : null}

          {active === 'resolution' ? (
            <div className="stack" style={{ ['--gap' as string]: '8px' }}>
              <p className="muted small" style={{ margin: 0 }}>
                Change the export size.
              </p>
              {RESOLUTIONS.map((res) => (
                <button key={res} type="button" className="btn" onClick={() => setPricing(true)}>
                  {res}
                </button>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      {pricing ? <PricingModal onClose={() => setPricing(false)} /> : null}
    </div>
  );
}
