/**
 * components/WebCamera.js — Real camera via getUserMedia (web only).
 *
 * Renders a full-screen overlay with a live video feed.
 * On capture: calls onCapture({ uri, file, mimeType }).
 * If camera permission is denied: calls onCancel('no_permission').
 */

import React, { useEffect, useRef, useState } from 'react';

export default function WebCamera({ onCapture, onCancel }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady]   = useState(false);
  const [err,   setErr]     = useState(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setErr('לא ניתן לגשת למצלמה. ודא שנתת הרשאה בדפדפן.');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function capture() {
    const video  = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      stopStream();
      const uri = URL.createObjectURL(blob);
      onCapture({ uri, file: blob, mimeType: 'image/jpeg' });
    }, 'image/jpeg', 0.85);
  }

  function cancel() {
    stopStream();
    onCancel();
  }

  // Styles are inline because this is a pure DOM overlay
  const overlay = {
    position: 'fixed', inset: 0, background: '#000',
    zIndex: 9999, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  };
  const video = {
    width: '100%', maxHeight: 'calc(100vh - 160px)',
    objectFit: 'cover', background: '#111',
  };
  const btnRow = {
    display: 'flex', gap: 24, marginTop: 20,
    alignItems: 'center', justifyContent: 'center',
  };
  const shutterOuter = {
    width: 72, height: 72, borderRadius: 36,
    border: '4px solid #fff', background: 'rgba(255,255,255,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  };
  const shutterInner = {
    width: 54, height: 54, borderRadius: 27, background: '#fff',
  };
  const cancelBtn = {
    color: '#fff', fontSize: 16, fontWeight: 700,
    background: 'rgba(0,0,0,0.5)', border: 'none',
    borderRadius: 20, padding: '8px 20px', cursor: 'pointer',
  };
  const hint = {
    color: '#fff', fontSize: 14, marginTop: 12, fontFamily: 'sans-serif',
  };

  return (
    <div style={overlay}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} style={video} autoPlay playsInline muted />

      {err ? (
        <div style={{ color: '#FF5252', marginTop: 20, fontFamily: 'sans-serif', textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📵</div>
          <div>{err}</div>
          <button onClick={cancel} style={{ ...cancelBtn, marginTop: 16 }}>חזור</button>
        </div>
      ) : (
        <>
          <div style={btnRow}>
            <button onClick={cancel} style={cancelBtn}>✕ ביטול</button>
            <div
              style={{ ...shutterOuter, opacity: ready ? 1 : 0.4, pointerEvents: ready ? 'auto' : 'none' }}
              onClick={ready ? capture : undefined}
            >
              <div style={shutterInner} />
            </div>
          </div>
          <div style={hint}>
            {ready ? 'כוון למזון ולחץ לצילום' : 'טוען מצלמה...'}
          </div>
        </>
      )}
    </div>
  );
}
