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
  estado: 'activo' | 'inactivo' | 'moroso' | 'pendiente';
  rentaMensual?: number;          // renta mensual en pesos (denormalizado)
  avatar?: string;                // URL Storage
  rol: Rol;
  requiresAdminAuth?: boolean;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 2. habitaciones ──────────────────────────────────────────

export type TipoHabitacion = 'simple' | 'doble' | 'suite' | 'estudio';
export type EstadoHabitacion = 'disponible' | 'ocupada' | 'mantenimiento' | 'reservada';

export type PisoNombre = 'PB' | 'P1' | 'TP';
export type BanoAsignacion = 'libre' | 'Baño 1 PB' | 'Baño 2 PB' | 'Baño gris' | 'Baño marrón' | 'Baño terraza';
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
  modulosHabilitados?: {           // override por habitación (si undefined → usa config global)
    lavanderia?:     boolean;
    almacenamiento?: boolean;
    huespedExtra?:   boolean;
    visitas?:        boolean;
    facturacion?:    boolean;
  };
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

// ─── 6. tickets (soporte) ─────────────────────────────────────

export type CategoriaTicket =
  | 'internet'
  | 'pago'
  | 'reporte_limpieza'
  | 'reporte_inquilino'
  | 'lavadora'
  | 'almacenamiento'
  | 'mantenimiento';

export type SubcategoriaInternet      = 'senal_lenta' | 'sin_senal' | 'modem_roto';
export type SubcategoriaPago          = 'no_registrado' | 'paso_fecha' | 'comprobante_diferente' | 'otro';
export type SubcategoriaLimpieza      = 'bano_1_pb' | 'bano_2_pb' | 'bano_gris' | 'bano_marron' | 'bano_terraza' | 'cocina_pb' | 'cocina_tp' | 'area_comun' | 'pasillo';
export type SubcategoriaInquilino     = 'ruido' | 'basura' | 'mal_uso_areas' | 'agresion' | 'acoso' | 'sustancias' | 'visitas_no_registradas' | 'otro';
export type SubcategoriaLavadora      = 'se_paro' | 'faltan_prendas';
export type SubcategoriaAlmacenamiento= 'lugar_ocupado' | 'intentaron_abrir' | 'se_tomaron_cosas' | 'no_puedo_abrir';
export type SubcategoriaMantenimiento = 'sucia_rota_entrega' | 'retoque_pared' | 'humedad' | 'agua_turbia' | 'chapa_no_sirve' | 'ventana_rota' | 'puerta_no_cierra' | 'escusado' | 'closet' | 'otro';

export type SubcategoriaTicket =
  | SubcategoriaInternet
  | SubcategoriaPago
  | SubcategoriaLimpieza
  | SubcategoriaInquilino
  | SubcategoriaLavadora
  | SubcategoriaAlmacenamiento
  | SubcategoriaMantenimiento;

// Estados visibles al inquilino
export type EstadoTicket = 'en_revision' | 'en_proceso' | 'resuelto';

// Etiquetas internas admin (invisibles al inquilino)
export type EtiquetaTicket = 'mal_uso' | 'admin_cubre' | 'sin_culpa' | 'reportar_proveedor';

