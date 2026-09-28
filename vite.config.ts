import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
// lovable-tagger is a dev-only tool and is not a production dependency, so it is
// loaded lazily and only in development mode. This keeps production builds
// (e.g. the Docker image) working without the package installed.
export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [react()];

  if (mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    plugins.push(componentTagger());
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins,
    build: {
      // Keep heavyweight visualization libraries out of the initial app
      // chunk. Routes already lazy-load dashboard sections; these explicit
      // vendor boundaries keep charts, maps and PDF export independently
      // cacheable and prevent one dashboard from delaying every route.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("echarts")) return "vendor-charts";
            if (id.includes("leaflet") || id.includes("react-leaflet")) return "vendor-maps";
            if (id.includes("jspdf")) return "vendor-pdf";
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
  };
});
