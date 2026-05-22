import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import MensajeCard from '@/components/common/MensajeCard';
import {
  listenTodosChats, listenMensajes, eliminarMensaje, asignarStrike,
  restringirUsuario, quitarRestriccion, listenApelacionesPendientes,
  resolverApelacion, aceptarChatPrivado, rechazarChatPrivado,
} from '@/services/firebase/chat';
import { onSnapshot, query, orderBy, collection } from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import type { Chat, Mensaje, Apelacion, Noticia } from '@/types/firestore';

type Tab = 'chats' | 'apelaciones' | 'noticias';
type Strike = 1 | 2 | 3;

// ─── Vista de mensajes de un chat ─────────────────────────────

function VistaChat({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [modalStrike, setModalStrike] = useState(false);
  const [strikeNum, setStrikeNum] = useState<Strike>(1);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => listenMensajes(chat.id, setMensajes), [chat.id]);

  async function handleStrike() {
    setGuardando(true);
    try {
      await asignarStrike(chat.id, strikeNum);
      Alert.alert('Strike asignado', `Strike ${strikeNum} registrado en este chat.`);
      setModalStrike(false);
    } catch { Alert.alert('Error', 'No se pudo asignar el strike.'); }
    finally { setGuardando(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.chatAdminHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
        </TouchableOpacity>
        <Text style={styles.chatAdminNombre} numberOfLines={1}>{chat.nombre ?? 'Chat'}</Text>
        <View style={styles.chatAdminAcciones}>
          {chat.strikeCount < 3 && (
            <TouchableOpacity
              style={styles.strikeBtn}
              onPress={() => { setStrikeNum((chat.strikeCount + 1) as Strike); setModalStrike(true); }}
            >
              <Ionicons name="warning-outline" size={14} color="#8A6A72" />
              <Text style={styles.strikeBtnText}>Strike {chat.strikeCount + 1}</Text>
            </TouchableOpacity>
          )}
          {chat.congelado && (
            <View style={styles.congeladoBadge}>
              <Ionicons name="lock-closed" size={12} color={cartasBosque.tierra} />
              <Text style={styles.congeladoBadgeText}>Congelado</Text>
            </View>
          )}
        </View>
      </View>

      {/* Mensajes */}
      <FlatList
        data={mensajes}
        keyExtractor={m => m.id}
        contentContainerStyle={{ paddingVertical: spacing[3] }}
        renderItem={({ item }) => (
          <MensajeCard
            mensaje={item}
            esPropio={false}
            esAdmin
            nombreAutor={item.autorId === 'sistema' ? '' : item.autorId.slice(0, 8)}
            onReply={() => {}}
            onReaccion={() => {}}
            onEliminar={msgId => Alert.alert('Eliminar', '¿Eliminar este mensaje?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => eliminarMensaje(chat.id, msgId) },
            ])}
          />
        )}
        ListEmptyComponent={
          <View style={styles.vacio}><Text style={styles.vacioText}>Sin mensajes</Text></View>
        }
      />

      {/* Modal strike */}
      <Modal visible={modalStrike} transparent animationType="slide" onRequestClose={() => setModalStrike(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalStrike(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitulo}>Asignar strike {strikeNum}/3</Text>
          <Text style={styles.sheetSub}>
            El mensaje se publicará como sistema, sin firma de admin.
            {strikeNum === 3 ? '\n\n⚠️ El chat quedará congelado.' : ''}
          </Text>
          <View style={styles.strikeSelector}>
            {([1, 2, 3] as Strike[]).map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.strikePill, strikeNum === n && styles.strikePillSel]}
                onPress={() => setStrikeNum(n)}
              >
                <Text style={[styles.strikePillText, strikeNum === n && styles.strikePillTextSel]}>
                  Strike {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.btnPrimario, guardando && { opacity: 0.5 }]}
            onPress={handleStrike} disabled={guardando}
          >
            {guardando
              ? <ActivityIndicator color={cartasBosque.bruma} />
              : <Text style={styles.btnPrimarioText}>Confirmar strike</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecundario} onPress={() => setModalStrike(false)}>
            <Text style={styles.btnSecundarioText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─── Fila de chat en la lista ─────────────────────────────────

function ChatRow({ chat, onSelect }: { chat: Chat; onSelect: (c: Chat) => void }) {
  return (
    <TouchableOpacity style={styles.chatFila} onPress={() => onSelect(chat)}>
      <View style={[styles.chatAvatar,
        chat.tipo === 'grupal' && { backgroundColor: cartasBosque.bosque },
        chat.congelado         && { backgroundColor: cartasBosque.tierra },
      ]}>
        <Ionicons
          name={chat.tipo === 'grupal' ? 'people' : 'person'}
          size={17} color={cartasBosque.bruma}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Text style={styles.chatNombre}>{chat.nombre ?? chat.id}</Text>
          {chat.strikeCount > 0 && (
            <View style={styles.strikeBadge}>
              <Text style={styles.strikeBadgeText}>⚠️ {chat.strikeCount}</Text>
            </View>
          )}
          {chat.congelado && (
            <Ionicons name="lock-closed" size={11} color={cartasBosque.tierra} />
          )}
        </View>
        <Text style={styles.chatUltimo} numberOfLines={1}>{chat.ultimoMensaje ?? '—'}</Text>
      </View>
      <Text style={styles.chatFecha}>
        {chat.ultimoMensajeEn
          ? chat.ultimoMensajeEn.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          : ''}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla admin ───────────────────────────────────────────

export default function ChatAdminScreen() {
  const [tab, setTab]                   = useState<Tab>('chats');
  const [chats, setChats]               = useState<Chat[]>([]);
  const [chatActivo, setChatActivo]     = useState<Chat | null>(null);
  const [apelaciones, setApelaciones]   = useState<Apelacion[]>([]);
  const [noticias, setNoticias]         = useState<Noticia[]>([]);
  const [busqueda, setBusqueda]         = useState('');
  const [cargando, setCargando]         = useState(true);

  useEffect(() => {
    const u1 = listenTodosChats(data => { setChats(data); setCargando(false); });
    const u2 = listenApelacionesPendientes(setApelaciones);
    const q  = query(collection(db, 'noticias'), orderBy('creadoEn', 'desc'));
    const u3 = onSnapshot(q, snap => {
      setNoticias(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Noticia));
    }, () => {});
    return () => { u1(); u2(); u3(); };
  }, []);

  const chatsFiltrados = chats.filter(c =>
    (c.nombre ?? c.id).toLowerCase().includes(busqueda.toLowerCase())
  );

  if (chatActivo) {
    return <VistaChat chat={chatActivo} onBack={() => setChatActivo(null)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma }}>
        {/* Tabs */}
        <View style={styles.tabBar}>
          {(['chats', 'apelaciones', 'noticias'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActivo]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActivo]}>
                {t === 'chats'        ? 'Chats'
                 : t === 'apelaciones' ? `Apelaciones ${apelaciones.length > 0 ? `(${apelaciones.length})` : ''}`
                 : 'Noticias'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* TAB: Chats */}
      {tab === 'chats' && (
        <View style={{ flex: 1 }}>
          <View style={styles.buscadorWrap}>
            <Ionicons name="search-outline" size={15} color={cartasBosque.helecho} />
            <TextInput
              style={styles.buscadorInput}
              value={busqueda} onChangeText={setBusqueda}
              placeholder="Buscar chat…" placeholderTextColor={cartasBosque.niebla}
            />
          </View>
          {cargando ? (
            <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
          ) : (
            <FlatList
              data={chatsFiltrados} keyExtractor={c => c.id}
              renderItem={({ item }) => <ChatRow chat={item} onSelect={setChatActivo} />}
              ListEmptyComponent={
                <View style={styles.vacio}><Text style={styles.vacioText}>Sin chats</Text></View>
              }
              contentContainerStyle={{ paddingBottom: spacing[10] }}
            />
          )}
        </View>
      )}

      {/* TAB: Apelaciones */}
      {tab === 'apelaciones' && (
        <FlatList
          data={apelaciones} keyExtractor={a => a.id}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          renderItem={({ item: a }) => (
            <View style={styles.apelacionCard}>
              <Text style={styles.apelacionSolicitante}>{a.solicitanteNombre}</Text>
              <Text style={styles.apelacionMotivo}>{a.motivo}</Text>
              <Text style={styles.apelacionFecha}>
                {a.creadoEn.toDate().toLocaleDateString('es-MX')}
              </Text>
              <View style={styles.apelacionBtns}>
                <TouchableOpacity
                  style={[styles.apelacionBtn, { backgroundColor: '#E8EBE0' }]}
                  onPress={() => Alert.alert('Aceptar', '¿Reabrir el chat?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Aceptar', onPress: () => resolverApelacion(a.id, a.chatId, 'aceptada').catch(() => {}) },
                  ])}
                >
                  <Text style={[styles.apelacionBtnText, { color: '#4A5E48' }]}>Aceptar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.apelacionBtn, { backgroundColor: 'rgba(103,0,16,0.15)' }]}
                  onPress={() => resolverApelacion(a.id, a.chatId, 'rechazada').catch(() => {})}
                >
                  <Text style={[styles.apelacionBtnText, { color: '#960018' }]}>Rechazar (12d)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.apelacionBtn, { backgroundColor: cartasBosque.niebla + '55' }]}
                  onPress={() => resolverApelacion(a.id, a.chatId, 'ignorada').catch(() => {})}
                >
                  <Text style={styles.apelacionBtnText}>Ignorar (21d)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="checkmark-circle-outline" size={32} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin apelaciones pendientes</Text>
            </View>
          }
        />
      )}

      {/* TAB: Noticias */}
      {tab === 'noticias' && (
        <FlatList
          data={noticias} keyExtractor={n => n.id}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          ListHeaderComponent={
            <Text style={styles.noticiaHint}>
              Gestiona las noticias desde esta sección. Para crear una nueva, usa el botón de abajo (próximamente).
            </Text>
          }
          renderItem={({ item: n }) => (
            <View style={styles.noticiaAdminCard}>
              <View style={styles.noticiaAdminRow}>
                <View style={[styles.noticiaEstado, n.activo && styles.noticiaActiva]} />
                <Text style={styles.noticiaAdminTitulo} numberOfLines={1}>{n.titulo}</Text>
                {n.bannerFijado && <Ionicons name="pin" size={12} color={cartasBosque.musgo} />}
              </View>
              <Text style={styles.noticiaAdminTipo}>{n.tipo} · {n.duracion}</Text>
              <Text style={styles.noticiaAdminFecha}>
                {n.fechaPublicacion.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="newspaper-outline" size={32} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin noticias publicadas</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActivo:  { borderBottomColor: cartasBosque.bosque },
  tabText:       { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  tabTextActivo: { color: cartasBosque.bosque },

  buscadorWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  buscadorInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta },

  chatFila: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro + '77',
  },
  chatAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: cartasBosque.musgo,
    alignItems: 'center', justifyContent: 'center',
  },
  chatNombre: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  chatUltimo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 1 },
  chatFecha:  { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla },
  strikeBadge:     { backgroundColor: '#E8EBE0', borderRadius: borderRadius.sm, paddingHorizontal: spacing[1] },
  strikeBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#8A6A72' },

  chatAdminHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  chatAdminNombre:   { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  chatAdminAcciones: { flexDirection: 'row', gap: spacing[2] },
  strikeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: '#E8EBE0', borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  strikeBtnText:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#8A6A72' },
  congeladoBadge:   { flexDirection: 'row', alignItems: 'center', gap: spacing[1],
                      backgroundColor: '#E8EBE0', borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  congeladoBadgeText:{ fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.tierra },

  // Strike modal
  overlay:   { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo:    { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sheetSub:       { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[4] },
  strikeSelector: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  strikePill: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  strikePillSel:     { backgroundColor: '#E8EBE0', borderColor: '#8A6A72' },
  strikePillText:    { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  strikePillTextSel: { color: '#8A6A72' },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center', marginBottom: spacing[2],
  },
  btnPrimarioText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnSecundario:   { paddingVertical: spacing[2], alignItems: 'center' },
  btnSecundarioText:{ fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho },

  // Apelaciones
  apelacionCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4], marginBottom: spacing[3],
  },
  apelacionSolicitante: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  apelacionMotivo: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, marginTop: spacing[1], marginBottom: spacing[2] },
  apelacionFecha: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginBottom: spacing[3] },
  apelacionBtns: { flexDirection: 'row', gap: spacing[2] },
  apelacionBtn: { flex: 1, paddingVertical: spacing[2], alignItems: 'center', borderRadius: borderRadius.sm },
  apelacionBtnText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.tinta },

  // Noticias
  noticiaHint: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho,
    marginBottom: spacing[4], lineHeight: 18,
  },
  noticiaAdminCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], marginBottom: spacing[2],
  },
  noticiaAdminRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  noticiaEstado:     { width: 8, height: 8, borderRadius: 4, backgroundColor: cartasBosque.niebla },
  noticiaActiva:     { backgroundColor: '#4A5E48' },
  noticiaAdminTitulo:{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  noticiaAdminTipo:  { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.3 },
  noticiaAdminFecha: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginTop: 2 },

  vacio:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[8] },
  vacioText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },
});
