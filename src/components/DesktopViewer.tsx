import React, { useCallback, useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';
import {
  Camera,
  ClipboardPaste,
  Crosshair,
  Expand,
  Hand,
  Keyboard as KeyboardIcon,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer,
  RefreshCw,
  Share2,
  Smartphone,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import type { DesktopState, Machine } from '../types/instabox';
import type { InstaboxClient } from '../services/instaboxApi';
import { loadDesktopPrefs, saveDesktopPrefs, type DesktopPrefs } from '../services/storage';

interface DesktopViewerProps {
  client: InstaboxClient;
  machine: Machine;
  onRefreshMachines?: () => Promise<void>;
}

const KEYSYMS: Record<string, number> = {
  Escape: 0xff1b,
  Tab: 0xff09,
  Enter: 0xff0d,
  Backspace: 0xff08,
  Delete: 0xffff,
  ArrowUp: 0xff52,
  ArrowDown: 0xff54,
  ArrowLeft: 0xff51,
  ArrowRight: 0xff53,
  Super_L: 0xffeb,
  Control_L: 0xffe3,
  Alt_L: 0xffe9,
  Shift_L: 0xffe1,
};

const RESOLUTION_PRESETS = [
  { label: '1280×720 (HD 16:9)', w: 1280, h: 720 },
  { label: '1600×720 (Handy Breit 20:9)', w: 1600, h: 720 },
  { label: '800×1280 (Handy Hochformat)', w: 800, h: 1280 },
  { label: '1920×1080 (Full HD)', w: 1920, h: 1080 },
  { label: '1024×768 (Kompakt 4:3)', w: 1024, h: 768 },
];

function charToKeysym(ch: string): number {
  const code = ch.codePointAt(0) || 0;
  if (code >= 0x20 && code <= 0xff) return code;
  return 0x01000000 + code;
}

export const DesktopViewer: React.FC<DesktopViewerProps> = ({
  client,
  machine,
  onRefreshMachines,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const vncMountRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const rfbRef = useRef<RFB | null>(null);

  const [prefs, setPrefs] = useState<DesktopPrefs>({
    scaleMode: 'fit',
    inputMode: 'trackpad',
    qualityLevel: 6,
    autoTakeover: true,
    preferredResolution: '1280x720',
  });

  const [statusText, setStatusText] = useState<string>('Prüfe Desktop-Status…');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hostUnreachable, setHostUnreachable] = useState<boolean>(false);
  const [restartingBox, setRestartingBox] = useState<boolean>(false);
  const [desktopState, setDesktopState] = useState<DesktopState | null>(null);

  // Remote framebuffer size & local container size
  const [fbSize, setFbSize] = useState<{ w: number; h: number }>({ w: 1280, h: 720 });
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 360, h: 240 });

  // Pinch-zoom & pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Virtual Trackpad cursor in framebuffer coordinates
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 640, y: 360 });
  const cursorRef = useRef<{ x: number; y: number }>({ x: 640, y: 360 });
  const [dragLocked, setDragLocked] = useState<boolean>(false);
  const dragLockedRef = useRef<boolean>(false);

  // UI overlays
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [showKeyBar, setShowKeyBar] = useState<boolean>(true);
  const [showResMenu, setShowResMenu] = useState<boolean>(false);
  const [shareInfo, setShareInfo] = useState<{ url: string; expiresAt: string; viewOnly: boolean } | null>(null);
  const [humanControl, setHumanControl] = useState<boolean>(true);
  const [keyboardOpen, setKeyboardOpen] = useState<boolean>(false);

  useEffect(() => {
    loadDesktopPrefs().then((p) => setPrefs(p));
  }, []);

  const updatePrefs = useCallback((patch: Partial<DesktopPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveDesktopPrefs(next);
      return next;
    });
  }, []);

  // Measure outer stage accurately on resize & phone rotation
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 20 && cr.height > 20) {
          setStageSize({ w: cr.width, h: cr.height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen, showKeyBar]);

  // Compute exact Fit scale so the whole remote desktop always fits without cropping
  const fitScale = Math.min(stageSize.w / fbSize.w, stageSize.h / fbSize.h);
  const baseScale = prefs.scaleMode === 'native' ? 1 : fitScale;
  const effectiveScale = Math.max(0.15, baseScale * zoom);

  const clampPan = useCallback(
    (nx: number, ny: number, z: number) => {
      const s = (prefs.scaleMode === 'native' ? 1 : Math.min(stageSize.w / fbSize.w, stageSize.h / fbSize.h)) * z;
      const scaledW = fbSize.w * s;
      const scaledH = fbSize.h * s;
      const maxX = Math.max(0, (scaledW - stageSize.w) / 2 + 24);
      const maxY = Math.max(0, (scaledH - stageSize.h) / 2 + 24);
      return {
        x: Math.max(-maxX, Math.min(maxX, nx)),
        y: Math.max(-maxY, Math.min(maxY, ny)),
      };
    },
    [fbSize.h, fbSize.w, prefs.scaleMode, stageSize.h, stageSize.w],
  );

  // Sync framebuffer dimensions from noVNC canvas
  useEffect(() => {
    if (!connected) return;
    const id = window.setInterval(() => {
      const rfb = rfbRef.current;
      const cw = rfb?._fbWidth || rfb?._canvas?.width;
      const ch = rfb?._fbHeight || rfb?._canvas?.height;
      if (cw && ch && (cw !== fbSize.w || ch !== fbSize.h)) {
        setFbSize({ w: cw, h: ch });
        cursorRef.current = {
          x: Math.min(cw - 1, Math.max(0, cursorRef.current.x)),
          y: Math.min(ch - 1, Math.max(0, cursorRef.current.y)),
        };
        setCursor({ ...cursorRef.current });
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [connected, fbSize.h, fbSize.w]);

  // Human takeover heartbeat every 20s when active
  useEffect(() => {
    if (!connected || !humanControl) return;
    client.desktopAction(machine.id, 'takeover').catch(() => {});
    const timer = window.setInterval(() => {
      client.desktopAction(machine.id, 'takeover').catch(() => {});
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [client, connected, humanControl, machine.id]);

  const disconnectVnc = useCallback(() => {
    if (rfbRef.current) {
      try {
        rfbRef.current.disconnect();
      } catch {
        // ignore
      }
      rfbRef.current = null;
    }
    setConnected(false);
  }, []);

  const connectDesktop = useCallback(async () => {
    if (machine.state !== 'running') {
      setErrorMsg(`Maschine ist "${machine.state}". Bitte zuerst starten oder fortsetzen.`);
      return;
    }

    disconnectVnc();
    setConnecting(true);
    setErrorMsg(null);
    setHostUnreachable(false);

    try {
      setStatusText('Prüfe Desktop-Dienst…');
      let st = await client.desktopAction(machine.id, 'status');
      setDesktopState(st);

      if (!st.installed) {
        setStatusText('Installiere Desktop-Pakete (ca. 30 Sek.)…');
        await client.desktopAction(machine.id, 'install');
        for (let i = 0; i < 45; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          st = await client.desktopAction(machine.id, 'status');
          setDesktopState(st);
          if (st.installed || st.failed) break;
        }
        if (st.failed) {
          throw new Error(st.log || 'Desktop-Installation fehlgeschlagen.');
        }
      }

      const [prefW, prefH] = (prefs.preferredResolution || '1280x720').split('x').map(Number);
      if (!st.running) {
        setStatusText(`Starte Linux-Desktop (${prefW || 1280}×${prefH || 720})…`);
        st = await client.desktopAction(machine.id, 'start', {
          width: prefW || 1280,
          height: prefH || 720,
        });
        setDesktopState(st);
      }

      if (prefs.autoTakeover) {
        setHumanControl(true);
        await client.desktopAction(machine.id, 'takeover').catch(() => {});
      }

      setStatusText('Hole VNC-Zugangsticket…');
      const ticket = await client.createAccessTicket(machine.id, 'vnc');
      const protocols: string[] = [];
      if (ticket.protocol) protocols.push(ticket.protocol);
      if (ticket.token) protocols.push(`instabox-access-token.${ticket.token}`);

      if (!vncMountRef.current) return;
      vncMountRef.current.innerHTML = '';

      setStatusText('Verbinde mit VNC-Stream…');
      const rfb = new RFB(vncMountRef.current, ticket.url, {
        wsProtocols: protocols.length > 0 ? protocols : undefined,
      });

      // Disable noVNC's internal scaling because our outer stage handles Fit + PinchZoom + Trackpad with exact math!
      rfb.scaleViewport = false;
      rfb.clipViewport = false;
      rfb.resizeSession = false;
      rfb.focusOnClick = false;
      rfb.viewOnly = false;
      rfb.qualityLevel = prefs.qualityLevel;
      rfb.compressionLevel = 2;
      rfb.background = '#09090b';

      rfb.addEventListener('connect', () => {
        setConnecting(false);
        setConnected(true);
        setStatusText('Verbunden');
        const cw = rfb._fbWidth || rfb._canvas?.width || prefW || 1280;
        const ch = rfb._fbHeight || rfb._canvas?.height || prefH || 720;
        setFbSize({ w: cw, h: ch });
        cursorRef.current = { x: Math.round(cw / 2), y: Math.round(ch / 2) };
        setCursor({ ...cursorRef.current });
      });

      rfb.addEventListener('disconnect', (ev: Event) => {
        const clean = (ev as CustomEvent<{ clean?: boolean }>).detail?.clean;
        setConnected(false);
        setConnecting(false);
        setStatusText(clean ? 'Getrennt' : 'Verbindung unterbrochen');
      });

      rfb.addEventListener('clipboard', (ev: Event) => {
        const text = (ev as CustomEvent<{ text?: string }>).detail?.text;
        if (text) {
          Clipboard.write({ string: text }).catch(() => {});
        }
      });

      rfbRef.current = rfb;
    } catch (err) {
      setConnecting(false);
      setConnected(false);
      const rawMsg = err instanceof Error ? err.message : String(err);
      const errCode = (err as { code?: string })?.code || '';
      const isHostDown =
        errCode === 'host_unavailable' ||
        /machine unreachable|host_unavailable/i.test(rawMsg) ||
        machine.runtime?.ready === false;
      setHostUnreachable(isHostDown);
      setErrorMsg(
        isHostDown
          ? `Maschine "${machine.name}" nicht erreichbar (HTTP 503 host_unavailable · runtime.ready=false)`
          : rawMsg,
      );
    }
  }, [client, disconnectVnc, machine.id, machine.name, machine.runtime?.ready, machine.state, prefs.autoTakeover, prefs.preferredResolution, prefs.qualityLevel]);

  const handleColdRestart = useCallback(async () => {
    setRestartingBox(true);
    setErrorMsg(null);
    try {
      await client.restartMachine(machine.id);
      await onRefreshMachines?.();
      await connectDesktop();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRestartingBox(false);
    }
  }, [client, connectDesktop, machine.id, onRefreshMachines]);

  useEffect(() => {
    if (machine.state === 'running') {
      connectDesktop();
    }
    return () => disconnectVnc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine.id, machine.state]);

  // ---- Low-level VNC Mouse & Key Helpers -----------------------------------------------------

  const sendPointer = useCallback((x: number, y: number, mask: number) => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    const cx = Math.max(0, Math.min(fbSize.w - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(fbSize.h - 1, Math.round(y)));
    rfb._handleMouseMove?.(cx, cy);
    rfb._handleMouseButton?.(cx, cy, mask);
  }, [fbSize.h, fbSize.w]);

  const movePointerOnly = useCallback((x: number, y: number) => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    const cx = Math.max(0, Math.min(fbSize.w - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(fbSize.h - 1, Math.round(y)));
    if (dragLockedRef.current) {
      rfb._handleMouseButton?.(cx, cy, 0x1);
    } else {
      rfb._handleMouseMove?.(cx, cy);
    }
  }, [fbSize.h, fbSize.w]);

  const clickButton = useCallback(
    (mask: number, atX?: number, atY?: number) => {
      const tx = atX ?? cursorRef.current.x;
      const ty = atY ?? cursorRef.current.y;
      sendPointer(tx, ty, mask);
      window.setTimeout(() => {
        sendPointer(tx, ty, dragLockedRef.current ? 0x1 : 0);
      }, 35);
    },
    [sendPointer],
  );

  const clientPointToFb = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const outer = outerRef.current;
      if (!outer) return cursorRef.current;
      const rect = outer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2 + pan.x;
      const centerY = rect.top + rect.height / 2 + pan.y;
      const dx = (clientX - centerX) / effectiveScale;
      const dy = (clientY - centerY) / effectiveScale;
      return {
        x: Math.max(0, Math.min(fbSize.w - 1, Math.round(fbSize.w / 2 + dx))),
        y: Math.max(0, Math.min(fbSize.h - 1, Math.round(fbSize.h / 2 + dy))),
      };
    },
    [effectiveScale, fbSize.h, fbSize.w, pan.x, pan.y],
  );

  // ---- Unified Mobile Touch & Mouse Gesture Engine -------------------------------------------

  const touchStateRef = useRef<{
    mode: 'none' | 'one' | 'two';
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    moved: boolean;
    longPressFired: boolean;
    longPressTimer: number | null;
    initialPinchDist: number;
    initialZoom: number;
    initialPanX: number;
    initialPanY: number;
    twoMidX: number;
    twoMidY: number;
    scrollAccumY: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    moved: false,
    longPressFired: false,
    longPressTimer: null,
    initialPinchDist: 0,
    initialZoom: 1,
    initialPanX: 0,
    initialPanY: 0,
    twoMidX: 0,
    twoMidY: 0,
    scrollAccumY: 0,
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!connected) return;
    const ts = touchStateRef.current;
    if (ts.longPressTimer) {
      window.clearTimeout(ts.longPressTimer);
      ts.longPressTimer = null;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      ts.mode = 'one';
      ts.startX = t.clientX;
      ts.startY = t.clientY;
      ts.lastX = t.clientX;
      ts.lastY = t.clientY;
      ts.startTime = Date.now();
      ts.moved = false;
      ts.longPressFired = false;

      if (prefs.inputMode === 'direct') {
        const pt = clientPointToFb(t.clientX, t.clientY);
        cursorRef.current = pt;
        setCursor(pt);
        movePointerOnly(pt.x, pt.y);

        ts.longPressTimer = window.setTimeout(() => {
          if (!ts.moved && ts.mode === 'one') {
            ts.longPressFired = true;
            clickButton(0x4, pt.x, pt.y); // Right-click on long press
          }
        }, 480);
      }
    } else if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      ts.mode = 'two';
      ts.moved = false;
      ts.startTime = Date.now();
      ts.initialPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      ts.initialZoom = zoom;
      ts.initialPanX = pan.x;
      ts.initialPanY = pan.y;
      ts.twoMidX = (t0.clientX + t1.clientX) / 2;
      ts.twoMidY = (t0.clientY + t1.clientY) / 2;
      ts.scrollAccumY = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!connected) return;
    const ts = touchStateRef.current;

    if (ts.mode === 'one' && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - ts.lastX;
      const dy = t.clientY - ts.lastY;
      const totalDist = Math.hypot(t.clientX - ts.startX, t.clientY - ts.startY);
      if (totalDist > 6) {
        ts.moved = true;
        if (ts.longPressTimer) {
          window.clearTimeout(ts.longPressTimer);
          ts.longPressTimer = null;
        }
      }

      if (prefs.inputMode === 'trackpad') {
        const speed = Math.min(2.6, Math.max(1.15, Math.hypot(dx, dy) * 0.14)) / Math.max(0.5, effectiveScale);
        const nx = Math.max(0, Math.min(fbSize.w - 1, cursorRef.current.x + dx * speed));
        const ny = Math.max(0, Math.min(fbSize.h - 1, cursorRef.current.y + dy * speed));
        cursorRef.current = { x: nx, y: ny };
        setCursor({ x: Math.round(nx), y: Math.round(ny) });
        movePointerOnly(nx, ny);
      } else {
        const pt = clientPointToFb(t.clientX, t.clientY);
        cursorRef.current = pt;
        setCursor(pt);
        sendPointer(pt.x, pt.y, 0x1);
      }

      ts.lastX = t.clientX;
      ts.lastY = t.clientY;
    } else if (ts.mode === 'two' && e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;

      const pinchRatio = ts.initialPinchDist > 10 ? dist / ts.initialPinchDist : 1;
      if (Math.abs(dist - ts.initialPinchDist) > 14 || zoom > 1.02) {
        ts.moved = true;
        const nextZoom = Math.max(1, Math.min(4.5, ts.initialZoom * pinchRatio));
        const nextPan = clampPan(
          ts.initialPanX + (midX - ts.twoMidX),
          ts.initialPanY + (midY - ts.twoMidY),
          nextZoom,
        );
        setZoom(nextZoom);
        setPan(nextPan);
      } else {
        // 2-finger parallel vertical slide = remote mouse scroll wheel!
        const deltaMidY = midY - ts.twoMidY;
        if (Math.abs(deltaMidY) > 10) {
          ts.moved = true;
          ts.scrollAccumY += deltaMidY;
          ts.twoMidY = midY;
          if (Math.abs(ts.scrollAccumY) >= 18) {
            const wheelMask = ts.scrollAccumY < 0 ? 0x10 : 0x8;
            clickButton(wheelMask);
            ts.scrollAccumY = 0;
          }
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (!connected) return;
    const ts = touchStateRef.current;
    if (ts.longPressTimer) {
      window.clearTimeout(ts.longPressTimer);
      ts.longPressTimer = null;
    }

    const elapsed = Date.now() - ts.startTime;
    if (ts.mode === 'one') {
      if (!ts.moved && !ts.longPressFired && elapsed < 350) {
        clickButton(0x1);
      } else if (prefs.inputMode === 'direct' && ts.moved) {
        sendPointer(cursorRef.current.x, cursorRef.current.y, 0);
      }
    } else if (ts.mode === 'two' && !ts.moved && elapsed < 300) {
      // 2-finger quick tap = Right Click!
      clickButton(0x4);
    }

    ts.mode = 'none';
  };

  // Desktop mouse support (for Arena Web Preview & Chromebook/Tablet mice!)
  const mouseDownRef = useRef<number>(0);
  const handleMouseMoveDesktop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!connected) return;
    const pt = clientPointToFb(e.clientX, e.clientY);
    cursorRef.current = pt;
    setCursor(pt);
    sendPointer(pt.x, pt.y, mouseDownRef.current);
  };
  const handleMouseDownDesktop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!connected) return;
    e.preventDefault();
    const pt = clientPointToFb(e.clientX, e.clientY);
    cursorRef.current = pt;
    setCursor(pt);
    const mask = e.button === 2 ? 0x4 : e.button === 1 ? 0x2 : 0x1;
    mouseDownRef.current = mask;
    sendPointer(pt.x, pt.y, mask);
  };
  const handleMouseUpDesktop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!connected) return;
    const pt = clientPointToFb(e.clientX, e.clientY);
    mouseDownRef.current = 0;
    sendPointer(pt.x, pt.y, 0);
  };

  // ---- Keyboard & Shortcut Helpers -----------------------------------------------------------

  const tapKey = (keysym: number, code: string | null = null) => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    rfb.sendKey(keysym, code, true);
    rfb.sendKey(keysym, code, false);
  };

  const sendChord = (modSym: number, charOrSym: string | number) => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    const sym = typeof charOrSym === 'number' ? charOrSym : charToKeysym(charOrSym);
    rfb.sendKey(modSym, null, true);
    rfb.sendKey(sym, null, true);
    rfb.sendKey(sym, null, false);
    rfb.sendKey(modSym, null, false);
  };

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    for (const ch of val) {
      tapKey(charToKeysym(ch));
    }
    e.target.value = '';
  };

  const handleHiddenKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (KEYSYMS[e.key]) {
      e.preventDefault();
      tapKey(KEYSYMS[e.key], e.code);
    }
  };

  const applyMatchScreenResolution = async () => {
    if (!connected) return;
    // Compute crisp mobile-friendly resolution matching the exact stage aspect ratio
    const ratio = stageSize.w / Math.max(1, stageSize.h);
    let targetW = 1280;
    let targetH = 720;
    if (ratio >= 1) {
      targetH = 720;
      targetW = Math.min(2048, Math.max(960, Math.round((720 * ratio) / 16) * 16));
    } else {
      targetW = 768;
      targetH = Math.min(1600, Math.max(960, Math.round((768 / ratio) / 16) * 16));
    }
    setStatusText(`Passe Desktop auf ${targetW}×${targetH} an…`);
    updatePrefs({ scaleMode: 'fit', preferredResolution: `${targetW}x${targetH}` });
    setZoom(1);
    setPan({ x: 0, y: 0 });
    await client.resizeDesktopDisplay(machine.id, targetW, targetH).catch(() => {});
  };

  const applyPresetResolution = async (w: number, h: number) => {
    setShowResMenu(false);
    updatePrefs({ preferredResolution: `${w}x${h}`, scaleMode: 'fit' });
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (connected) {
      await client.resizeDesktopDisplay(machine.id, w, h).catch(() => {});
    }
  };

  const pasteFromPhoneClipboard = async () => {
    try {
      const { value } = await Clipboard.read();
      const text = value || (await navigator.clipboard.readText().catch(() => ''));
      if (text && rfbRef.current) {
        rfbRef.current.clipboardPasteFrom(text);
        sendChord(KEYSYMS.Control_L, 'v');
      }
    } catch {
      // ignore
    }
  };

  const saveScreenshot = () => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    const dataUrl = rfb.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `instabox-${machine.name}-${Date.now()}.png`;
    a.click();
  };

  const toggleHumanTakeover = async () => {
    const next = !humanControl;
    setHumanControl(next);
    await client.desktopAction(machine.id, next ? 'takeover' : 'handback').catch(() => {});
  };

  const createShareStream = async (viewOnly: boolean) => {
    try {
      const link = await client.createDesktopStreamLink(machine.id, viewOnly, 3600);
      setShareInfo({ ...link, viewOnly });
      await Clipboard.write({ string: link.url }).catch(() => {});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleDragLock = () => {
    const next = !dragLocked;
    dragLockedRef.current = next;
    setDragLocked(next);
    sendPointer(cursorRef.current.x, cursorRef.current.y, next ? 0x1 : 0);
  };

  return (
    <div
      className={`flex flex-col bg-zinc-950 select-none ${
        fullscreen ? 'fixed inset-0 z-50 safe-top safe-bottom' : 'h-full w-full'
      }`}
    >
      {/* Hidden input to summon native Android keyboard */}
      <input
        ref={hiddenInputRef}
        type="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={handleHiddenInputChange}
        onKeyDown={handleHiddenKeyDown}
        onFocus={() => setKeyboardOpen(true)}
        onBlur={() => setKeyboardOpen(false)}
        className="fixed -top-20 left-0 opacity-0 pointer-events-none w-1 h-1"
      />

      {/* Top Mobile Desktop Control Strip */}
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-zinc-900/95 border-b border-zinc-800 text-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-400' : connecting ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span className="font-medium text-zinc-200 whitespace-nowrap">
            {connected ? `${fbSize.w}×${fbSize.h}` : statusText}
          </span>
          {connected && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono">
              {Math.round(effectiveScale * 100)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Fit vs Match Screen vs Zoom */}
          <button
            onClick={() => {
              updatePrefs({ scaleMode: 'fit' });
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className={`px-2 py-1 rounded-md flex items-center gap-1 font-medium transition ${
              prefs.scaleMode === 'fit' && zoom === 1
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-300'
            }`}
            title="Desktop perfekt ins Display einpassen"
          >
            <Expand className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>

          <button
            onClick={applyMatchScreenResolution}
            disabled={!connected}
            className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 disabled:opacity-40"
            title="Linux-Auflösung exakt ans Handy-Seitenverhältnis anpassen"
          >
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            <span>Handy-Format</span>
          </button>

          {/* Resolution Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowResMenu((v) => !v)}
              className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Auflösung</span>
            </button>
          </div>

          {/* Input mode: Trackpad vs Direct Touch */}
          <button
            onClick={() =>
              updatePrefs({ inputMode: prefs.inputMode === 'trackpad' ? 'direct' : 'trackpad' })
            }
            className={`px-2 py-1 rounded-md flex items-center gap-1 font-medium ${
              prefs.inputMode === 'trackpad'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {prefs.inputMode === 'trackpad' ? (
              <>
                <Crosshair className="w-3.5 h-3.5" />
                <span>Trackpad</span>
              </>
            ) : (
              <>
                <Hand className="w-3.5 h-3.5" />
                <span>Touch</span>
              </>
            )}
          </button>

          {/* Zoom controls */}
          <button
            onClick={() => {
              const nz = Math.min(4.5, +(zoom + 0.4).toFixed(2));
              setZoom(nz);
            }}
            className="p-1.5 rounded-md bg-zinc-800 text-zinc-300"
            title="Hineinzoomen"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoom > 1.01 && (
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded-md bg-zinc-800 text-amber-300"
              title="Zoom zurücksetzen"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Takeover toggle */}
          <button
            onClick={toggleHumanTakeover}
            className={`p-1.5 rounded-md ${
              humanControl ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
            }`}
            title={humanControl ? 'Steuerung bei dir (Agent pausiert)' : 'Agent darf steuern'}
          >
            {humanControl ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={saveScreenshot}
            disabled={!connected}
            className="p-1.5 rounded-md bg-zinc-800 text-zinc-300 disabled:opacity-40"
            title="Screenshot speichern"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => createShareStream(true)}
            className="p-1.5 rounded-md bg-zinc-800 text-zinc-300"
            title="Desktop-Link teilen"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={connectDesktop}
            className="p-1.5 rounded-md bg-zinc-800 text-zinc-300"
            title="Neu verbinden"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setFullscreen((f) => !f)}
            className="p-1.5 rounded-md bg-zinc-800 text-emerald-300"
            title="Vollbild umschalten"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Resolution Picker Popover */}
      {showResMenu && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex flex-wrap gap-1.5 z-30">
          {RESOLUTION_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPresetResolution(p.w, p.h)}
              className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-zinc-200 border border-zinc-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Share Stream Banner */}
      {shareInfo && (
        <div className="bg-emerald-950/60 border-b border-emerald-800/60 px-3 py-1.5 text-xs flex items-center justify-between gap-2">
          <div className="truncate text-emerald-200">
            Stream-Link kopiert ({shareInfo.viewOnly ? 'Nur ansehen' : 'Interaktiv'}):{' '}
            <a href={shareInfo.url} target="_blank" rel="noreferrer" className="underline font-mono">
              {shareInfo.url}
            </a>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => createShareStream(false)}
              className="px-2 py-0.5 rounded bg-emerald-800/60 text-emerald-100"
            >
              Interaktiv
            </button>
            <button
              onClick={async () => {
                await client.revokeDesktopStreamLinks(machine.id).catch(() => {});
                setShareInfo(null);
              }}
              className="px-2 py-0.5 rounded bg-rose-900/70 text-rose-200"
            >
              Widerrufen
            </button>
            <button onClick={() => setShareInfo(null)} className="text-zinc-400 px-1">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Scaled Desktop Stage */}
      <div
        ref={outerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMoveDesktop}
        onMouseDown={handleMouseDownDesktop}
        onMouseUp={handleMouseUpDesktop}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex-1 w-full overflow-hidden bg-zinc-950 flex items-center justify-center touch-none"
      >
        {/* Scaled & Panned Framebuffer Box */}
        <div
          style={{
            width: `${fbSize.w}px`,
            height: `${fbSize.h}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`,
            transformOrigin: 'center center',
          }}
          className="relative shrink-0 shadow-2xl border border-zinc-800/80 bg-black pointer-events-none"
        >
          <div ref={vncMountRef} className="novnc-stage w-full h-full pointer-events-none" />

          {/* Precision Virtual Cursor in Trackpad Mode */}
          {connected && prefs.inputMode === 'trackpad' && (
            <div
              style={{
                left: `${cursor.x}px`,
                top: `${cursor.y}px`,
                transform: `translate(-3px, -3px) scale(${Math.max(0.75, 1 / effectiveScale)})`,
                transformOrigin: 'top left',
              }}
              className="absolute z-20 pointer-events-none"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                <path
                  d="M4 2L20 11L12 13L9 21L4 2Z"
                  fill={dragLocked ? '#f59e0b' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Loading / Disconnected State Overlay */}
        {(!connected || errorMsg) && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
            {connecting ? (
              <>
                <Loader2 className="w-9 h-9 text-emerald-400 animate-spin mb-3" />
                <p className="text-sm font-medium text-zinc-100">{statusText}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Desktop wird automatisch auf dein Smartphone skaliert…
                </p>
              </>
            ) : (
              <>
                <Monitor className="w-10 h-10 text-zinc-600 mb-3" />
                <p className="text-sm font-medium text-zinc-200 text-center max-w-sm">
                  {errorMsg || 'Desktop nicht verbunden'}
                </p>
                {hostUnreachable && (
                  <div className="mt-2.5 max-w-sm rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-[11px] text-amber-200 leading-relaxed text-left">
                    <strong>Diagnose (`host_unavailable`):</strong> Die VM ist gestartet, aber der physische InstaBox-Hostknoten antwortet dem InstaBox-Gateway aktuell nicht (`runtime.ready = false`). Falls auch ein Kalt-Neustart denselben Host trifft, liegt eine temporäre Host-Störung bei InstaBox vor – neue Boxen landen automatisch auf einem gesunden Host.
                  </div>
                )}
                {desktopState?.hint && (
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm">{desktopState.hint}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={connectDesktop}
                    disabled={restartingBox}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Desktop verbinden
                  </button>
                  {hostUnreachable && (
                    <button
                      onClick={handleColdRestart}
                      disabled={restartingBox}
                      className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-semibold text-xs flex items-center gap-1.5"
                    >
                      {restartingBox ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>{restartingBox ? 'Starte neu…' : 'Kalt-Neustart (Stop → Start)'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Mobile Mouse & Linux Keyboard Bar */}
      {showKeyBar && (
        <div className="bg-zinc-900 border-t border-zinc-800 px-2 py-1.5 flex flex-col gap-1.5">
          {/* Row 1: Mobile Mouse Buttons + Native Keyboard Trigger + Clipboard */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => {
                hiddenInputRef.current?.focus();
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shrink-0 ${
                keyboardOpen
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              }`}
            >
              <KeyboardIcon className="w-3.5 h-3.5" />
              <span>Tastatur</span>
            </button>

            <button
              onClick={() => clickButton(0x1)}
              className="px-2.5 py-1.5 rounded-md bg-zinc-800 active:bg-emerald-500/30 text-zinc-200 text-xs font-medium flex items-center gap-1 shrink-0"
            >
              <MousePointer className="w-3 h-3 text-emerald-400" />
              <span>Links</span>
            </button>

            <button
              onClick={() => clickButton(0x4)}
              className="px-2.5 py-1.5 rounded-md bg-zinc-800 active:bg-indigo-500/30 text-zinc-200 text-xs font-medium shrink-0"
            >
              Rechtsklick
            </button>

            <button
              onClick={toggleDragLock}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 ${
                dragLocked
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {dragLocked ? 'Ziehen aktiv' : 'Ziehen'}
            </button>

            <button
              onClick={() => clickButton(0x8)}
              className="px-2 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs shrink-0"
              title="Hochscrollen"
            >
              Scroll ↑
            </button>
            <button
              onClick={() => clickButton(0x10)}
              className="px-2 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs shrink-0"
              title="Runterscrollen"
            >
              Scroll ↓
            </button>

            <button
              onClick={pasteFromPhoneClipboard}
              className="px-2.5 py-1.5 rounded-md bg-zinc-800 text-zinc-200 text-xs flex items-center gap-1 shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
              <span>Paste</span>
            </button>
          </div>

          {/* Row 2: Essential Linux & Browser Shortcuts */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-mono">
            <button onClick={() => tapKey(KEYSYMS.Escape)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Esc
            </button>
            <button onClick={() => tapKey(KEYSYMS.Tab)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Tab
            </button>
            <button onClick={() => tapKey(KEYSYMS.Super_L)} className="px-2 py-1 rounded bg-zinc-800 text-sky-300 shrink-0">
              Super
            </button>
            <button onClick={() => sendChord(KEYSYMS.Control_L, 'l')} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Ctrl+L
            </button>
            <button onClick={() => sendChord(KEYSYMS.Control_L, 'c')} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Ctrl+C
            </button>
            <button onClick={() => sendChord(KEYSYMS.Control_L, 'v')} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Ctrl+V
            </button>
            <button onClick={() => sendChord(KEYSYMS.Alt_L, KEYSYMS.Tab)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Alt+Tab
            </button>
            <button onClick={() => tapKey(KEYSYMS.ArrowLeft)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              ←
            </button>
            <button onClick={() => tapKey(KEYSYMS.ArrowUp)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              ↑
            </button>
            <button onClick={() => tapKey(KEYSYMS.ArrowDown)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              ↓
            </button>
            <button onClick={() => tapKey(KEYSYMS.ArrowRight)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              →
            </button>
            <button onClick={() => tapKey(KEYSYMS.Backspace)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 shrink-0">
              Bksp
            </button>
            <button onClick={() => tapKey(KEYSYMS.Enter)} className="px-2.5 py-1 rounded bg-emerald-600/30 text-emerald-200 shrink-0">
              Enter
            </button>
          </div>
        </div>
      )}

      {fullscreen && (
        <button
          onClick={() => setShowKeyBar((s) => !s)}
          className="fixed bottom-2 right-2 z-50 px-2 py-1 rounded-full bg-zinc-900/80 border border-zinc-700 text-[10px] text-zinc-300"
        >
          {showKeyBar ? 'Leiste ↓' : 'Leiste ↑'}
        </button>
      )}
    </div>
  );
};
