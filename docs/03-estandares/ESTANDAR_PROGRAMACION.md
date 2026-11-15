# Estándar de Programación y Buenas Prácticas (ESTANDAR_PROGRAMACION.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda  
**Documento:** ESTANDAR_PROGRAMACION.md  
**Estado:** Vigente / Aprobado para H00  
**Trazabilidad:** [../02-arquitectura/ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md) | [../../AGENTS.md](../../AGENTS.md)

---

## 1. Convenciones de TypeScript

El proyecto exige el uso de TypeScript en modo estricto en todos los paquetes y aplicaciones:

### 1.1 Configuración de Compilación (`tsconfig.json`)
- `"strict": true`: Activación obligatoria de todas las comprobaciones estrictas de tipos (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictPropertyInitialization`).
- Prohibición del tipo `any`: No se permite el uso de `any` sin justificación técnica documentada con `// eslint-disable-next-line @typescript-eslint/no-explicit-any`. Para datos de origen incierto o APIs externas, utilizar `unknown` acompañado de validación en tiempo de ejecución (mediante esquemas `zod` o `valibot`).
- Tipado explícito de retornos: Todas las funciones públicas, métodos de servicios y custom hooks deben declarar explícitamente su tipo de retorno.

### 1.2 Inmutabilidad y Modelado de Datos
- Preferir `readonly` en arrays y propiedades de interfaces de dominio para evitar mutaciones accidentales del estado.
- Utilizar discriminadores explícitos (*Tagged Unions*) para representar estados complejos de negocio:
  ```typescript
  // Ejemplo de modelo de estado de pago tipado
  export type EstadoPago = 'pendiente' | 'parcial' | 'total' | 'anulado';

  export type ResultadoVenta =
    | { readonly ok: true; readonly ventaId: string; readonly totalNeto: number }
    | { readonly ok: false; readonly codigoError: string; readonly mensaje: string };
  ```

---

## 2. Convenciones para React Native y Expo

### 2.1 Componentes y Hooks
- Uso exclusivo de **Componentes Funcionales** con TypeScript (`React.FC` o tipado directo de props).
- La lógica de negocio, cálculos de ventas y llamadas a la base de datos local SQLite deben encapsularse en **Custom Hooks** o **Servicios de Dominio**, manteniendo los componentes visuales enfocados en la presentación.
- Manejo de ciclo de vida seguro con hooks estándar (`useEffect`, `useCallback`, `useMemo`). Todo efecto debe contar con función de limpieza (*cleanup function*) cuando suscriba listeners o tareas asíncronas.

### 2.2 Rendimiento en Dispositivos Móviles
- Evitar la creación de objetos, funciones anónimas o arrays en línea dentro de la propiedad `render` o en JSX en bucles de alta frecuencia.
- Uso mandatorio de listas virtualizadas optimizadas (`FlashList` o `FlatList`) con `keyExtractor` estable basado en UUID para catálogos y listas de ventas.
- Los elementos interactivos táctiles deben cumplir una superficie mínima accesible de **48x48 dp** para agilizar la interacción en mostrador.

### 2.3 Estilos y Tematización
- Mantener consistencia visual utilizando hojas de estilo compiladas o utilidades semánticas (`StyleSheet.create` o `Tailwind / NativeWind`).
- Centralizar constantes de diseño (paleta de colores, espaciados, tipografías) en el paquete de UI o tema compartido.

---

## 3. Convenciones para el Futuro Panel Web (React)

- Los componentes del panel web consumirán los mismos tipos de dominio desde `@tienda/shared-types`.
- Adhesión a los mismos principios de componentes funcionales y separación de responsabilidades.
- Uso de componentes accesibles (WAI-ARIA) y navegación clara orientada a teclado y ratón.

---

## 4. Nomenclatura y Estructura de Archivos

| Elemento | Convención | Ejemplo |
| :--- | :--- | :--- |
| **Componentes React / Screens** | `PascalCase` | `VentaMostradorScreen.tsx`, `BotonCobro.tsx` |
| **Custom Hooks** | `camelCase` con prefijo `use` | `useSesionCaja.ts`, `useVentaDetalle.ts` |
| **Servicios / Utilidades** | `camelCase` o `kebab-case` | `syncEngine.ts`, `calculoDescuentos.ts` |
| **Tipos e Interfaces** | `PascalCase` | `VentaHeader`, `DetalleItemVenta` |
| **Enums y Constantes** | `UPPER_SNAKE_CASE` | `ESTADOS_VENTA`, `MAX_INTENTOS_REINTENTO` |
| **Carpetas de módulos** | `kebab-case` o `camelCase` uniforme | `sync-engine/`, `shared-types/`, `screens/` |
| **Tablas y Columnas de Base de Datos** | `snake_case` | `sesiones_caja`, `monto_final_calculado` |

---

## 5. Formato y Calidad de Código (Linting & Formatting)

- **ESLint:** Configuración estricta basada en `@typescript-eslint/recommended`, `eslint-plugin-react` y `eslint-plugin-react-hooks`.
- **Prettier:** Formateo automático uniforme:
  - `printWidth: 100`
  - `tabWidth: 2`
  - `singleQuote: true`
  - `trailingComma: 'all'`
  - `semi: true`
- **Git Hooks (Previsto en H01):** Ejecución de linting y comprobación de tipos antes de cada commit mediante `husky` y `lint-staged`.

---

## 6. Estrategia de Pruebas Automatizadas

La confiabilidad del sistema de mostrador descansa en una pirámide de pruebas automatizadas:

```
          ▲
         / \     E2E / Flujos Completos (Maestro)
        /   \    (Detox / Maestro en Android)
       /─────\
      /       \   Integración / Componentes
     /         \  (React Native Testing Library + SQLite en memoria)
    /───────────\
   /             \ Pruebas Unitarias de Dominio
  /               \(Vitest / Jest: cálculos, sincronización, reglas)
 └─────────────────┘
```

1. **Pruebas Unitarias:**
   - Cobertura mandatoria sobre la lógica financiera: cálculo de totales, desglose de descuentos, cuadre de caja (arqueo teórico vs. declarado), y resolución de conflictos de sincronización.
2. **Pruebas de Componentes:**
   - Validar comportamiento de formularios de venta, validación de montos numéricos y bloqueo de interfaces en modo lectura.
3. **Pruebas de Resiliencia Offline:**
   - Pruebas automatizadas que simulan fallas de red durante transacciones de venta para comprobar que los datos persisten intactos en SQLite.

---

## 7. Manejo de Errores y Resiliencia

1. **Evitar pantallas blancas de error (*Crash Zero*):**
   - Implementar *Error Boundaries* en la raíz y en las secciones principales de la app móvil para aislar errores de renderizado.
2. **Patrón Result en lógica de negocio:**
   - Las operaciones de dominio susceptibles a fallos previsibles (p. ej. venta sin caja abierta, dinero insuficiente, producto no encontrado) deben retornar objetos tipados de resultado en lugar de arrojar excepciones no controladas.
3. **Manejo de Errores en Red y Sincronización:**
   - Ninguna excepción de red debe propagarse a la interfaz de usuario como un error bloqueante. Todo fallo de comunicación debe registrarse en la cola de reintentos (*Outbox*) con retroceso exponencial (*exponential backoff*).
4. **Registro de Auditoría Local:**
   - Los fallos graves deben registrarse en una tabla local de auditoría para permitir su diagnóstico técnico posterior sin comprometer datos confidenciales.
