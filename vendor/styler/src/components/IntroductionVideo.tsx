import { useRef } from 'react';
import introductionUrl from '../../docs/video/styler-introduction.mp4?url';

export function IntroductionVideo() {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  function open() {
    dialog.current?.showModal();
    // Start within the click gesture. Native controls remain available if playback is blocked.
    void video.current?.play().catch(() => {});
  }
  function stop() {
    if (video.current) {
      video.current.pause();
      video.current.currentTime = 0;
    }
  }

  return <>
    <button className="introduction-link" type="button" onClick={open} aria-haspopup="dialog">
      <svg aria-hidden="true" width="25" height="25" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="13" r="11.5" stroke="currentColor" />
        <path d="M10 8.5 18 13 10 17.5Z" fill="currentColor" />
      </svg>
      <span>How it works | Video</span>
    </button>
    <dialog ref={dialog} className="introduction-dialog" aria-label="How Styler works" onClose={stop}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="introduction-player">
        <button type="button" className="introduction-close" onClick={() => dialog.current?.close()} aria-label="Close video" autoFocus>Close <span aria-hidden="true">×</span></button>
        <video ref={video} src={introductionUrl} controls playsInline preload="none" aria-label="Styler introduction video" />
      </div>
    </dialog>
  </>;
}
