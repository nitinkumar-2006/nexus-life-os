import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Explicit IPv4 loopback, not the default 'localhost' - Node resolves
    // the string 'localhost' to IPv6 (::1) first on this machine, so Vite
    // was only ever binding there. That's invisible for normal browsing
    // (Chrome falls back to IPv6 automatically when you type "localhost"),
    // but Spotify's OAuth redirect_uri must now use the literal 127.0.0.1
    // IPv4 address (Spotify's dashboard no longer accepts "localhost" as a
    // redirect host at all - see streamingConfig.js), and a request to
    // that literal IPv4 address was getting ERR_CONNECTION_REFUSED because
    // nothing was actually listening on it. Binding to 127.0.0.1 directly
    // fixes that without needing 0.0.0.0 (which would also expose the dev
    // server to the local network, unnecessary here).
    host: '127.0.0.1',
    watch: {
      usePolling: true,
    },
  },
})