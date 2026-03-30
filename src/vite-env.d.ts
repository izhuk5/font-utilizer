/// <reference types="vite/client" />

declare module 'wawoff2/compress' {
  function compress(buffer: Uint8Array): Promise<Uint8Array>
  export default compress
}
