# Estándar de Programación y Buenas Prácticas (ESTANDAR_PROGRAMACION.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** ESTANDAR_PROGRAMACION.md<br>
**Estado:** Consolidado y Refinado en H04<br>
**Trazabilidad:** [../02-arquitectura/ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md) | [../02-arquitectura/MODELO_DATOS.md](../02-arquitectura/MODELO_DATOS.md) | [../04-seguridad/HARDENING.md](../04-seguridad/HARDENING.md) | [../../AGENTS.md](../../AGENTS.md)

---

## 1. Convenciones de TypeScript Estricto y Modelado de Dominio

Todo el código fuente del monorepo se desarrollará en TypeScript bajo modo estricto continuo.

### 1.1 Configuración Mandatoria del Compilador (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 1.2 Reglas de Tipado Estricto
- **Prohibición de `any`:** Prohibido el uso de `any`. En fronteras de entrada o APIs externas, tipar como `unknown` y validar en tiempo de ejecución mediante esquemas Zod antes de acceder a sus propiedades.
- **Tipado Explícito en Funciones Públicas:** Todo servicio, hook y función exportada debe declarar su tipo de retorno explícito.
- **Discriminadores y Tagged Unions:** Los estados de entidades deben modelarse como uniones etiquetadas exhaustivas para forzar validación en tiempo de compilación:
  ```typescript
  export type EstadoVenta = 'borrador' | 'completada' | 'pendiente_regularizacion' | 'anulada';
  export type EstadoPago = 'pendiente' | 'parcial' | 'total' | 'anulado';
  export type EstadoEntrega = 'retenido' | 'entregado_total' | 'entregado_saldo_pendiente';
  ```

### 1.3 Representación y Manejo de Dinero en Código
Para erradicar descalces y pérdida de precisión aritmética por coma flotante IEEE 754:
- En memoria y en SQLite local, los importes se manipulan estrictamente como **enteros en céntimos** (`type Centavos = number`).
- En Supabase (PostgreSQL), la representación canónica en base de datos es `NUMERIC(12,2)`.
- **Conversión Segura desde Cadenas:** Queda prohibido aplicar `Math.round(soles * 100)` directamente sobre tipos numéricos de punto flotante de JavaScript (vulnerables a errores de redondeo como `19.99 * 100 = 1998.9999999999998`). Toda entrada monetaria debe procesarse a partir de cadenas de texto validadas dividiendo parte entera y decimal:
  ```typescript
  export type Centavos = number & { readonly __brand: unique symbol };

  /**
   * Parsea de forma segura una cadena monetaria a céntimos enteros sin punto flotante.
   * Ejemplos válidos: "19.90" -> 1990, "5" -> 500, "0.50" -> 50, "120.5" -> 12050.
   */
  export const parseSolesToCentavos = (input: string): Result<Centavos, string> => {
    const clean = input.trim();
    const match = clean.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match || !match[1]) {
      return { ok: false, error: 'Formato numérico inválido. Ingrese un monto positivo con hasta 2 decimales.' };
    }
    const enteros = parseInt(match[1], 10);
    const decimalesRaw = match[2] ?? '';
    const decimales = parseInt(decimalesRaw.padEnd(2, '0'), 10);
    const totalCentavos = enteros * 100 + decimales;
    return { ok: true, value: totalCentavos as Centavos };
  };

  /**
   * Convierte céntimos enteros a cadena decimal exacta para persistencia en PostgreSQL o visualización.
   */
  export const toDecimalString = (centavos: Centavos): string => {
    const sign = centavos < 0 ? '-' : '';
    const abs = Math.abs(centavos);
    const enteros = Math.floor(abs / 100);
    const dec = (abs % 100).toString().padStart(2, '0');
    return `${sign}${enteros}.${dec}`;
  };

  export const formatMoneda = (centavos: Centavos): string =>
    `S/ ${toDecimalString(centavos)}`;
  ```

---

## 2. Organización Modular por Características (*Feature-Based*)

El proyecto adopta una estructura de monorepo orientada a dominios funcionales independientes (*Vertical Slices*).

### 2.1 Topología del Monorepo
```
proyecto-tienda/
├── apps/
│   ├── mobile/                  # Aplicación React Native + Expo (Android)
│   └── web/                     # Futuro panel administrativo React
├── packages/
│   ├── shared-types/            # Tipos de dominio, DTOs y contratos compartidos
│   ├── database/                # Esquemas SQLite, migraciones y repositorios base
│   ├── sync-engine/             # Motor outbox, idempotencia y resolución de conflictos
│   └── ui/                      # Componentes visuales y sistema de diseño compartido
```

### 2.2 Arquitectura Interna de Features (`features/[nombre]/`)
Cada módulo funcional (`ventas`, `caja`, `catalogo`, `proveedores`, `gastos`) se organiza en capas internas:
- `components/`: Componentes puramente presentacionales sin dependencias de base de datos.
- `hooks/`: Hooks de orquestación reactiva y estado local de pantalla.
- `services/`: Reglas de negocio puras, cálculos financieros y validaciones.
- `repositories/`: Clases de acceso a datos que encapsulan consultas SQL o llamadas Supabase.
- `schemas/`: Esquemas de validación Zod de entradas y formularios.
- `types/`: Tipos específicos e interfaces de la característica.

---

## 3. Convenciones para React Native y Expo

