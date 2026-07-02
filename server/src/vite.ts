import { type Express } from "express";
import { type Server } from "http";
import fs from "fs";
import path from "path";

/**
 * Configura Vite en modo Middleware para desarrollo.
 * Esto permite que Express sirva el frontend de React con Hot Module Replacement (HMR).
 */
export async function setupVite(httpServer: Server, app: Express) {
  // Importar de manera dinámica para que no se requiera vite en producción
  const { createServer: createViteServer } = await import("vite");
  
  const clientPath = path.resolve(__dirname, "../../client");
  
  const vite = await createViteServer({
    configFile: path.resolve(clientPath, "vite.config.ts"),
    root: clientPath,
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer,
      },
    },
    appType: "custom",
  });

  // Usar los middlewares de Vite para interceptar peticiones del frontend
  app.use(vite.middlewares);

  // Servir el index.html transformado por Vite para soportar HMR e inyección de scripts
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      let template = fs.readFileSync(
        path.resolve(clientPath, "index.html"),
        "utf-8"
      );

      // Transformar el HTML inyectando el script de Vite HMR
      template = await vite.transformIndexHtml(url, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