export interface Ticket {
  id: string;
  folio: string;                  // [UID6]_[hab]_[AAAAMMDD]_000000001
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero: string;
  inquilinoNombre: string;
  categoria: CategoriaTicket;
  subcategoria: SubcategoriaTicket;
  descripcion: string;            // texto libre (pago:otro, mantenimiento, etc.)
  sacasteRopa: boolean | null;    // solo lavadora:se_paro
  fotoUrl: string | null;
  estado: EstadoTicket;
  etiquetas: EtiquetaTicket[];    // admin only
  afectaScore: boolean;
  afectaExpediente: boolean;
  notasAdmin: string;
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

// ─── 8b. reservas_lavanderia ──────────────────────────────────

export type EstadoReserva =
  | 'pendiente'       // esperando confirmación automática 6 hrs
  | 'confirmada'      // confirmada por sistema o admin
  | 'pendiente_auth'  // cuenta con adeudo, requiere auth manual
  | 'cancelada'
  | 'completada';

export interface ReservaLavanderia {
  id: string;
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;
  inquilinoNombre?: string;
  fechaReserva: Timestamp;        // inicio programado
  duracionMin: number;            // 60 por defecto
  estado: EstadoReserva;
  esCargaExtra: boolean;          // supera las 3 incluidas/mes
  monto: number;                  // 0 si incluida · 150 si extra + IVA
  tieneAdeudo: boolean;
  adminAuthorizadoPor?: string;
  adminAuthorizadoEn?: Timestamp;
  recordatorioEnviado: boolean;
  notas?: string;
  creadoEn: Timestamp;
}

// ─── 9. almacenamiento ────────────────────────────────────────

export type EstadoAlmacenamiento = 'activo' | 'liberado';
// ─── 9b. espacios_almacenamiento ─────────────────────────────

export type TipoEspacio     = 'locker' | 'refrigerador';
export type EstadoEspacio   = 'libre'  | 'ocupado';
export type ModalidadEspacio = 'semanal' | 'mensual';

export interface EspacioAlmacenamiento {
  id: string;
  numero: number;               // 1–15
  tipo: TipoEspacio;
  estado: EstadoEspacio;
  inquilinoId: string | null;
  inquilinoNombre: string | null;
  habitacionNumero: string | null;
  modalidad: ModalidadEspacio | null;
  fechaInicio: Timestamp | null;
  fechaVencimiento: Timestamp | null;
  monto: number;                // con IVA incluido
  avisoEnviado: boolean;        // aviso 24 h antes de vencimiento
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

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

// ─── 10b. turnos_limpieza ────────────────────────────────────

export type AreaLimpieza =
  | 'bano_1_pb' | 'bano_2_pb'
  | 'bano_gris' | 'bano_marron' | 'bano_terraza'
  | 'cocina_pb' | 'cocina_tp'
  | 'pasillo' | 'escalera' | 'patio' | 'tendedero';

export type TipoAreaLimpieza = 'bano' | 'cocina' | 'area_comun';
export type EstadoTurno     = 'pendiente' | 'completado' | 'incumplimiento';

export interface TurnoLimpieza {
  id: string;
  area: AreaLimpieza;
  tipo: TipoAreaLimpieza;
  inquilinoId: string;
  inquilinoNombre: string;
  habitacionNumero: string;
  fechaProgramada: Timestamp;
  horaInicio: string;           // '08:00'
  estado: EstadoTurno;
  fotoUrl: string | null;
  fotoSubidaEn: Timestamp | null;
  privacidad: boolean;          // ocultar nombre en vista pública
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

export interface PermutaLimpieza {
  id: string;
  solicitanteId: string;
  solicitanteNombre: string;
  solicitanteHab: string;
  turnoOrigenId: string;
  turnoOrigenFecha: Timestamp;
  inquilinoDestinoId: string;
  inquilinoDestinoNombre: string;
  inquilinoDestinoHab: string;
  turnoDestinoId: string | null;
  estado: 'pendiente' | 'aprobada' | 'bloqueada';
  adminVio: boolean;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 10. noticias ─────────────────────────────────────────────

export type TipoNoticia = 'aviso' | 'mantenimiento' | 'pago' | 'evento' | 'regla' | 'general' | 'encuesta';
export type DuracionBanner   = '24h' | '1sem' | '1mes' | 'permanente';
export type DuracionEncuesta = '24h' | '48h' | '72h' | '1sem';

export interface OpcionEncuesta { id: string; texto: string; }

export interface Noticia {
  id: string;
  titulo: string;
  contenido: string;
  tipo: TipoNoticia;
  autorId: string;
  imagen?: string;
  archivo?: string;              // URL para adjunto de archivo
  activo: boolean;
  destacada: boolean;
  bannerFijado: boolean;
  duracion: DuracionBanner;
  pushObligatorio: boolean;
  encuesta?: {
    opciones: OpcionEncuesta[];
    duracion: DuracionEncuesta;
    votos: Record<string, number>;   // opcionId → count
    votosPor: string[];              // UIDs (no qué votaron)
    cierraEn: Timestamp;
  };
  destinatarios: 'todos' | string[];
  fechaPublicacion: Timestamp;
  fechaExpiracion: Timestamp | null;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

// ─── 11. chats ────────────────────────────────────────────────

export type TipoChat    = 'directo' | 'grupal' | 'soporte';
export type EstadoChat  = 'activo' | 'solicitado' | 'rechazado' | 'congelado';

export interface Chat {
  id: string;
  tipo: TipoChat;
  nombre?: string;
  participantes: string[];
  ultimoMensaje: string | null;
  ultimoMensajeEn: Timestamp | null;
  ultimoMensajePor: string | null;
  noLeidosPor: Record<string, number>;
  estado: EstadoChat;
  solicitadoPor?: string;        // UID para chats 'solicitado'
  strikeCount: number;           // 0–3
  congelado: boolean;
  restringidos: string[];        // UIDs con restricción silenciosa
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

export interface ReplyRef {
  msgId: string;
  autorNombre: string;
  texto: string;
}

export type TipoMensaje = 'texto' | 'imagen' | 'archivo' | 'sistema' | 'sticker';

export interface Mensaje {
  id: string;
  chatId: string;
  autorId: string;
  tipo: TipoMensaje;
  contenido: string;
  adjunto?: string;
  stickerUrl?: string;
  stickerId?: string;
  replyTo: ReplyRef | null;
  mencionados: string[];
  reacciones: Record<string, number>;  // emoji → count
  leidoPor: string[];
  editado: boolean;
  eliminado: boolean;
  archivadoEn: Timestamp | null;
  creadoEn: Timestamp;
}

// ─── 11b. restricciones / apelaciones ─────────────────────────

export interface Restriccion {
  id: string;
  uid: string;
  nombre: string;
  motivo?: string;
  aplicadaPor: string;
  creadoEn: Timestamp;
}

export type EstadoApelacion = 'pendiente' | 'aceptada' | 'rechazada' | 'ignorada';

export interface Apelacion {
  id: string;
  chatId: string;
  solicitanteId: string;
  solicitanteNombre: string;
  motivo: string;
  estado: EstadoApelacion;
  adminVio: boolean;
  resueltoEn: Timestamp | null;
  creadoEn: Timestamp;
}

// ─── 12. sesiones ─────────────────────────────────────────────

export interface Sesion {
  id: string;
  usuarioId: string;
  dispositivo: string;           // nombre legible: "iPhone (iOS 18)"
  dispositivoId: string;         // UUID por dispositivo (AsyncStorage)
  plataforma: 'ios' | 'android' | 'web';
  token: string;
  activa: boolean;
  // Ubicación
  ciudad?: string;
  alcaldia?: string;
  colonia?: string;
  calle?: string;
  cp?: string;
  pais?: string;
  lat?: number;
  lng?: number;
  // Seguridad
  reporteRobo: boolean;
  requiresAdminAuth: boolean;
  fechaInicio: Timestamp;
  fechaUltimaActividad: Timestamp;
  creadoEn: Timestamp;
}

export type TipoAlerta = 'dispositivo_nuevo' | 'reporte_robo';

export interface AlertaSeguridad {
  id: string;
  tipo: TipoAlerta;
  inquilinoId: string;
  inquilinoNombre: string;
  sesionId: string;
  dispositivo: string;
  dispositivoId: string;
  ubicacion: string;
  adminVio: boolean;
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
  // Cuota de limpieza
  cuotaLimpieza?: number;
  cuotaLimpiezaActiva?: boolean;
  // Módulos habilitables
  modulosHabilitados?: {
    lavanderia?: boolean;
    almacenamiento?: boolean;
    huespedExtra?: boolean;
    visitas?: boolean;
    facturacion?: boolean;
    scoreReputacion?: boolean;
  };
  // Documentos oficiales (URLs Storage)
  documentosOficiales?: {
    contratoUrl?: string;
    reglamentoUrl?: string;
    avisoPrivacidadUrl?: string;
    addendumUrl?: string;
  };
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

// ─── 18. expedientes ──────────────────────────────────────────

export type TipoDocExpediente =
  | 'INE_FRENTE' | 'INE_REVERSO' | 'CURP' | 'COMPROBANTE_DOMICILIO'
  | 'PRENDA_1_1' | 'PRENDA_1_2' | 'CONTRATO' | 'REGLAMENTO'
  | 'AVISO_PRIVACIDAD' | 'ADDENDUM_SERVICIOS' | 'CLAUSULA_CUPONES'
  | 'CONTRATO_MOBILIARIO';

export type EstadoDocExpediente =
  | 'pendiente'       // doc personal sin subir
  | 'subido'          // disponible (sin firma requerida)
  | 'rechazado'       // rechazado por admin
  | 'pendiente_firma' // plantilla disponible, requiere firma
  | 'firmado';        // firmado digitalmente

export interface DocumentoExpediente {
  id: string;
  tipo: TipoDocExpediente;
  nombre: string;
  url: string | null;
  estado: EstadoDocExpediente;
  descargas: number;
  maxDescargas: number;
  subidoEn: Timestamp | null;
  subidoPor: string | null;
  requiereFirma?: boolean;
  firmadoEn?: Timestamp | null;
}

// ─── documentosPlantillas ─────────────────────────────────────

export interface DocumentoPlantilla {
  tipo: string;           // 'contrato' | 'reglamento' | etc.
  nombre: string;
  nombreArchivo: string;
  storageRuta: string;    // 'documentos/plantillas/contrato_final_v5.docx'
  url: string;
  requiereFirma: boolean;
  version: string;
  subidoEn: Timestamp;
  subidoPor: string;
}

export interface ContactoEmergencia {
  id: string;
  nombre: string;
  edad: number;
  parentesco: string;
  telefono?: string;
  redesSociales?: string;
  direccion?: string;
}

export interface Mascota {
  id: string;
  nombre: string;
  especie: string;
  raza?: string;
  color?: string;
  edad?: string;
  vacunas?: string;
  curp?: string;
  senasParticulares?: string;
  comidaFavorita?: string;
  actividadFavorita?: string;
  temperamento?: 'dormilon' | 'activo';
  nivelRuido?: 'bajo' | 'medio' | 'alto';
  ritmo?: 'nocturno' | 'diurno';
  condicionParticular?: string;
  descripcion?: string;
}

export interface Expediente {
  id: string;
  inquilinoId: string;
  habitacionId: string | null;
  habitacionNumero: string | null;
  firmaDigital: string | null;  // JSON: Array<{x:number,y:number}[]>
  firmadoEn: Timestamp | null;
  notasAdmin: string;
  congelado: boolean;
  contactosEmergencia: ContactoEmergencia[];
  mascotas: Mascota[];
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