### 3.1 Componentes y Responsabilidades
- **Separación de Responsabilidades:** Los componentes reciben datos mediante props y emiten eventos mediante callbacks; no ejecutan consultas SQL ni mutaciones directas.
- **Renderizado Eficiente:** Evitar funciones flecha u objetos literales en bucles de render. Utilizar `useCallback` y `useMemo` en cálculos derivados complejos.
- **Virtualización de Listas:** Uso mandatorio de `@shopify/flash-list` para catálogos y transacciones de caja, con `estimatedItemSize` y `keyExtractor` unívoco basado en UUID v4.
- **Accesibilidad y Ergonomía:** Áreas táctiles con un tamaño mínimo de **48x48 dp** (`hitSlop`), contraste cromático WCAG AA y soporte de teclado numérico en mostrador.

---

## 4. Persistencia y Patrón Repositorio (SQLite y Supabase)

### 4.1 SQLite Local (`expo-sqlite`)
- **Parámetros Preparados Obligatorios:** Queda estrictamente prohibida la interpolación directa de variables en cadenas SQL. Todas las consultas deben usar parámetros enlazados (`?`):
  ```typescript
  await db.runAsync(
    'INSERT INTO ventas (id, sesion_caja_id, total_neto, ...) VALUES (?, ?, ?, ...)',
    [venta.id, venta.sesionCajaId, venta.totalNeto]
  );
  ```
- **Transacciones Atómicas Explícitas:** Las mutaciones compuestas (ej. venta + detalles + pago + outbox) deben ejecutarse de forma indivisible mediante `withTransactionAsync` o bloques `BEGIN IMMEDIATE ... COMMIT`:
  ```typescript
  await db.withTransactionAsync(async () => {
    await ventaRepo.insert(venta);
    await pagoRepo.insert(pago);
    await outboxRepo.enqueue(mutation);
  });
  ```
- **Durabilidad:** Transacciones financieras aplican `PRAGMA synchronous = FULL;` para garantizar persistencia física (*fsync*) en almacenamiento interno seguro.

### 4.2 Cliente Supabase Remoto
- **Tipado Fuerte Generado:** El cliente de Supabase debe instanciarse con los tipos generados de PostgreSQL: `createClient<Database>(url, anonKey)`.
- **Prohibición de Service Role Key:** En la aplicación cliente móvil solo se permite empaquetar `SUPABASE_ANON_KEY`. La `service_role_key` queda estrictamente vetada en el cliente ([SEC-SECR-002](../04-seguridad/HARDENING.md#26-protección-de-secretos-y-configuración-sec-secr)).
- **Funciones RPC:** Las llamadas a lógica de servidor deben invocarse mediante RPCs parametrizadas con validación de roles y control de privilegios.

---

## 5. Validación en Fronteras y Manejo de Errores

### 5.1 Esquemas Zod en Fronteras de Entrada
Toda entrada externa (formularios de usuario, resultados de escaneo de cámara OCR, payloads de sincronización) debe validarse con Zod:
```typescript
export const PagoSchema = z.object({
  id: z.string().uuid(),
  ventaId: z.string().uuid(),
  montoCéntimos: z.number().int().positive(),
  medioPago: z.enum(['efectivo', 'tarjeta_pos', 'billetera_digital']),
  idempotencyKey: z.string().length(64),
});
```

### 5.2 Patrón Result y Manejo de Excepciones
- Las funciones de negocio no deben arrojar excepciones no controladas para flujos esperados; retornan tipos `Result<T, E>`:
  ```typescript
  export type Result<T, E = Error> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };
  ```
- **Aislamiento de Errores Visuales:** *Error Boundaries* en la raíz y en pantallas principales para evitar cierres abruptos de la aplicación (*Crash Zero*).
- **Resiliencia de Red:** Las fallas de conexión nunca deben bloquear al usuario en mostrador; la mutación se persiste en SQLite y se encola en `sync_outbox`.

---

## 6. Estrategia de Pruebas Automatizadas

La calidad del software se valida mediante una pirámide de pruebas automatizadas:

| Nivel | Herramienta | Alcance y Objetivos |
| :--- | :--- | :--- |
| **Unitarias** | Vitest | Lógica financiera, cálculo de descuentos, conversiones monetarias, validación de saldos y motor de idempotencia. Cobertura mínima esperada: 85% en dominio. |
| **Integración** | React Native Testing Library + SQLite en memoria | Formularios de venta, pantallas de arqueo, persistencia local y manejo de estados offline sin dependencias de red. |
| **End-to-End (E2E)** | Maestro (Android) | Flujos operativos completos en dispositivo real o emulador: Apertura de turno -> Venta rápida con captura fotográfica -> Regularización -> Cierre y arqueo. |

---

## 7. Formato, Linting y Gestión de Versiones

- **ESLint & Prettier:** Configuración estricta en el monorepo (`printWidth: 100`, `tabWidth: 2`, `singleQuote: true`, `semi: true`, `trailingComma: 'all'`).
- **Verificación Pre-Commit:** Inspección obligatoria de `git diff --check`, tipado (`tsc --noEmit`) y pruebas unitarias antes de confirmar commits.
- **Conventional Commits:** Adhesión estricta a la convención (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **Sincronización Atómica Código-Documentación:** Cualquier modificación en entidades, esquemas, reglas o interfaces debe comitearse junto con la actualización de los documentos en `docs/`.
