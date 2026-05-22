import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image, Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import MensajeCard from '@/components/common/MensajeCard';
import {
  CHAT_GENERAL_ID, inicializarChatGeneral,
  listenMensajes, enviarMensaje, reaccionar, eliminarMensaje,
  listenMisChats, listenChatGeneral, votarEncuesta,
  crearChatPrivado,
} from '@/services/firebase/chat';
import { crearTicket } from '@/services/firebase/tickets';
import {
  onSnapshot, query, where, collection, orderBy, getDocs,
  addDoc, Timestamp, doc,
} from 'firebase/firestore';
import { db, collections } from '@/services/firebase/firestore';
import type {
  Chat, Mensaje, Noticia, Inquilino, ReplyRef,
} from '@/types/firestore';

const { width: SW } = Dimensions.get('window');
const PANEL_W = Math.round(SW * 0.87);

// ─── Noticia banner (compact, tappable) ──────────────────────

function NoticiaBanner({ noticia, onPress }: {
  noticia: Noticia; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[st.banner, noticia.bannerFijado && st.bannerFijado]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      {noticia.bannerFijado && (
        <View style={st.fijaRow}>
          <Ionicons name="pin" size={10} color={cartasBosque.musgo} />
          <Text style={st.fijaText}>Fijado</Text>
        </View>
      )}
      <Text style={st.bannerTag}>{noticia.tipo.toUpperCase()}</Text>
      <Text style={st.bannerTitulo} numberOfLines={2}>{noticia.titulo}</Text>
      <Text style={st.bannerContenido} numberOfLines={2}>{noticia.contenido}</Text>
      <Text style={st.bannerFecha}>
        {noticia.fechaPublicacion.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Noticia completa (modal fullscreen) ─────────────────────

function NoticiaModal({ noticia, uid, onClose, onVotar }: {
  noticia: Noticia; uid: string; onClose: () => void;
  onVotar: (id: string, op: string) => void;
}) {
  const yaVoto = noticia.encuesta?.votosPor?.includes(uid) ?? false;
  const totalVotos = Object.values(noticia.encuesta?.votos ?? {}).reduce((a, b) => a + b, 0);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[st.modalRoot, { backgroundColor: cartasBosque.bruma }]}>
        <View style={st.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={st.modalTag}>{noticia.tipo.toUpperCase()}</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={st.modalScroll}>
          {noticia.bannerFijado && (
            <View style={st.fijaRow}>
              <Ionicons name="pin" size={11} color={cartasBosque.musgo} />
              <Text style={st.fijaText}>Fijado</Text>
            </View>
          )}
          <Text style={st.modalTitulo}>{noticia.titulo}</Text>
          <Text style={st.modalFecha}>
            {noticia.fechaPublicacion.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          {noticia.imagen && (
            <Image source={{ uri: noticia.imagen }} style={st.modalImg} resizeMode="cover" />
          )}
          <Text style={st.modalContenido}>{noticia.contenido}</Text>
          {noticia.tipo === 'encuesta' && noticia.encuesta && (
            <View style={{ marginTop: spacing[4] }}>
              {noticia.encuesta.opciones.map(op => {
                const v = noticia.encuesta!.votos[op.id] ?? 0;
                const pct = totalVotos > 0 ? Math.round((v / totalVotos) * 100) : 0;
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={st.encuestaOpcion}
                    onPress={() => !yaVoto && onVotar(noticia.id, op.id)}
                    disabled={yaVoto}
                  >
                    <View style={[st.encuestaBarra, { width: `${pct}%` as any }]} />
                    <Text style={st.encuestaTexto}>{op.texto}</Text>
                    {yaVoto && <Text style={st.encuestaPct}>{pct}%</Text>}
                  </TouchableOpacity>
                );
              })}
              <Text style={st.encuestaTotal}>
                {totalVotos} votos · {yaVoto ? 'votado' : `Cierra: ${noticia.encuesta.duracion}`}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Fila de chat en el feed principal ───────────────────────

function ChatRowFeed({ chat, uid, onPress }: {
  chat: Chat; uid: string; onPress: () => void;
}) {
  const esGeneral = chat.id === CHAT_GENERAL_ID;
  const pendiente = chat.estado === 'solicitado' && chat.solicitadoPor !== uid;
  const noLeidos  = chat.noLeidosPor?.[uid] ?? 0;
  const hora = chat.ultimoMensajeEn
    ? chat.ultimoMensajeEn.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <TouchableOpacity style={st.chatRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[st.chatAvatar, esGeneral && { backgroundColor: cartasBosque.bosque }]}>
        <Ionicons
          name={esGeneral ? 'people' : chat.tipo === 'grupal' ? 'people-outline' : 'person'}
          size={18} color={cartasBosque.bruma}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.chatNombre}>{esGeneral ? 'General' : (chat.nombre ?? 'Chat')}</Text>
        <Text
          style={[st.chatUltimo, pendiente && { color: cartasBosque.tierra }]}
          numberOfLines={1}
        >
          {pendiente ? 'Solicitud de chat' : (chat.ultimoMensaje ?? '¡Escribe algo!')}
        </Text>
      </View>
      <View style={st.chatRowRight}>
        {hora ? <Text style={st.chatHora}>{hora}</Text> : null}
        {noLeidos > 0 && (
          <View style={st.badge}><Text style={st.badgeText}>{noLeidos}</Text></View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Círculo de contacto ──────────────────────────────────────

function ContactoCirculo({ inq, onPress }: {
  inq: Inquilino; onPress: () => void;
}) {
  const inicial = (inq.nombre?.[0] ?? '?').toUpperCase();
  const hab = inq.habitacionId?.replace('hab_', '') ?? '—';
  return (
    <TouchableOpacity style={st.contactoWrap} onPress={onPress} activeOpacity={0.78}>
      <View style={st.contactoCirculo}>
        {inq.avatar
          ? <Image source={{ uri: inq.avatar }} style={st.contactoImg} />
          : <Text style={st.contactoInicial}>{inicial}</Text>
        }
      </View>
      <Text style={st.contactoNombre} numberOfLines={1}>{inq.nombre.split(' ')[0]}</Text>
      <Text style={st.contactoHab}>Hab. {hab}</Text>
    </TouchableOpacity>
  );
}

// ─── Lista de chats (panel lateral) ──────────────────────────

function PanelChatList({ chats, chatGeneral, uid, onSelect, onNuevoChat, onNuevoGrupo }: {
  chats: Chat[]; chatGeneral: Chat | null; uid: string;
  onSelect: (c: Chat) => void;
  onNuevoChat: () => void;
  onNuevoGrupo: () => void;
}) {
  const [busquedaTop, setBusquedaTop] = useState('');
  const [busquedaBot, setBusquedaBot] = useState('');
  const busqueda = busquedaTop || busquedaBot;

  const filtrados = chats.filter(c =>
    c.id !== CHAT_GENERAL_ID &&
    (c.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Buscador arriba */}
      <View style={st.buscadorWrap}>
        <View style={st.buscador}>
          <Ionicons name="search-outline" size={15} color={cartasBosque.helecho} />
          <TextInput
            style={st.buscadorInput}
            value={busquedaTop} onChangeText={setBusquedaTop}
            placeholder="Buscar chats, temas…"
            placeholderTextColor={cartasBosque.niebla}
          />
        </View>
      </View>

      {/* Botones nuevo chat / grupo */}
      <View style={st.nuevoBtnsRow}>
        <TouchableOpacity style={st.nuevoBtn} onPress={onNuevoChat} activeOpacity={0.78}>
          <Ionicons name="person-add-outline" size={14} color={cartasBosque.bosque} />
          <Text style={st.nuevoBtnText}>+ Chat privado</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.nuevoBtn} onPress={onNuevoGrupo} activeOpacity={0.78}>
          <Ionicons name="people-outline" size={14} color={cartasBosque.bosque} />
          <Text style={st.nuevoBtnText}>+ Nuevo grupo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={c => c.id}
        ListHeaderComponent={chatGeneral ? (
          <TouchableOpacity style={st.chatRow} onPress={() => onSelect(chatGeneral)}>
            <View style={[st.chatAvatar, { backgroundColor: cartasBosque.bosque }]}>
              <Ionicons name="people" size={18} color={cartasBosque.bruma} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.chatNombre}>General</Text>
              <Text style={st.chatUltimo} numberOfLines={1}>
                {chatGeneral.ultimoMensaje ?? '¡Escribe algo!'}
              </Text>
            </View>
            {(chatGeneral.noLeidosPor?.[uid] ?? 0) > 0 && (
              <View style={st.badge}>
                <Text style={st.badgeText}>{chatGeneral.noLeidosPor[uid]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: c }) => {
          const pendiente = c.estado === 'solicitado' && c.solicitadoPor !== uid;
          return (
            <TouchableOpacity style={st.chatRow} onPress={() => onSelect(c)}>
              <View style={[st.chatAvatar, c.tipo === 'grupal' && { backgroundColor: cartasBosque.musgo }]}>
                <Ionicons
                  name={c.tipo === 'grupal' ? 'people-outline' : 'person'}
                  size={18} color={cartasBosque.bruma}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.chatNombre}>{c.nombre ?? 'Chat'}</Text>
                <Text
                  style={[st.chatUltimo, pendiente && { color: cartasBosque.tierra }]}
                  numberOfLines={1}
                >
                  {pendiente ? 'Solicitud de chat' : (c.ultimoMensaje ?? '')}
                </Text>
              </View>
              {(c.noLeidosPor?.[uid] ?? 0) > 0 && (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{c.noLeidosPor[uid]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing[2] }}
      />

      {/* Buscador al fondo */}
      <View style={st.buscadorWrap}>
        <View style={st.buscador}>
          <Ionicons name="search-outline" size={15} color={cartasBosque.helecho} />
          <TextInput
            style={st.buscadorInput}
            value={busquedaBot} onChangeText={v => { setBusquedaBot(v); setBusquedaTop(''); }}
            placeholder="Buscar…"
            placeholderTextColor={cartasBosque.niebla}
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
  const flatRef  = useRef<FlatList>(null);
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
    try {
      await enviarMensaje({ chatId: chat.id, uid, nombre, texto: t, replyTo: reply, mencionados });
    } catch { Alert.alert('Error', 'No se pudo enviar.'); }
  }

  const inqFiltrados = inquilinos.filter(i =>
    `${i.nombre} ${i.apellido}`.toLowerCase().includes(mencFilter.toLowerCase()),
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!hideHeader && (
        <View style={st.chatHeader}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={st.chatHeaderNombre} numberOfLines={1}>{chat.nombre ?? 'Chat'}</Text>
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
          <View style={st.chatVacio}>
            <Text style={st.chatVacioText}>Sin mensajes aún</Text>
          </View>
        }
      />
      {showMenc && inqFiltrados.length > 0 && (
        <View style={st.mencionesPanel}>
          {inqFiltrados.slice(0, 4).map(i => (
            <TouchableOpacity key={i.uid} style={st.mencionRow} onPress={() => insertMencion(i)}>
              <Ionicons name="person-circle-outline" size={16} color={cartasBosque.musgo} />
              <Text style={st.mencionNombre}>{i.nombre} {i.apellido}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={st.mencionRow} onPress={() => {
            setTexto(p => p.replace(/@\S*$/, '@todos ')); setShowMenc(false);
          }}>
            <Ionicons name="megaphone-outline" size={16} color={cartasBosque.bosque} />
            <Text style={[st.mencionNombre, { color: cartasBosque.bosque }]}>@todos</Text>
          </TouchableOpacity>
        </View>
      )}
      {replyTo && (
        <View style={st.replyBarWrap}>
          <View style={st.replyBarLine} />
          <Text style={[st.replyBarAutor, { flex: 1 }]} numberOfLines={1}>
            {replyTo.contenido.slice(0, 60)}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={18} color={cartasBosque.helecho} />
          </TouchableOpacity>
        </View>
      )}
      {bloqueado ? (
        <View style={st.congeladoBar}>
          <Ionicons name="lock-closed-outline" size={14} color={cartasBosque.tierra} />
          <Text style={st.congeladoText}>
            {chat.congelado ? 'Chat congelado' : 'No puedes enviar mensajes'}
          </Text>
        </View>
      ) : (
        <View style={st.inputBar}>
          <TouchableOpacity onPress={() => setTexto(p => p + '@')} style={st.inputAction}>
            <Text style={st.inputActionText}>@</Text>
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={st.inputField}
            value={texto} onChangeText={onChangeTexto}
            placeholder="Mensaje…" placeholderTextColor={cartasBosque.niebla}
            multiline maxLength={150}
          />
          <Text style={st.charCount}>{texto.length}/150</Text>
          <TouchableOpacity
            style={[st.sendBtn, !texto.trim() && { opacity: 0.4 }]}
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
  const uid     = user?.uid ?? '';
  const esAdmin = role === 'admin';

  const [noticias, setNoticias]       = useState<Noticia[]>([]);
  const [chats, setChats]             = useState<Chat[]>([]);
  const [chatGeneral, setChatGeneral] = useState<Chat | null>(null);
  const [chatActivo, setChatActivo]   = useState<Chat | null>(null);
  const [noticiaActiva, setNoticiaActiva] = useState<Noticia | null>(null);
  const [inquilinos, setInquilinos]   = useState<Inquilino[]>([]);
  const [miInq, setMiInq]             = useState<Inquilino | null>(null);
  const [nombreInq, setNombreInq]     = useState('');
  const [cargando, setCargando]       = useState(true);
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [reporteDesc, setReporteDesc] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [mostraNuevoChat, setMostraNuevoChat] = useState(false);

  // ── Panel lateral ──────────────────────────────────────────

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
    setMostraNuevoChat(false);
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

  // ── Datos ──────────────────────────────────────────────────

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

    getDocs(query(collections.inquilinos, where('estado', '==', 'activo')))
      .then(s => {
        const todos = s.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Inquilino);
        const yo    = todos.find(i => i.uid === uid);
        setMiInq(yo ?? null);
        setNombreInq(yo ? `${yo.nombre} ${yo.apellido}`.trim() : uid.slice(0, 8));
        setInquilinos(todos.filter(i => i.uid !== uid));
      })
      .catch(() => {});

    return () => { u1(); u2(); u3(); };
  }, [uid]);

  // ── Chats fijados: 3 directos recientes + 2 grupos recientes ─

  const chatsPinned = useMemo(() => {
    const directos = chats.filter(c => c.id !== CHAT_GENERAL_ID && c.tipo === 'directo').slice(0, 3);
    const grupos   = chats.filter(c => c.id !== CHAT_GENERAL_ID && c.tipo === 'grupal').slice(0, 2);
    return [...directos, ...grupos].sort(
      (a, b) => (b.ultimoMensajeEn?.toMillis() ?? 0) - (a.ultimoMensajeEn?.toMillis() ?? 0),
    );
  }, [chats]);

  // ── Acciones ──────────────────────────────────────────────

  function abrirChat(chat: Chat) {
    setChatActivo(chat);
    setMostraNuevoChat(false);
    openPanel();
  }

  async function iniciarChatConInquilino(inq: Inquilino) {
    if (!inq.uid) return;
    try {
      const chatId = await crearChatPrivado(uid, nombreInq, inq.uid, `${inq.nombre} ${inq.apellido}`);
      const chatData: Chat = {
        id: chatId,
        tipo: 'directo',
        nombre: `${inq.nombre} ${inq.apellido}`,
        participantes: [uid, inq.uid],
        ultimoMensaje: null,
        ultimoMensajeEn: null,
        ultimoMensajePor: null,
        noLeidosPor: {},
        estado: 'solicitado',
        solicitadoPor: uid,
        strikeCount: 0,
        congelado: false,
        restringidos: [],
        creadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      };
      abrirChat(chatData);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el chat.');
    }
  }

  function onTocaContacto(inq: Inquilino) {
    Alert.alert(
      `${inq.nombre} ${inq.apellido}`,
      `Habitación ${inq.habitacionId?.replace('hab_', '') ?? '—'}`,
      [
        {
          text: 'Mensaje privado',
          onPress: () => iniciarChatConInquilino(inq),
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  }

  async function crearGrupo() {
    if (!Alert.prompt) {
      Alert.alert('Próximamente', 'La creación de grupos está disponible en iOS 13+.');
      return;
    }
    Alert.prompt(
      'Nuevo grupo',
      'Nombre del grupo',
      async (nombre) => {
        if (!nombre?.trim()) return;
        try {
          const now = Timestamp.now();
          await addDoc(collection(db, 'chats'), {
            tipo: 'grupal',
            nombre: nombre.trim(),
            participantes: [uid],
            ultimoMensaje: null, ultimoMensajeEn: null, ultimoMensajePor: null,
            noLeidosPor: { [uid]: 0 },
            estado: 'activo',
            strikeCount: 0, congelado: false, restringidos: [],
            creadoEn: now, actualizadoEn: now,
          });
        } catch { Alert.alert('Error', 'No se pudo crear el grupo.'); }
      },
      'plain-text',
    );
  }

  async function enviarReporteAcoso() {
    if (!reporteDesc.trim()) return;
    if (!miInq) { Alert.alert('Error', 'No se encontró tu información.'); return; }
    setEnviandoReporte(true);
    try {
      await crearTicket({
        inquilinoId:      uid,
        habitacionId:     miInq.habitacionId ?? '',
        habitacionNumero: miInq.habitacionId?.replace('hab_', '') ?? '—',
        inquilinoNombre:  nombreInq,
        categoria:        'reporte_inquilino',
        subcategoria:     'acoso',
        descripcion:      reporteDesc.trim(),
        sacasteRopa:      null,
        fotoUri:          null,
      });
      Alert.alert('Reportado', 'Tu reporte fue enviado. Administración revisará el caso.');
      setMostrarReporte(false);
      setReporteDesc('');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte.');
    } finally {
      setEnviandoReporte(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={st.root} {...panResponder.panHandlers}>
      <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }} edges={['top'] as any}>

        {/* HEADER */}
        <View style={st.header}>
          <Text style={st.titulo}>Comunidad</Text>
          <TouchableOpacity onPress={openPanel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="menu-outline" size={24} color={cartasBosque.tinta} />
          </TouchableOpacity>
        </View>

        {cargando ? (
          <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[10] }}>

            {/* ═══ MIS CHATS ═══ */}
            <View style={st.seccionHeader}>
              <Text style={st.seccionLabel}>MIS CHATS</Text>
            </View>

            {/* Noticias banners */}
            {noticias.length > 0 ? (
              <>
                {noticias.slice(0, 3).map(n => (
                  <NoticiaBanner
                    key={n.id} noticia={n}
                    onPress={() => setNoticiaActiva(n)}
                  />
                ))}
              </>
            ) : (
              <View style={st.noticiaPlaceholder}>
                <Ionicons name="newspaper-outline" size={14} color={cartasBosque.niebla} />
                <Text style={st.noticiaPlaceholderText}>Sin noticias recientes</Text>
              </View>
            )}

            {/* Chat General */}
            {chatGeneral && (
              <ChatRowFeed chat={chatGeneral} uid={uid} onPress={() => abrirChat(chatGeneral)} />
            )}

            {/* Chats fijados */}
            {chatsPinned.map(c => (
              <ChatRowFeed key={c.id} chat={c} uid={uid} onPress={() => abrirChat(c)} />
            ))}

            {/* Ver todos */}
            <TouchableOpacity style={st.verTodosBtn} onPress={openPanel} activeOpacity={0.78}>
              <Text style={st.verTodosText}>+ ver todos mis chats</Text>
              <Ionicons name="chevron-forward" size={14} color={cartasBosque.bosque} />
            </TouchableOpacity>

            {/* ═══ CONTACTOS ═══ */}
            <View style={[st.seccionHeader, { marginTop: spacing[4] }]}>
              <Text style={st.seccionLabel}>CONTACTOS</Text>
              <Text style={st.seccionSub}>Añadir inquilinos</Text>
            </View>

            {inquilinos.length > 0 ? (
              <FlatList
                data={inquilinos}
                keyExtractor={i => i.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
                renderItem={({ item }) => (
                  <ContactoCirculo inq={item} onPress={() => onTocaContacto(item)} />
                )}
              />
            ) : (
              <Text style={[st.noticiaPlaceholderText, { paddingHorizontal: spacing[4] }]}>
                No hay otros inquilinos activos
              </Text>
            )}

            {/* ═══ REPORTAR ACOSO ═══ */}
            <TouchableOpacity
              style={st.reportarBtn}
              onPress={() => setMostrarReporte(true)}
              activeOpacity={0.78}
            >
              <Text style={st.reportarBtnText}>⚠️  Reportar acoso →</Text>
            </TouchableOpacity>

          </ScrollView>
        )}
      </SafeAreaView>

      {/* Modal noticia completa */}
      {noticiaActiva && (
        <NoticiaModal
          noticia={noticiaActiva}
          uid={uid}
          onClose={() => setNoticiaActiva(null)}
          onVotar={(id, op) => votarEncuesta(id, op, uid).catch(() => {})}
        />
      )}

      {/* Modal reporte acoso */}
      <Modal
        visible={mostrarReporte}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMostrarReporte(false)}
      >
        <SafeAreaView style={[st.reporteModal, { backgroundColor: cartasBosque.bruma }]}>
          <View style={st.chatHeader}>
            <TouchableOpacity onPress={() => setMostrarReporte(false)}>
              <Ionicons name="close" size={22} color={cartasBosque.tinta} />
            </TouchableOpacity>
            <Text style={st.chatHeaderNombre}>Reportar acoso</Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={{ padding: spacing[5], flex: 1 }}>
            <Text style={st.reporteLabel}>
              Categoría: Reporte sobre otro inquilino · Subcategoría: Acoso
            </Text>
            <Text style={[st.reporteLabel, { marginTop: spacing[4], marginBottom: spacing[2] }]}>
              Descripción *
            </Text>
            <TextInput
              style={st.reporteInput}
              value={reporteDesc}
              onChangeText={setReporteDesc}
              placeholder="Describe los hechos con fecha y detalle…"
              placeholderTextColor={cartasBosque.niebla}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
          <View style={{ padding: spacing[5] }}>
            <TouchableOpacity
              style={[st.reporteEnviarBtn, (!reporteDesc.trim() || enviandoReporte) && { opacity: 0.5 }]}
              onPress={enviarReporteAcoso}
              disabled={!reporteDesc.trim() || enviandoReporte}
              activeOpacity={0.85}
            >
              {enviandoReporte
                ? <ActivityIndicator color={cartasBosque.bruma} />
                : <Text style={st.reporteEnviarText}>Enviar reporte</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Backdrop */}
      <Animated.View style={[st.backdrop, { opacity: backdropOp }]} pointerEvents="none" />
      <Animated.View style={[st.backdropTouch, { opacity: backdropOp }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={closePanel} activeOpacity={1} />
      </Animated.View>

      {/* Panel lateral */}
      <Animated.View style={[st.panel, { transform: [{ translateX }] }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
          <View style={st.panelHeader}>
            {chatActivo
              ? <TouchableOpacity onPress={() => setChatActivo(null)}>
                  <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
                </TouchableOpacity>
              : <Text style={st.panelTitulo}>Chats</Text>
            }
            <TouchableOpacity onPress={chatActivo ? () => setChatActivo(null) : closePanel}>
              <Ionicons name={chatActivo ? 'home-outline' : 'chevron-forward'} size={22} color={cartasBosque.tinta} />
            </TouchableOpacity>
          </View>

          {chatActivo ? (
            <ChatView
              chat={chatActivo} uid={uid}
              nombre={nombreInq}
              esAdmin={esAdmin}
              onBack={() => setChatActivo(null)}
            />
          ) : (
            <PanelChatList
              chats={chats}
              chatGeneral={chatGeneral}
              uid={uid}
              onSelect={setChatActivo}
              onNuevoChat={() => {
                closePanel();
              }}
              onNuevoGrupo={crearGrupo}
            />
          )}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 22, color: cartasBosque.tinta },

  seccionHeader: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2] },
  seccionLabel: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  seccionSub: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.niebla, marginTop: 2,
  },

  // Noticias banners
  banner: {
    backgroundColor: cartasBosque.pergamino,
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: borderRadius.md, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  bannerFijado: { borderColor: cartasBosque.musgo, borderWidth: 1.5 },
  fijaRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: 2 },
  fijaText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.musgo },
  bannerTag: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.musgo,
    letterSpacing: 0.4, marginBottom: spacing[1],
  },
  bannerTitulo: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: 2,
  },
  bannerContenido: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho, lineHeight: 17,
  },
  bannerFecha: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginTop: spacing[2],
  },

  noticiaPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  noticiaPlaceholderText: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.niebla,
  },

  // Chat feed rows
  chatRow: {
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
  chatRowRight: { alignItems: 'flex-end', gap: 4 },
  chatHora: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla },

  verTodosBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  verTodosText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.bosque },

  // Contactos
  contactoWrap: { alignItems: 'center', width: 64, paddingVertical: spacing[2] },
  contactoCirculo: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: cartasBosque.niebla,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: cartasBosque.pergaminoOscuro,
    overflow: 'hidden', marginBottom: 6,
  },
  contactoImg: { width: 52, height: 52 },
  contactoInicial: {
    fontFamily: 'Inter_700Bold', fontSize: 20, color: cartasBosque.tinta,
  },
  contactoNombre: {
    fontFamily: 'Inter_600SemiBold', fontSize: 11, color: cartasBosque.tinta, textAlign: 'center',
  },
  contactoHab: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, textAlign: 'center',
  },

  // Reportar acoso
  reportarBtn: {
    marginHorizontal: spacing[4], marginTop: spacing[5],
    paddingVertical: spacing[4], paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: '#CDB29D',
    backgroundColor: 'rgba(103,0,16,0.15)',
    alignItems: 'center',
  },
  reportarBtnText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#960018',
  },

  // Badges
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bruma },

  // Panel
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#122A1F', zIndex: 10 },
  backdropTouch: { ...StyleSheet.absoluteFillObject, zIndex: 11 },
  panel: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: PANEL_W,
    zIndex: 20, backgroundColor: cartasBosque.bruma,
    shadowColor: '#122A1F', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: -2, height: 0 },
    elevation: 10, borderLeftWidth: 1, borderLeftColor: cartasBosque.pergaminoOscuro,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  panelTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: cartasBosque.tinta },

  // Buscadores panel
  buscadorWrap: {
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3],
  },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  buscadorInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },

  nuevoBtnsRow: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  nuevoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1],
    paddingVertical: spacing[2], borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.bosque + '55',
  },
  nuevoBtnText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.bosque },

  // Chat view
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  chatHeaderNombre: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  chatVacio: { padding: spacing[8], alignItems: 'center' },
  chatVacioText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.niebla, textAlign: 'center' },
  mencionesPanel: {
    backgroundColor: cartasBosque.pergamino, borderTopWidth: 1,
    borderTopColor: cartasBosque.pergaminoOscuro, paddingVertical: spacing[1],
  },
  mencionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  mencionNombre: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  replyBarWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.niebla + '44',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
  },
  replyBarLine: { width: 3, height: 28, borderRadius: 2, backgroundColor: cartasBosque.bosque },
  replyBarAutor: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho },
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
  inputActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bosque },
  inputField: {
    flex: 1, backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta,
    maxHeight: 100, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  charCount: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginBottom: 6 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  congeladoBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
    backgroundColor: '#E8EBE0',
  },
  congeladoText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tierra },

  // Noticia modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  modalTag: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.musgo, letterSpacing: 0.5 },
  modalScroll: { padding: spacing[5], paddingBottom: spacing[10] },
  modalTitulo: {
    fontFamily: 'Inter_700Bold', fontSize: 22, color: cartasBosque.tinta,
    marginBottom: spacing[1], letterSpacing: -0.2,
  },
  modalFecha: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.niebla, marginBottom: spacing[4] },
  modalImg: { width: '100%', height: 200, borderRadius: borderRadius.md, marginBottom: spacing[4] },
  modalContenido: { fontFamily: 'Inter_400Regular', fontSize: 15, color: cartasBosque.tinta, lineHeight: 23 },

  // Encuesta
  encuestaOpcion: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], marginBottom: spacing[1],
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  encuestaBarra: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: cartasBosque.niebla + '66' },
  encuestaTexto: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta, flex: 1, zIndex: 1 },
  encuestaPct:   { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.musgo, zIndex: 1 },
  encuestaTotal: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.niebla, marginTop: spacing[1] },

  // Reporte acoso modal
  reporteModal: { flex: 1 },
  reporteLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho },
  reporteInput: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4], fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta,
    minHeight: 140,
  },
  reporteEnviarBtn: {
    backgroundColor: '#960018', borderRadius: borderRadius.md,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  reporteEnviarText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.bruma },
});
