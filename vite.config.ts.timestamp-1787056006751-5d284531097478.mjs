// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import fs from "fs";
import path from "path";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "selective-public-copy",
      apply: "build",
      writeBundle() {
        const publicDir = path.resolve(__vite_injected_original_dirname, "public");
        const distDir = path.resolve(__vite_injected_original_dirname, "dist");
        const filesToCopy = [
          "manifest.json",
          "sw.js",
          "icon.png",
          "icon-192x192.png",
          "icon-512x512.png",
          "icon-512x512-maskable.png",
          "wandlogo.png",
          "wandlogo_192x192.png",
          "wandlogo_512x512.png",
          "dip_caramel.png",
          "dip_cheese.png",
          "dip_honeymustard.png",
          "dip_hotsalsacheese.png",
          "dip_marinara.png"
        ];
        filesToCopy.forEach((file) => {
          const src = path.join(publicDir, file);
          const dest = path.join(distDir, file);
          try {
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
              console.log(`Copied ${file} to dist/`);
            }
          } catch (err) {
            console.warn(`Could not copy ${file}:`, err);
          }
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  publicDir: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "supabase": ["@supabase/supabase-js"],
          "editor": ["react-quill"]
        }
      }
    },
    chunkSizeWarningLimit: 1e3,
    cssCodeSplit: true,
    minify: "esbuild"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiAnc2VsZWN0aXZlLXB1YmxpYy1jb3B5JyxcbiAgICAgIGFwcGx5OiAnYnVpbGQnLFxuICAgICAgd3JpdGVCdW5kbGUoKSB7XG4gICAgICAgIGNvbnN0IHB1YmxpY0RpciA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMnKTtcbiAgICAgICAgY29uc3QgZGlzdERpciA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0Jyk7XG5cbiAgICAgICAgLy8gRmlsZXMgdG8gY29weSAoZXhjbHVkZSBwcm9ibGVtYXRpYyBmaWxlcylcbiAgICAgICAgY29uc3QgZmlsZXNUb0NvcHkgPSBbXG4gICAgICAgICAgJ21hbmlmZXN0Lmpzb24nLFxuICAgICAgICAgICdzdy5qcycsXG4gICAgICAgICAgJ2ljb24ucG5nJyxcbiAgICAgICAgICAnaWNvbi0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgJ2ljb24tNTEyeDUxMi5wbmcnLFxuICAgICAgICAgICdpY29uLTUxMng1MTItbWFza2FibGUucG5nJyxcbiAgICAgICAgICAnd2FuZGxvZ28ucG5nJyxcbiAgICAgICAgICAnd2FuZGxvZ29fMTkyeDE5Mi5wbmcnLFxuICAgICAgICAgICd3YW5kbG9nb181MTJ4NTEyLnBuZycsXG4gICAgICAgICAgJ2RpcF9jYXJhbWVsLnBuZycsXG4gICAgICAgICAgJ2RpcF9jaGVlc2UucG5nJyxcbiAgICAgICAgICAnZGlwX2hvbmV5bXVzdGFyZC5wbmcnLFxuICAgICAgICAgICdkaXBfaG90c2Fsc2FjaGVlc2UucG5nJyxcbiAgICAgICAgICAnZGlwX21hcmluYXJhLnBuZydcbiAgICAgICAgXTtcblxuICAgICAgICBmaWxlc1RvQ29weS5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgIGNvbnN0IHNyYyA9IHBhdGguam9pbihwdWJsaWNEaXIsIGZpbGUpO1xuICAgICAgICAgIGNvbnN0IGRlc3QgPSBwYXRoLmpvaW4oZGlzdERpciwgZmlsZSk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNyYykpIHtcbiAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKHNyYywgZGVzdCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDb3BpZWQgJHtmaWxlfSB0byBkaXN0L2ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBDb3VsZCBub3QgY29weSAke2ZpbGV9OmAsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIHB1YmxpY0RpcjogZmFsc2UsXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICdyZWFjdC12ZW5kb3InOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgICdzdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXG4gICAgICAgICAgJ2VkaXRvcic6IFsncmVhY3QtcXVpbGwnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxuICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ047QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLGNBQWM7QUFDWixjQUFNLFlBQVksS0FBSyxRQUFRLGtDQUFXLFFBQVE7QUFDbEQsY0FBTSxVQUFVLEtBQUssUUFBUSxrQ0FBVyxNQUFNO0FBRzlDLGNBQU0sY0FBYztBQUFBLFVBQ2xCO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFFQSxvQkFBWSxRQUFRLFVBQVE7QUFDMUIsZ0JBQU0sTUFBTSxLQUFLLEtBQUssV0FBVyxJQUFJO0FBQ3JDLGdCQUFNLE9BQU8sS0FBSyxLQUFLLFNBQVMsSUFBSTtBQUNwQyxjQUFJO0FBQ0YsZ0JBQUksR0FBRyxXQUFXLEdBQUcsR0FBRztBQUN0QixpQkFBRyxhQUFhLEtBQUssSUFBSTtBQUN6QixzQkFBUSxJQUFJLFVBQVUsSUFBSSxXQUFXO0FBQUEsWUFDdkM7QUFBQSxVQUNGLFNBQVMsS0FBSztBQUNaLG9CQUFRLEtBQUssa0JBQWtCLElBQUksS0FBSyxHQUFHO0FBQUEsVUFDN0M7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsRUFDMUI7QUFBQSxFQUNBLFdBQVc7QUFBQSxFQUNYLE9BQU87QUFBQSxJQUNMLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLGdCQUFnQixDQUFDLFNBQVMsV0FBVztBQUFBLFVBQ3JDLFlBQVksQ0FBQyx1QkFBdUI7QUFBQSxVQUNwQyxVQUFVLENBQUMsYUFBYTtBQUFBLFFBQzFCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLHVCQUF1QjtBQUFBLElBQ3ZCLGNBQWM7QUFBQSxJQUNkLFFBQVE7QUFBQSxFQUNWO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
