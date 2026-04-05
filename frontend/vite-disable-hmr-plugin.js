// Plugin to completely disable Vite HMR client injection
export default function disableHMR() {
  return {
    name: 'disable-hmr',
    transformIndexHtml(html) {
      // Remove any @vite/client scripts
      return html.replace(/<script type="module" src="\/@vite\/client"><\/script>/g, '');
    },
    configureServer(server) {
      // Disable HMR WebSocket
      server.ws.close();
    },
  };
}
