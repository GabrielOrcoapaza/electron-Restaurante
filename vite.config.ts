import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import * as fs from 'node:fs'
import * as path from 'node:path'

function writeAppConfigPlugin(mode: string): Plugin {
  return {
    name: 'write-app-config',
    closeBundle() {
      const env = loadEnv(mode, process.cwd(), '')
      const config = {
        graphqlUrl: env.VITE_GRAPHQL_URL || '',
        wsUrl: env.VITE_WS_URL || '',
      }
      const distDir = path.resolve(process.cwd(), 'dist')
      const outPath = path.join(distDir, 'app-config.json')
      // 🔥 FIX CLAVE
      fs.mkdirSync(distDir, { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf-8')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    writeAppConfigPlugin(mode),
  ],
}))
