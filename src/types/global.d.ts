// Global type declarations for the Domus app

declare global {
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Timeout extends Timer {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Immediate extends Timer {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Interval extends Timer {}
    
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
      NEXT_PUBLIC_DEXIE_CLOUD_URL?: string
      NEXT_PUBLIC_DEXIE_USE_SERVICE_WORKER?: string
      NEXT_PUBLIC_DEXIE_REQUIRE_AUTH?: string
      NEXT_PUBLIC_DEXIE_UNSYNCED_TABLES?: string
      NEXT_PUBLIC_DEXIE_CUSTOM_LOGIN_GUI?: string
      BUILD_MODE?: string
      VERCEL?: string
      VERCEL_ENV?: string
      NEXT_TELEMETRY_DISABLED?: string
      NEXT_SHARP?: string
      NPM_CONFIG_CACHE?: string
      DEBUG?: string
      ANALYZE?: string
    }
  }

  // Process object para entornos Node.js y edge
  declare const process: {
    env: NodeJS.ProcessEnv
  }
}

export {}