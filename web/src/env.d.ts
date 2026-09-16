/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_IMAGE_BASE_URL?: string
  readonly VITE_API_PROXY?: string
  readonly VITE_BASE_PATH?: string
}

declare const __BUILD_TIME__: string
