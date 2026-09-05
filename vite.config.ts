import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Serve directory index files under /apps/.
 * Vite's SPA fallback would otherwise answer "/apps/cyberchef/" with the React
 * app instead of the static page in public/apps/cyberchef/index.html.
 */
function appsDirectoryIndex(): Plugin {
  return {
    name: "apps-directory-index",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/apps\/([^?#]*\/)?(\?|#|$)/.test(req.url)) {
          const [path, rest] = req.url.split(/(?=[?#])/);
          req.url = `${path}index.html${rest ?? ""}`;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), appsDirectoryIndex()],
  server: { host: "0.0.0.0", port: 5173, allowedHosts: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
