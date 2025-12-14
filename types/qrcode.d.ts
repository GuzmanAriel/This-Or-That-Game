declare module 'qrcode' {
  export function toDataURL(text: string, opts?: any): Promise<string>
  export function toCanvas(node: any, text: string, opts?: any): Promise<void>
}
