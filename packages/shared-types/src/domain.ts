/**
 * @tienda/shared-types - domain.ts
 * Contratos y tipos de dominio base del Sistema de Gestión de Librería.
 * Trazabilidad: MODELO_DATOS.md, REGLAS_NEGOCIO.md, SRS.md
 */

export type RolUsuario = 'administrador' | 'dueno' | 'vendedor';

export type EstadoVenta = 'borrador' | 'completada' | 'pendiente_regularizacion' | 'anulada';

export type EstadoPago = 'pendiente' | 'parcial' | 'total' | 'anulado';

export type EstadoEntrega = 'retenido' | 'entregado_total' | 'entregado_saldo_pendiente';

export type EstadoRegularizacion = 'no_aplica' | 'pendiente' | 'completada';

export type EstadoCaja =
  | 'abierta'
  | 'cierre_provisorio_offline'
  | 'pendiente_conciliacion'
  | 'conciliado_conforme'
  | 'conciliado_con_diferencia';

export type MedioPago = 'efectivo' | 'tarjeta_pos' | 'billetera_digital' | 'transferencia_bancaria';

export type TipoVenta = 'normal' | 'rapida';

export type TipoMovimientoCaja =
  | 'ingreso_venta'
  | 'egreso_gasto'
  | 'egreso_abono_proveedor'
  | 'retiro_propietario'
  | 'ingreso_extra'
  | 'ajuste_sobrante'
  | 'ajuste_faltante';

export interface BaseEntity {
  readonly id: string; // UUID v4
  readonly createdAt: string; // ISO-8601 UTC
  readonly updatedAt?: string;
  readonly deletedAt?: string | null;
}

export interface Usuario extends BaseEntity {
  readonly authId: string;
  readonly rol: RolUsuario;
  readonly nombre: string;
  readonly email: string;
  readonly activo: boolean;
}
