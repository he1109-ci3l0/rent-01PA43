import { Timestamp } from 'firebase/firestore';

// ─── Compartidos ───────────────────────────────────────────────

export type EstadoGeneral = 'activo' | 'inactivo' | 'archivado';
export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
export type TipoDocumento = 'CC' | 'CE' | 'PP' | 'TI' | 'NIT' | 'otro';
export type MetodoPago = 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'tarjeta' | 'otro';
export type Rol = 'admin' | 'inquilino';

// ─── 1. inquilinos ────────────────────────────────────────────

export interface Inquilino {
  id: string;
  uid: string;                    // Firebase Auth UID
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documentoTipo: TipoDocumento;
  documentoNumero: string;
  habitacionId: string | null;
  fechaIngreso: Timestamp | null;
  fechaSalida: Timestamp | null;
  estado: 'activo' | 'inactivo' | 'moroso';
  avatar?: string;                // URL Storage
  rol: Rol;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 2. habitaciones ──────────────────────────────────────────

export type TipoHabitacion = 'simple' | 'doble' | 'suite' | 'estudio';
export type EstadoHabitacion = 'disponible' | 'ocupada' | 'mantenimiento' | 'reservada';

export type PisoNombre = 'PB' | 'P1' | 'TP';
export type BanoAsignacion = 'libre' | 'Baño gris' | 'Baño marrón' | 'Baño terraza';
export type CocinaAsignacion = 'CocinaPB' | 'CocinaTP';

export interface Habitacion {
  id: string;
  numero: string;                  // '01'–'14'
  piso: number;                    // 0=PB  1=P1  2=TP
  pisoNombre: PisoNombre;
  tipo: TipoHabitacion;
  tamano: string;                  // 'Pequeña' | 'Mediana' | 'Grande' | …
  estado: EstadoHabitacion;
  precioMensual: number;
  precioDeposito: number;
  precioAlSalir?: number;          // precio cuando deja el inquilino actual (hab 13)
  precioRemodelado?: number;       // precio si se activa módulo remodelación (hab 03)
  area: number;                    // m²
  amenidades: string[];
  fotos: string[];                 // URLs Storage
  descripcion?: string;
  bano: BanoAsignacion;
  cocina: CocinaAsignacion;
  habilitada: boolean;             // false = slot inhabitado (015–045)
  moduloRemodelacion?: boolean;    // hab 03: activable desde admin
  remodelacionActiva?: boolean;    // estado actual del módulo
  inquilinoId: string | null;
  inquilinoNombre?: string;        // denormalizado para display rápido
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 3. pagos ─────────────────────────────────────────────────

export type EstadoPago =
  | 'pendiente'      // sin comprobante
  | 'en_revision'    // comprobante subido, esperando admin
  | 'pagado'         // verificado por admin
  | 'rechazado'      // comprobante rechazado por admin
  | 'vencido'        // venció sin pagar (>3 días gracia)
  | 'parcial'
  | 'anulado';

export type ConceptoPago = 'arriendo' | 'deposito' | 'servicio' | 'multa' | 'lavanderia' | 'almacenamiento' | 'otro';
export type ModalidadPago = 'mensual' | 'semanal';

export interface Pago {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  inquilinoNombre?: string;       // denormalizado para vistas admin
  habitacionNumero?: string;      // denormalizado para vistas admin
  facturaId: string | null;
  monto: number;
  montoPagado: number;
  concepto: ConceptoPago;
  modalidad: ModalidadPago;
  descripcion?: string;
  fechaVencimiento: Timestamp;
  fechaPago: Timestamp | null;
  estado: EstadoPago;
  metodoPago: MetodoPago | null;
  // Comprobante
  comprobante?: string;           // URL Storage
  comprobanteSubidoEn?: Timestamp;
  // Verificación admin (límite 120 hrs móvil)
  verificadoPor?: string;
  verificadoEn?: Timestamp;
  rechazadoPor?: string;
  rechazadoEn?: Timestamp;
  rechazadoRazon?: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── Score de reputación ──────────────────────────────────────

export type NivelScore = 'pesimo' | 'moroso' | 'regular' | 'bueno' | 'excelente';

export interface ScoreReputacion {
  id: string;
  inquilinoId: string;
  nivel: NivelScore;
  puntos: number;                 // 0–100
  ajusteManual: boolean;
  ajustadoPor?: string;           // UID admin
  ajustadoEn?: Timestamp;
  ultimaActualizacion: Timestamp;
}

// ─── 4. huespedes_extra ───────────────────────────────────────

export type SemanaIngreso  = 1 | 2 | 3 | 4;
export type EstadoHuesped  = 'pendiente_auth' | 'activo' | 'incorporado' | 'inactivo';
export type ModalidadHuesped = 'temporal' | 'mensual';

export interface HuespedExtra {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;          // denormalizado
  inquilinoNombre?: string;           // denormalizado
  nombre: string;
  apellido: string;
  documentoTipo: TipoDocumento;
  documentoNumero: string;
  parentesco?: string;
  fotoIne?: string;                   // URL Storage
  fechaEntrada: Timestamp;
  fechaSalida: Timestamp | null;
  activo: boolean;
  // ── módulo de cobros ──────────────────────────────────────────
  semanaIngreso: SemanaIngreso;
  modalidad: ModalidadHuesped;
  estado: EstadoHuesped;
  montoSemana: number;                // cobro del período actual
  montoMensual: number;               // equivalente mensual (+$500)
  promoOfrecida: boolean;
  promoAceptada: boolean | null;      // null = no ha decidido
  promoTimestamp: Timestamp | null;
  requiereAuth: boolean;              // semanas 2 y 3
  adminAuthorizadoPor: string | null;
  adminAuthorizadoEn: Timestamp | null;
  adminNotas?: string;
  incorporadoExpediente: boolean;
  creadoEn: Timestamp;
}

// ─── 5. visitas ───────────────────────────────────────────────

export type EstadoEstacionaria =
  | 'normal'
  | 'alerta_40h'
  | 'alerta_50h'
  | 'cargo_72h'
  | 'deposito_102h';

export interface Visita {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;
  inquilinoNombre?: string;
  nombreVisitante?: string;
  documentoTipo: TipoDocumento;
  documentoNumero: string;
  telefono?: string;
  motivo?: string;
  fechaEntrada: Timestamp;
  fechaSalida: Timestamp | null;
  registradoPor: string;
  esRecurrente: boolean;
  estadoEstacionaria: EstadoEstacionaria;
  cargoEstacionaria: number | null;
  cargoEstacionariaPagado: boolean;
  rutaElegida: 'A' | 'B' | null;
  perfilTemporalCreado: boolean;
  creadoEn: Timestamp;
}

// ─── 6. tickets ───────────────────────────────────────────────

export type EstadoTicket = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado' | 'rechazado';
export type CategoriaTicket = 'plomeria' | 'electrico' | 'gas' | 'internet' | 'muebles' | 'limpieza' | 'seguridad' | 'otro';

export interface Ticket {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaTicket;
  prioridad: Prioridad;
  estado: EstadoTicket;
  fotos: string[];                // URLs Storage
  asignadoA: string | null;      // UID del técnico/admin
  notasAdmin?: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  resueltoEn: Timestamp | null;
}

// ─── 7. limpieza ──────────────────────────────────────────────

export type TipoLimpieza = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'salida' | 'ingreso';
export type EstadoLimpieza = 'programada' | 'en_progreso' | 'completada' | 'cancelada';

export interface Limpieza {
  id: string;
  habitacionId: string;
  tipo: TipoLimpieza;
  estado: EstadoLimpieza;
  fechaProgramada: Timestamp;
  fechaInicio: Timestamp | null;
  fechaCompletada: Timestamp | null;
  personal: string[];             // UIDs del personal
  notas?: string;
  fotos: string[];                // URLs Storage — antes/después
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 8. lavanderia ────────────────────────────────────────────

export type EstadoLavanderia = 'solicitada' | 'recibida' | 'en_proceso' | 'lista' | 'entregada' | 'cancelada';

export interface ItemLavanderia {
  descripcion: string;
  cantidad: number;
  precio: number;
}

export interface Lavanderia {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  items: ItemLavanderia[];
  total: number;
  estado: EstadoLavanderia;
  fechaSolicitud: Timestamp;
  fechaEntrega: Timestamp | null;
  notas?: string;
  pagado: boolean;
  pagoId: string | null;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 9. almacenamiento ────────────────────────────────────────

export type EstadoAlmacenamiento = 'activo' | 'liberado';

export interface Almacenamiento {
  id: string;
  inquilinoId: string;
  descripcion: string;
  ubicacion: string;              // ej: "Bodega 3 - Estante B"
  fotos: string[];                // URLs Storage
  fechaIngreso: Timestamp;
  fechaSalida: Timestamp | null;
  estado: EstadoAlmacenamiento;
  precioMensual: number;
  pagoId: string | null;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 10. noticias ─────────────────────────────────────────────

export type TipoNoticia = 'aviso' | 'mantenimiento' | 'pago' | 'evento' | 'regla' | 'general';

export interface Noticia {
  id: string;
  titulo: string;
  contenido: string;
  tipo: TipoNoticia;
  autorId: string;               // UID admin
  imagen?: string;               // URL Storage
  activo: boolean;
  destacada: boolean;
  destinatarios: 'todos' | string[]; // UIDs o 'todos'
  fechaPublicacion: Timestamp;
  fechaExpiracion: Timestamp | null;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 11. chats ────────────────────────────────────────────────

export type TipoChat = 'directo' | 'grupal' | 'soporte';

export interface Chat {
  id: string;
  tipo: TipoChat;
  nombre?: string;               // para grupos
  participantes: string[];       // UIDs
  ultimoMensaje: string | null;
  ultimoMensajeEn: Timestamp | null;
  ultimoMensajePor: string | null;
  noLeidosPor: Record<string, number>; // uid → cantidad no leídos
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// Sub-colección: chats/{chatId}/mensajes
export type TipoMensaje = 'texto' | 'imagen' | 'archivo' | 'sistema';

export interface Mensaje {
  id: string;
  chatId: string;
  autorId: string;
  tipo: TipoMensaje;
  contenido: string;
  adjunto?: string;              // URL Storage
  leidoPor: string[];            // UIDs
  editado: boolean;
  eliminado: boolean;
  creadoEn: Timestamp;
}

// ─── 12. sesiones ─────────────────────────────────────────────

export interface Sesion {
  id: string;
  usuarioId: string;             // UID
  dispositivo: string;           // modelo del teléfono
  plataforma: 'ios' | 'android' | 'web';
  token: string;                 // FCM push token
  activa: boolean;
  fechaInicio: Timestamp;
  fechaUltimaActividad: Timestamp;
  creadoEn: Timestamp;
}

// ─── 13. facturas ─────────────────────────────────────────────

export type EstadoFactura = 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'anulada';

export interface ItemFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Factura {
  id: string;
  numero: string;                // ej: "FAC-2026-001"
  inquilinoId: string;
  habitacionId: string;
  items: ItemFactura[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  estado: EstadoFactura;
  fechaEmision: Timestamp;
  fechaVencimiento: Timestamp;
  pagadaEn: Timestamp | null;
  notas?: string;
  pdfUrl?: string;               // URL Storage
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 14. configuracion ────────────────────────────────────────
// Documento único: configuracion/global

export interface ConfiguracionPagos {
  diaCorteMensual: number;       // día del mes para generar cobros
  diasGracia: number;
  porcentajeMultaMora: number;   // %
  metodosHabilitados: MetodoPago[];
}

export interface DatosFiscalesEmisor {
  razonSocial: string;
  rfc: string;
  regimenFiscal: string;
  domicilioFiscal: string;
  codigoPostal: string;
  email: string;
}

export interface Configuracion {
  id: 'global';
  nombrePropiedad: string;
  direccion: string;
  telefono: string;
  email: string;
  nit?: string;
  logo?: string;                 // URL Storage
  reglas: string[];
  pagos: ConfiguracionPagos;
  notificacionesActivas: boolean;
  modoMantenimiento: boolean;
  // Emisores CFDI (configurables desde admin)
  emisorFisico?: DatosFiscalesEmisor;   // Persona física RESICO, exento IVA
  emisorEmpresa?: DatosFiscalesEmisor;  // Empresa con IVA 16%
  actualizadoEn: Timestamp;
  actualizadoPor: string;        // UID admin
}

// ─── 15. solicitudes_factura ──────────────────────────────────

export type ConceptoFacturaCFDI = 'renta' | 'lavanderia' | 'almacenamiento' | 'todo';
export type EstadoSolicitudFactura = 'pendiente' | 'procesando' | 'emitida' | 'rechazada' | 'eliminada';
export type EmisorFacturaCFDI = 'fisica' | 'empresa';

export interface DatosFiscalesInquilino {
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  domicilioFiscal: string;
  codigoPostal: string;
  emailFiscal: string;
}

export interface SolicitudFactura {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;
  inquilinoNombre?: string;
  concepto: ConceptoFacturaCFDI;
  emisor: EmisorFacturaCFDI;
  mes: number;                   // 1–12
  anio: number;
  estado: EstadoSolicitudFactura;
  datosFiscales: DatosFiscalesInquilino;
  pdfUrl?: string;
  descargasRestantes: number;    // máx 3 para inquilino
  adminSubidoPor?: string;
  adminSubidoEn?: Timestamp;
  eliminadaEn?: Timestamp;
  notas?: string;
  creadoEn: Timestamp;
}

// ─── 16. cupones ──────────────────────────────────────────────

export type TipoCupon = 'monto' | 'porcentaje';
export type ConceptoCupon = 'renta' | 'servicios' | 'total';
export type ErrorCupon = 'vencido' | 'agotado' | 'no_aplica' | 'no_disponible' | 'invalido';

export interface Cupon {
  id: string;
  nombre: string;
  codigo: string;
  tipo: TipoCupon;
  valor: number;
  concepto: ConceptoCupon;
  disponible: boolean;
  reutilizable: boolean;
  limiteUsos: number | null;
  usosActuales: number;
  vigenciaInicio: Timestamp;
  vigenciaFin: Timestamp;
  eligibilidad: 'todos' | string[];  // 'todos' o array de habitacionIds
  apilable: boolean;
  creadoEn: Timestamp;
}

export interface CuponUso {
  id: string;
  cuponId: string;
  cuponCodigo: string;
  inquilinoId: string;
  habitacionId: string;
  pagoId?: string;
  montoDescuento: number;
  conceptoAplicado: ConceptoCupon;
  usadoEn: Timestamp;
}
