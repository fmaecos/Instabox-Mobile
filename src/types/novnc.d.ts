declare module '@novnc/novnc' {
  export interface RFBOptions {
    shared?: boolean;
    credentials?: {
      username?: string;
      password?: string;
      target?: string;
    };
    repeaterID?: string;
    wsProtocols?: string[];
  }

  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, urlOrChannel: string | WebSocket, options?: RFBOptions);

    background: string;
    readonly capabilities: { power?: boolean };
    readonly clippingViewport: boolean;
    clipViewport: boolean;
    compressionLevel: number;
    dragViewport: boolean;
    focusOnClick: boolean;
    qualityLevel: number;
    resizeSession: boolean;
    scaleViewport: boolean;
    showDotCursor: boolean;
    viewOnly: boolean;

    // Internal noVNC properties used for precision mobile touch-to-framebuffer mapping
    _canvas?: HTMLCanvasElement;
    _fbWidth?: number;
    _fbHeight?: number;
    _mouseButtonMask?: number;
    _handleMouseMove?: (x: number, y: number) => void;
    _handleMouseButton?: (x: number, y: number, bmask: number) => void;

    approveServer(): void;
    blur(): void;
    clipboardPasteFrom(text: string): void;
    disconnect(): void;
    focus(options?: FocusOptions): void;
    getImageData(): ImageData;
    machineReboot(): void;
    machineReset(): void;
    machineShutdown(): void;
    sendCredentials(creds: { username?: string; password?: string; target?: string }): void;
    sendCtrlAltDel(): void;
    sendKey(keysym: number, code: string | null, down?: boolean): void;
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
    toDataURL(type?: string, encoderOptions?: number): string;
  }
}
