// FIXED: Renombrado createRouter → getRouter
// El framework react-start@1.168.x llama routerEntry.getRouter() — nombre exacto obligatorio
// Ver: NOTAS-DIA4.md sección 4, nota sobre router.tsx
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
