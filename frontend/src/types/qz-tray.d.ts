declare module 'qz-tray' {
  export interface QzConfigOptions {
    size?: { width?: number | null; height?: number | null };
    units?: 'in' | 'mm' | 'cm' | 'pixel';
    margins?: number | { top?: number; right?: number; bottom?: number; left?: number };
    colorType?: 'color' | 'grayscale' | 'blackwhite';
    copies?: number;
    rotation?: number;
    orientation?: 'portrait' | 'landscape' | 'reverse-landscape';
    scaleContent?: boolean;
    density?: number | string;
    rasterize?: boolean;
    altPrinting?: boolean;
    encoding?: string;
    spool?: { size?: number };
    [key: string]: any;
  }

  export interface QzPrintData {
    type: 'pixel' | 'raw' | 'pdf' | 'image';
    format?: 'html' | 'image' | 'pdf' | 'plain' | 'command' | 'hex' | 'base64';
    flavor?: 'plain' | 'file';
    data: any;
    options?: Record<string, any>;
    [key: string]: any;
  }

  export interface QzWebsocket {
    isActive(): boolean;
    connect(options?: any): Promise<void>;
    disconnect(): Promise<void>;
    getConnectionInfo(): any;
    getNetworkInfo(): any;
    setErrorCallbacks(callback: (err: any) => void): void;
    setClosedCallbacks(callback: (evt: any) => void): void;
  }

  export interface QzPrinters {
    getDefault(): Promise<string>;
    find(query?: string): Promise<string | string[]>;
    details(): Promise<any>;
    getStatus(printer: string): Promise<any>;
  }

  export interface QzConfigs {
    create(printer: string | object, options?: QzConfigOptions): any;
    setDefaults(options: QzConfigOptions): void;
  }

  export interface QzSecurity {
    setCertificatePromise(promiseFn: (resolve: (cert: string) => void, reject: (err: any) => void) => void): void;
    setSignaturePromise(promiseFn: (toSign: string) => (resolve: (sig: string) => void, reject: (err: any) => void) => void): void;
  }

  export interface QzStatic {
    websocket: QzWebsocket;
    printers: QzPrinters;
    configs: QzConfigs;
    security: QzSecurity;
    print(config: any, data: any[]): Promise<void>;
    version: string;
    [key: string]: any;
  }

  const qz: QzStatic;
  export default qz;
}
