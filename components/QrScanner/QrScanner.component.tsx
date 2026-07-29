"use client";

import { useEffect, useRef, useState } from "react";

import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

interface Props {
  /** Called with the decoded QR text on every successful read. */
  onDecode: (text: string) => void;
  /** When true, the camera is torn down (e.g. before an event is selected). */
  paused?: boolean;
}

/**
 * Browser-camera QR reader built on @zxing/browser. Streams the rear camera
 * (falls back to any) into a <video> and decodes continuously; the parent
 * debounces repeat reads. Loaded via next/dynamic (ssr:false) — getUserMedia
 * only exists client-side and needs HTTPS (or localhost).
 */
export default function QrScanner({ onDecode, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    if (paused) return;
    let controls: IScannerControls | undefined;
    let cancelled = false;

    const reader = new BrowserMultiFormatReader();
    const onResult = (result: { getText(): string } | undefined) => {
      if (result) onDecodeRef.current(result.getText());
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Camera requires a secure context", "SecurityError");
      }

      // Phones with multiple rear lenses can hand the plain "environment"
      // facingMode to the ultra-wide/telephoto camera instead of the main
      // one, which is too zoomed-out to read a ticket QR. Probe for a
      // labeled main rear camera and pin to it by deviceId when one exists.
      let preferredDeviceId: string | undefined;
      try {
        const probe = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        probe.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const rear = devices.filter((d) => d.kind === "videoinput" && /back|rear/i.test(d.label));
        const primary = rear.find((d) => !/ultra ?wide|wide angle|tele(photo)?/i.test(d.label));
        preferredDeviceId = (primary ?? rear[0])?.deviceId;
      } catch {
        /* probing failed — fall through to the plain facingMode attempts below */
      }

      // Fall back through progressively looser constraints — laptops/desktops
      // usually only have a front-facing camera, and requesting an exact
      // "environment" facing mode can hard-fail there.
      const attempts: MediaStreamConstraints[] = [
        ...(preferredDeviceId ? [{ video: { deviceId: { exact: preferredDeviceId } } }] : []),
        { video: { facingMode: { ideal: "environment" } } },
        { video: true },
      ];

      let lastErr: unknown;
      for (const constraints of attempts) {
        try {
          const c = await reader.decodeFromConstraints(constraints, videoRef.current!, onResult);
          if (cancelled) c.stop();
          else controls = c;
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr;
    })().catch((err) => {
      const name = (err as { name?: string })?.name;
      setError(
        name === "SecurityError"
          ? "Camera access requires HTTPS (or http://localhost) — open this page over one of those."
          : name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "Camera permission denied. Allow camera access and reload."
            : name === "NotFoundError" || name === "DevicesNotFoundError"
              ? "No camera was found on this device."
              : name === "NotReadableError" || name === "TrackStartError"
                ? "The camera is in use by another app (e.g. a video call) — close it and reload."
                : "Could not start the camera on this device."
      );
    });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [paused]);

  return (
    <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      {/* Framing reticle — hidden while paused, since there's no live feed to frame */}
      {!paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-2/3 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}
      {paused && !error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">
          Camera stopped
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
