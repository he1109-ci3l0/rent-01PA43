import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions, TextInput, KeyboardAvoidingView,
  Platform, SafeAreaView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import MensajeCard from '@/components/common/MensajeCard';
import {
  CHAT_GENERAL_ID, inicializarChatGeneral,
  listenMensajes, enviarMensaje, reaccionar, eliminarMensaje,
  listenMisChats, listenChatGeneral, votarEncuesta,
} from '@/services/firebase/chat';
import { onSnapshot, query, where, collection, orderBy, getDocs } from 'firebase/firestore';
import { db, collections } from '@/services/firebase/firestore';
import type { Chat, Mensaje, Noticia, Inquilino, ReplyRef } from '@/types/firestore';

const { width: SW } = Dimensions.get('window');
const PANEL_W = Math.round(SW * 0.87);

// ─── Noticia card ─────────────────────────────────────────────

function NoticiaCard({ noticia, uid, onVotar }: {
  noticia: Noticia; uid: string; onVotar: (id: string, op: string) => void;
}) {
  const yaVoto = noticia.encuesta?.votosPor?.includes(uid) ?? false;
  const totalVotos = Object.values(noticia.encuesta?.votos ?? {}).reduce((a, b) => a + b, 0);

  return (
    <View style={[styles.noticiaCard, noticia.bannerFijado && styles.noticiaFijada]}>
      {noticia.bannerFijado && (
        <View style={styles.fijaRow}>
          <Ionicons name="pin-outline" size={11} color={cartasBosque.musgo} />
          <Text style={styles.fijaText}>Fijado</Text>
        </View>
      )}
      <Text style={styles.noticiaTag}>{noticia.tipo.toUpperCase()}</Text>
      <Text style={styles.noticiaTitulo}>{noticia.titulo}</Text>
      <Text style={styles.noticiaContenido}>{noticia.contenido}</Text>
      {noticia.imagen && (
        <Image source={{ uri: noticia.imagen }} style={styles.noticiaImg} resizeMode="cover" />
      )}
      {noticia.tipo === 'encuesta' && noticia.encuesta && (
        <View style={{ marginTop: spacing[3] }}>
          {noticia.encuesta.opciones.map(op => {
            const v = noticia.encuesta!.votos[op.id] ?? 0;
            const pct = totalVotos > 0 ? Math.round((v / totalVotos) * 100) : 0;
            return (
              <TouchableOpacity
                key={op.id}
                style={styles.encuestaOpcion}
                onPress={() => !yaVoto && onVotar(noticia.id, op.id)}
                disabled={yaVoto}
              >
                <View style={[styles.encuestaBarra, { width: `${pct}%` as any }]} />
                <Text style={styles.encuestaTexto}>{op.texto}</Text>
                {yaVoto && <Text style={styles.encuestaPct}>{pct}%</Text>}
              </TouchableOpacity>
            );
          })}
          <Text style={styles.encuestaTotal}>{totalVotos} votos · {yaVoto ? 'votado' : `Cierra: ${noticia.encuesta.duracion}`}</Text>
        </View>
      )}
      <Text style={styles.noticiaFecha}>
        {noticia.fechaPublicacion.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
      </Text>
    </View>
  );
}

// ─── Chat list ────────────────────────────────────────────────

function ChatList({ chats, chatGeneral, uid, onSelect }: {
  chats: Chat[]; chatGeneral: Chat | null; uid: string; onSelect: (c: Chat) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const filtrados = chats.filter(c =>
    c.id !== CHAT_GENERAL_ID &&
    (c.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtrados}
        keyExtractor={c => c.id}
        ListHeaderComponent={chatGeneral ? (
          <TouchableOpacity style={styles.chatRow} onPress={() => onSelect(chatGeneral)}>
            <View style={[styles.chatAvatar, { backgroundColor: cartasBosque.bosque }]}>
              <Ionicons name="people" size={18} color={cartasBosque.bruma} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatNombre}>General</Text>
              <Text style={styles.chatUltimo} numberOfLines={1}>{chatGeneral.ultimoMensaje ?? '¡Escribe algo!'}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: c }) => {
          const pendiente = c.estado === 'solicitado' && c.solicitadoPor !== uid;
          return (
            <TouchableOpacity style={styles.chatRow} onPress={() => onSelect(c)}>
              <View style={styles.chatAvatar}>
                <Ionicons name="person" size={18} color={cartasBosque.bruma} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatNombre}>{c.nombre ?? 'Chat'}</Text>
                <Text style={[styles.chatUltimo, pendiente && { color: cartasBosque.tierra }]} numberOfLines={1}>
                  {pendiente ? 'Solicitud de chat' : (c.ultimoMensaje ?? '')}
                </Text>
              </View>
              {(c.noLeidosPor[uid] ?? 0) > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{c.noLeidosPor[uid]}</Text></View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing[2] }}
      />
      {/* Buscador al fondo (según spec) */}
      <View style={styles.buscadorWrap}>
        <View style={styles.buscador}>
          <Ionicons name="search-outline" size={15} color={cartasBosque.helecho} />
          <TextInput
            style={styles.buscadorInput}
            value={busqueda} onChangeText={setBusqueda}
            placeholder="Buscar chat…" placeholderTextColor={cartasBosque.niebla}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Chat view ────────────────────────────────────────────────

function ChatView({ chat, uid, nombre, esAdmin, onBack, hideHeader }: {
  chat: Chat; uid: string; nombre: string; esAdmin: boolean; onBack: () => void; hideHeader?: boolean;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto]       = useState('');
  const [replyTo, setReplyTo]   = useState<Mensaje | null>(null);
  const [showMenc, setShowMenc] = useState(false);
  const [mencFilter, setMencFilter] = useState('');
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const bloqueado = (chat.congelado || chat.restringidos?.includes(uid)) && !esAdmin;

  useEffect(() => listenMensajes(chat.id, msgs => {
    setMensajes(msgs);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }), [chat.id]);

  useEffect(() => {
    getDocs(query(collections.inquilinos, where('estado', '==', 'activo')))
      .then(s => setInquilinos(s.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Inquilino)))
      .catch(() => {});
  }, []);

  function onChangeTexto(t: string) {
    if (t.length > 150) return;
    setTexto(t);
    const m = t.match(/@(\S*)$/);
    if (m) { setShowMenc(true); setMencFilter(m[1]); } else setShowMenc(false);
  }

  function insertMencion(inq: Inquilino) {
    const n = inq.nombre.split(' ')[0];
    setTexto(p => p.replace(/@\S*$/, `@${n} `));
    setShowMenc(false); setMencFilter('');
    inputRef.current?.focus();
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || bloqueado) return;
    const mencionados: string[] = [];
    if (t.includes('@todos')) inquilinos.forEach(i => i.uid && mencionados.push(i.uid));
    const reply: ReplyRef | undefined = replyTo
      ? { msgId: replyTo.id, autorNombre: nombre, texto: replyTo.contenido.slice(0, 80) }
      : undefined;
    setTexto(''); setReplyTo(null);
    try { await enviarMensaje({ chatId: chat.id, uid, nombre, texto: t, replyTo: reply, mencionados }); }
    catch { Alert.alert('Error', 'No se pudo enviar.'); }
  }

  const inqFiltrados = inquilinos.filter(i =>
    `${i.nombre} ${i.apellido}`.toLowerCase().includes(mencFilter.toLowerCase())
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!hideHeader && (
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={styles.chatHeaderNombre} numberOfLines={1}>{chat.nombre ?? 'Chat'}</Text>
          {chat.congelado && <Ionicons name="lock-closed" size={14} color={cartasBosque.tierra} />}
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={mensajes}
        keyExtractor={m => m.id}
        contentContainerStyle={{ paddingVertical: spacing[3] }}
        renderItem={({ item }) => (
          <MensajeCard
            mensaje={item}
            esPropio={item.autorId === uid}
            esAdmin={esAdmin}
            nombreAutor={item.autorId === 'sistema' ? '' : item.autorId.slice(0, 8)}
            onReply={setReplyTo}
            onReaccion={(msgId, emoji) => reaccionar(chat.id, msgId, emoji).catch(() => {})}
            onEliminar={msgId => Alert.alert('Eliminar', '¿Eliminar este mensaje?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => eliminarMensaje(chat.id, msgId) },
            ])}
          />
        )}
        ListEmptyComponent={
          <View style={styles.chatVacio}>
            <Text style={styles.chatVacioText}>Sin mensajes aún</Text>
          </View>
        }
      />

      {/* @menciones */}
      {showMenc && inqFiltrados.length > 0 && (
        <View style={styles.mencionesPanel}>
          {inqFiltrados.slice(0, 4).map(i => (
            <TouchableOpacity key={i.uid} style={styles.mencionRow} onPress={() => insertMencion(i)}>
              <Ionicons name="person-circle-outline" size={16} color={cartasBosque.musgo} />
              <Text style={styles.mencionNombre}>{i.nombre} {i.apellido}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.mencionRow} onPress={() => {
            setTexto(p => p.replace(/@\S*$/, '@todos ')); setShowMenc(false);
          }}>
            <Ionicons name="megaphone-outline" size={16} color={cartasBosque.bosque} />
            <Text style={[styles.mencionNombre, { color: cartasBosque.bosque }]}>@todos</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reply bar */}
      {replyTo && (
        <View style={styles.replyBarWrap}>
          <View style={styles.replyBarLine} />
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBarAutor} numberOfLines={1}>{replyTo.contenido.slice(0, 60)}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={18} color={cartasBosque.helecho} />
          </TouchableOpacity>
        </View>
      )}

      {bloqueado ? (
        <View style={styles.congeladoBar}>
          <Ionicons name="lock-closed-outline" size={14} color={cartasBosque.tierra} />
          <Text style={styles.congeladoText}>
            {chat.congelado ? 'Chat congelado' : 'No puedes enviar mensajes'}
          </Text>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={() => setTexto(p => p + '@')} style={styles.inputAction}>
            <Text style={styles.inputActionText}>@</Text>
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={texto} onChangeText={onChangeTexto}
            placeholder="Mensaje…" placeholderTextColor={cartasBosque.niebla}
            multiline maxLength={150}
          />
          <Text style={styles.charCount}>{texto.length}/150</Text>
          <TouchableOpacity
            style={[styles.sendBtn, !texto.trim() && { opacity: 0.4 }]}
            onPress={enviar} disabled={!texto.trim()}
          >
            <Ionicons name="send" size={16} color={cartasBosque.bruma} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

export default function NoticiasScreen() {
  const { user, role } = useAuth();
  const uid    = user?.uid ?? '';
  const esAdmin = role === 'admin';

  const [noticias, setNoticias]         = useState<Noticia[]>([]);
  const [chats, setChats]               = useState<Chat[]>([]);
  const [chatGeneral, setChatGeneral]   = useState<Chat | null>(null);
  const [chatActivo, setChatActivo]     = useState<Chat | null>(null);
  const [cargando, setCargando]         = useState(true);
  const [nombreInq, setNombreInq]       = useState('');

  const panelAbierto = useRef(false);
  const translateX   = useRef(new Animated.Value(PANEL_W)).current;
  const backdropOp   = translateX.interpolate({ inputRange: [0, PANEL_W], outputRange: [0.45, 0] });

  const openPanel = useCallback(() => {
    panelAbierto.current = true;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, []);

  const closePanel = useCallback(() => {
    panelAbierto.current = false;
    setChatActivo(null);
    Animated.spring(translateX, { toValue: PANEL_W, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (_, gs) => gs.x0 > SW - 22 || panelAbierto.current,
    onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dx) > 6 && (gs.x0 > SW - 22 || panelAbierto.current),
    onPanResponderMove: (_, gs) => {
      if (!panelAbierto.current && gs.dx < 0) translateX.setValue(Math.max(0, PANEL_W + gs.dx));
      else if (panelAbierto.current && gs.dx > 0) translateX.setValue(Math.min(PANEL_W, gs.dx));
    },
    onPanResponderRelease: (_, gs) => {
      const threshold = PANEL_W * 0.25;
      if (!panelAbierto.current && gs.dx < -threshold) openPanel();
      else if (panelAbierto.current && gs.dx > threshold) closePanel();
      else Animated.spring(translateX, {
        toValue: panelAbierto.current ? 0 : PANEL_W,
        useNativeDriver: true, tension: 80, friction: 12,
      }).start();
    },
  })).current;

  useEffect(() => {
    if (!uid) return;
    inicializarChatGeneral().catch(() => {});
    const u1 = listenChatGeneral(setChatGeneral);
    const u2 = listenMisChats(uid, setChats);
    const q = query(
      collection(db, 'noticias'),
      where('activo', '==', true),
      orderBy('bannerFijado', 'desc'),
      orderBy('fechaPublicacion', 'desc'),
    );
    const u3 = onSnapshot(q, snap => {
      setNoticias(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Noticia));
      setCargando(false);
    }, () => setCargando(false));
    getDocs(query(collections.inquilinos, where('uid', '==', uid)))
      .then(s => { const d = s.docs[0]?.data() as any; if (d) setNombreInq(`${d.nombre} ${d.apellido}`.trim()); })
      .catch(() => {});
    return () => { u1(); u2(); u3(); };
  }, [uid]);

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      {/* Feed noticias + chat general siempre visible */}
      <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
        <View style={styles.header}>
          <Text style={styles.titulo}>Noticias</Text>
          <Text style={styles.swipeHint}>← desliza para el chat</Text>
        </View>

        {cargando ? (
          <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
        ) : (
          <View style={{ flex: 1 }}>
            {/* Noticias en la parte superior (scroll compacto) */}
            {noticias.length > 0 ? (
              <FlatList
                data={noticias} keyExtractor={n => n.id}
                style={{ maxHeight: 260 }}
                contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[2] }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <NoticiaCard noticia={item} uid={uid}
                    onVotar={(id, op) => votarEncuesta(id, op, uid).catch(() => {})} />
                )}
              />
            ) : (
              <View style={styles.noticiaPlaceholder}>
                <Ionicons name="newspaper-outline" size={18} color={cartasBosque.niebla} />
                <Text style={styles.noticiaPlaceholderText}>Aún no hay noticias publicadas</Text>
              </View>
            )}

            {/* Divisor sección general */}
            <View style={styles.generalHeader}>
              <View style={[styles.generalDot, { backgroundColor: cartasBosque.bosque }]} />
              <Text style={styles.generalLabel}>GENERAL</Text>
            </View>

            {/* Chat general siempre presente */}
            {chatGeneral ? (
              <View style={{ flex: 1 }}>
                <ChatView
                  chat={chatGeneral}
                  uid={uid}
                  nombre={nombreInq || uid.slice(0, 8)}
                  esAdmin={esAdmin}
                  onBack={() => {}}
                  hideHeader
                />
              </View>
            ) : (
              <View style={styles.vacio}>
                <ActivityIndicator color={cartasBosque.bosque} />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOp }]} pointerEvents="none">
        <TouchableOpacity style={{ flex: 1 }} onPress={closePanel} activeOpacity={1} />
      </Animated.View>

      {/* Panel lateral */}
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
          <View style={styles.panelHeader}>
            {chatActivo
              ? <View style={{ width: 20 }} />
              : <Text style={styles.panelTitulo}>Chats</Text>
            }
            <TouchableOpacity onPress={chatActivo ? () => setChatActivo(null) : closePanel}>
              <Ionicons name={chatActivo ? 'arrow-back' : 'chevron-forward'} size={22} color={cartasBosque.tinta} />
            </TouchableOpacity>
          </View>

          {chatActivo ? (
            <ChatView
              chat={chatActivo} uid={uid}
              nombre={nombreInq || uid.slice(0, 8)}
              esAdmin={esAdmin}
              onBack={() => setChatActivo(null)}
            />
          ) : (
            <ChatList
              chats={chats} chatGeneral={chatGeneral} uid={uid}
              onSelect={setChatActivo}
            />
          )}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo:    { fontFamily: 'DMSans_600SemiBold', fontSize: 22, color: cartasBosque.tinta },
  swipeHint: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla },
  vacio:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },

  noticiaPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  noticiaPlaceholderText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.niebla },
  generalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  generalDot:  { width: 8, height: 8, borderRadius: 4 },
  generalLabel:{ fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },

  noticiaCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4], marginBottom: spacing[3],
  },
  noticiaFijada: { borderColor: cartasBosque.musgo, borderWidth: 1.5 },
  fijaRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[1] },
  fijaText: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.musgo },
  noticiaTag: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.musgo, letterSpacing: 0.4, marginBottom: spacing[1] },
  noticiaTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.tinta, marginBottom: spacing[1] },
  noticiaContenido: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho, lineHeight: 18 },
  noticiaImg: { width: '100%', height: 160, borderRadius: borderRadius.sm, marginTop: spacing[2] },
  noticiaFecha: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginTop: spacing[2] },

  encuestaOpcion: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[2] + 2, marginBottom: spacing[1],
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  encuestaBarra: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: cartasBosque.niebla + '66' },
  encuestaTexto: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta, flex: 1, zIndex: 1 },
  encuestaPct:   { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.musgo, zIndex: 1 },
  encuestaTotal: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla, marginTop: spacing[1] },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1A1F1A', zIndex: 10 },
  panel: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: PANEL_W,
    zIndex: 20, backgroundColor: cartasBosque.bruma,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: -2, height: 0 },
    elevation: 10, borderLeftWidth: 1, borderLeftColor: cartasBosque.pergaminoOscuro,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  panelTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta },

  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro + '77',
  },
  chatAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: cartasBosque.musgo,
    alignItems: 'center', justifyContent: 'center',
  },
  chatNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  chatUltimo: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 1 },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.bruma },
  buscadorWrap: {
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro, padding: spacing[3],
  },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  buscadorInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },

  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  chatHeaderNombre: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  chatVacio: { padding: spacing[8], alignItems: 'center' },
  chatVacioText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.niebla, textAlign: 'center' },

  mencionesPanel: {
    backgroundColor: cartasBosque.pergamino, borderTopWidth: 1,
    borderTopColor: cartasBosque.pergaminoOscuro, paddingVertical: spacing[1],
  },
  mencionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  mencionNombre: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },

  replyBarWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.niebla + '44',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
  },
  replyBarLine: { width: 3, height: 28, borderRadius: 2, backgroundColor: cartasBosque.bosque },
  replyBarAutor: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  inputAction: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, backgroundColor: cartasBosque.niebla + '55',
  },
  inputActionText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bosque },
  inputField: {
    flex: 1, backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta,
    maxHeight: 100, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  charCount: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginBottom: 6 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  congeladoBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
    backgroundColor: '#F5E8C8',
  },
  congeladoText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.tierra },
});
