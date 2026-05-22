import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, Modal, Pressable, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Mensaje } from '@/types/firestore';

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🙌', '🔥', '✅', '💯', '👀'];

function formatHora(ts: any): string {
  try {
    return ts.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// Resalta @menciones en el texto
function TextoConMenciones({ texto }: { texto: string }) {
  const partes = texto.split(/(@\S+)/g);
  return (
    <Text style={styles.contenidoText}>
      {partes.map((p, i) =>
        p.startsWith('@')
          ? <Text key={i} style={styles.mencionText}>{p}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

interface Props {
  mensaje: Mensaje;
  esPropio: boolean;
  esAdmin?: boolean;
  nombreAutor: string;
  onReply: (m: Mensaje) => void;
  onReaccion: (msgId: string, emoji: string) => void;
  onEliminar: (msgId: string) => void;
}

export default function MensajeCard({
  mensaje, esPropio, esAdmin = false, nombreAutor,
  onReply, onReaccion, onEliminar,
}: Props) {

  const [menuVisible, setMenuVisible] = useState(false);

  // ── Mensaje eliminado ─────────────────────────────────────────
  if (mensaje.eliminado) {
    return (
      <View style={[styles.row, esPropio ? styles.rowEnd : styles.rowStart]}>
        <Text style={styles.eliminadoText}>🚫 Mensaje eliminado</Text>
      </View>
    );
  }

  // ── Mensaje de sistema ────────────────────────────────────────
  if (mensaje.tipo === 'sistema') {
    return (
      <View style={styles.sistemaWrap}>
        <Text style={styles.sistemaText}>{mensaje.contenido}</Text>
      </View>
    );
  }

  const tieneReacciones = Object.keys(mensaje.reacciones ?? {}).length > 0;

  return (
    <>
      <TouchableOpacity
        style={[styles.row, esPropio ? styles.rowEnd : styles.rowStart]}
        onLongPress={() => setMenuVisible(true)}
        activeOpacity={0.85}
        delayLongPress={350}
      >
        <View style={[styles.bubbleCol, esPropio && styles.bubbleColReverse]}>

          {/* Nombre del autor (solo si no es propio) */}
          {!esPropio && (
            <Text style={styles.autorNombre}>{nombreAutor}</Text>
          )}

          {/* Reply preview */}
          {mensaje.replyTo && (
            <View style={[styles.replyPreview, esPropio && styles.replyPreviewOwn]}>
              <View style={styles.replyBar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyAutor}>{mensaje.replyTo.autorNombre}</Text>
                <Text style={styles.replyTexto} numberOfLines={1}>{mensaje.replyTo.texto}</Text>
              </View>
            </View>
          )}

          {/* Burbuja */}
          <View style={[styles.bubble, esPropio ? styles.bubbleOwn : styles.bubbleOther]}>
            {mensaje.tipo === 'sticker' && mensaje.stickerUrl ? (
              <Image source={{ uri: mensaje.stickerUrl }} style={styles.sticker} resizeMode="contain" />
            ) : (
              <TextoConMenciones texto={mensaje.contenido} />
            )}
          </View>

          {/* Hora + estado */}
          <Text style={[styles.hora, esPropio && styles.horaOwn]}>{formatHora(mensaje.creadoEn)}</Text>

          {/* Reacciones */}
          {tieneReacciones && (
            <View style={styles.reaccionesRow}>
              {Object.entries(mensaje.reacciones).map(([emoji, count]) =>
                count > 0 ? (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reaccionChip}
                    onPress={() => onReaccion(mensaje.id, emoji)}
                  >
                    <Text style={styles.reaccionEmoji}>{emoji}</Text>
                    <Text style={styles.reaccionCount}>{count}</Text>
                  </TouchableOpacity>
                ) : null
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Menú de opciones (long press) */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBox}>
            {/* Emoji picker */}
            <View style={styles.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={styles.emojiBtn}
                  onPress={() => { onReaccion(mensaje.id, e); setMenuVisible(false); }}
                >
                  <Text style={styles.emoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.menuDivider} />
            {/* Opciones */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { onReply(mensaje); setMenuVisible(false); }}
            >
              <Ionicons name="return-down-back-outline" size={18} color={cartasBosque.tinta} />
              <Text style={styles.menuItemText}>Responder</Text>
            </TouchableOpacity>
            {esAdmin && (
              <TouchableOpacity
                style={[styles.menuItem, { marginTop: 2 }]}
                onPress={() => { onEliminar(mensaje.id); setMenuVisible(false); }}
              >
                <Ionicons name="trash-outline" size={18} color="#960018" />
                <Text style={[styles.menuItemText, { color: '#960018' }]}>Eliminar mensaje</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row:     { paddingHorizontal: spacing[4], marginBottom: spacing[1] },
  rowStart:{ alignItems: 'flex-start' },
  rowEnd:  { alignItems: 'flex-end' },

  bubbleCol:        { maxWidth: '80%', alignItems: 'flex-start' },
  bubbleColReverse: { alignItems: 'flex-end' },

  autorNombre: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: cartasBosque.musgo,
    marginBottom: 2, marginLeft: 2,
  },

  bubble: {
    borderRadius: borderRadius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    maxWidth: '100%',
  },
  bubbleOwn:   { backgroundColor: cartasBosque.bosque, borderBottomRightRadius: borderRadius.sm },
  bubbleOther: { backgroundColor: cartasBosque.pergamino, borderBottomLeftRadius: borderRadius.sm,
                  borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },

  contenidoText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta, lineHeight: 20,
  },
  mencionText: { color: cartasBosque.musgo, fontFamily: 'DMSans_600SemiBold' },

  hora:    { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginTop: 2, marginLeft: 2 },
  horaOwn: { textAlign: 'right', marginRight: 2 },

  sticker: { width: 140, height: 140 },

  replyPreview: {
    flexDirection: 'row', gap: spacing[1],
    backgroundColor: cartasBosque.niebla + '44',
    borderRadius: borderRadius.sm, padding: spacing[2],
    marginBottom: 2, maxWidth: '100%',
    borderTopLeftRadius: borderRadius.sm,
  },
  replyPreviewOwn: { backgroundColor: cartasBosque.bosque + '44' },
  replyBar:  { width: 3, borderRadius: 2, backgroundColor: cartasBosque.bosque },
  replyAutor:{ fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: cartasBosque.bosque },
  replyTexto:{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho },

  reaccionesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  reaccionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  reaccionEmoji: { fontSize: 12 },
  reaccionCount: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  eliminadoText: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.niebla,
    fontStyle: 'italic', paddingHorizontal: spacing[4], marginBottom: spacing[1],
  },

  sistemaWrap: { alignItems: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[6] },
  sistemaText: {
    fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho,
    textAlign: 'center', lineHeight: 16,
  },

  // Menú
  menuOverlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuBox: {
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl,
    padding: spacing[4], width: '85%',
    shadowColor: '#122A1F', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  emojiRow:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing[2] },
  emojiBtn:  { padding: spacing[1] + 1 },
  emoji:     { fontSize: 24 },
  menuDivider: { height: 1, backgroundColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[2] },
  menuItem:  { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  menuItemText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta },
});
