// ../client/vite.config.ts
import { defineConfig } from "file:///C:/Users/ivanj/Documents/auth-gateway/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ivanj/Documents/auth-gateway/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import tailwindcss from "file:///C:/Users/ivanj/Documents/auth-gateway/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///C:/Users/ivanj/Documents/auth-gateway/node_modules/autoprefixer/lib/autoprefixer.js";
var __vite_injected_original_dirname = "C:\\Users\\ivanj\\Documents\\auth-gateway\\client";
var vite_config_default = defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(__vite_injected_original_dirname, "tailwind.config.ts") }),
        autoprefixer()
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  // Configuración de build: la salida va a dist/ del cliente
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY2xpZW50L3ZpdGUuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcaXZhbmpcXFxcRG9jdW1lbnRzXFxcXGF1dGgtZ2F0ZXdheVxcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGl2YW5qXFxcXERvY3VtZW50c1xcXFxhdXRoLWdhdGV3YXlcXFxcY2xpZW50XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9pdmFuai9Eb2N1bWVudHMvYXV0aC1nYXRld2F5L2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJ0YWlsd2luZGNzc1wiO1xyXG5pbXBvcnQgYXV0b3ByZWZpeGVyIGZyb20gXCJhdXRvcHJlZml4ZXJcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIGNzczoge1xyXG4gICAgcG9zdGNzczoge1xyXG4gICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgdGFpbHdpbmRjc3MoeyBjb25maWc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwidGFpbHdpbmQuY29uZmlnLnRzXCIpIH0pLFxyXG4gICAgICAgIGF1dG9wcmVmaXhlcigpLFxyXG4gICAgICBdLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIC8vIENvbmZpZ3VyYWNpXHUwMEYzbiBkZSBidWlsZDogbGEgc2FsaWRhIHZhIGEgZGlzdC8gZGVsIGNsaWVudGVcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiBcImRpc3RcIixcclxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxyXG4gICAgc291cmNlbWFwOiB0cnVlLFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtVLFNBQVMsb0JBQW9CO0FBQy9WLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxrQkFBa0I7QUFKekIsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLEtBQUs7QUFBQSxJQUNILFNBQVM7QUFBQSxNQUNQLFNBQVM7QUFBQSxRQUNQLFlBQVksRUFBRSxRQUFRLEtBQUssUUFBUSxrQ0FBVyxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsUUFDckUsYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixXQUFXO0FBQUEsRUFDYjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
