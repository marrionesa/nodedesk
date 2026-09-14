import net from "node:net";

/**
 * Busca el primer puerto TCP libre en el rango `[start, end]`.
 * Derivado de `state.rs::allocate_port` de V1 (pool 3011–3099), generalizado
 * a un rango arbitrario.
 *
 * Resuelve `null` si no hay ningún puerto libre en el rango.
 */
export function findFreePort(
  start = 3011,
  end = 3099,
  host = "127.0.0.1"
): Promise<number | null> {
  return new Promise((resolve) => {
    const tryPort = (port: number): void => {
      if (port > end) {
        resolve(null);
        return;
      }
      const server = net.createServer();
      server.unref();
      server.once("error", () => tryPort(port + 1));
      server.listen(port, host, () => {
        server.close(() => resolve(port));
      });
    };
    void tryPort(start);
  });
}

/**
 * Reserva un puerto libre y lo mantiene ocupado hasta que se llame
 * `release()`. Útil para asignar puertos a proyectos antes de arrancarlos.
 */
export interface PortLease {
  port: number;
  release(): Promise<void>;
}

export async function leaseFreePort(
  start = 3011,
  end = 3099,
  host = "127.0.0.1"
): Promise<PortLease | null> {
  const port = await findFreePort(start, end, host);
  if (port === null) return null;

  const server = net.createServer();
  server.unref();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  return {
    port,
    release: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      })
  };
}
