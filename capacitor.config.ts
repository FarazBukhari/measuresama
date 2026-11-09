import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.foxysama.measuresama',
  appName: 'Measure Sama',
  webDir: 'dist',
  backgroundColor: '#F4F4F1',
  // WebView debugging follows the build type: on for debug builds (used by the emulator
  // tests in CI), off for release builds.
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
