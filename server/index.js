import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets from built Vite frontend
app.use(express.static(distPath));

// Health-check endpoint for Render / Uptime monitors
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', hub: 'Untertaunus Digital Business Hub' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const players = new Map();

const bulletinPins = [
  {
    id: 'pin-1',
    type: 'angebot',
    title: 'IT-Security & Cloud-Beratung für KMUs im Untertaunus',
    author: 'Markus Weber',
    company: 'TaunusCloud GmbH',
    location: 'Idstein',
    description:
      'Wir unterstützen Handwerksbetriebe und Steuerkanzleien im Raum Idstein/Taunusstein bei NIS-2, Backup-Strategien und Microsoft 365. Kostenloser Erst-Check im Konferenzsaal!',
    contact: 'm.weber@taunuscloud-beispiel.de',
    createdAt: 'Vor 2 Stunden',
  },
  {
    id: 'pin-2',
    type: 'gesuch',
    title: 'Suche Grafikdesign / Branding-Partner für regionales Bio-Start-up',
    author: 'Julia Hofmann',
    company: 'Aar-Naturkost',
    location: 'Aarbergen',
    description:
      'Für unsere neue Produktlinie suchen wir eine kreative Agentur oder Freelancer aus dem Untertaunus für Verpackungsdesign und Webshop-Begleitung.',
    contact: 'julia@aar-naturkost-beispiel.de',
    createdAt: 'Vor 5 Stunden',
  },
  {
    id: 'pin-3',
    type: 'event',
    title: 'Untertaunus Digital-Frühstück & Speed-Networking',
    author: 'Wirtschaftsförderung / Hub-Team',
    company: 'Untertaunus Digital Business Hub',
    location: 'Bad Schwalbach',
    description:
      'Jeden Donnerstag um 09:00 Uhr hier in der virtuellen Kaffeeküche & im Konferenzsaal: 30 Minuten Kennenlernen, Austausch zu KI-Tools im Mittelstand & regionale Kooperationen.',
    contact: 'Konferenzsaal im Hub',
    createdAt: 'Heute, 08:30 Uhr',
  },
  {
    id: 'pin-4',
    type: 'angebot',
    title: 'Freie Schreibtische & Co-Working-Tagespässe in Taunusstein-Hahn',
    author: 'Sabine Krämer',
    company: 'KreativWerk Taunusstein',
    location: 'Taunusstein',
    description:
      'Wer neben dem digitalen Hub auch mal physisch zusammenarbeiten möchte: Wir haben 4 ruhige Flex-Desks inkl. Glasfaser und Siebträger-Espresso frei.',
    contact: 'hallo@kreativwerk-taunusstein.de',
    createdAt: 'Gestern',
  },
];

const whiteboardStrokes = [];
const whiteboardStickies = [
  {
    id: 'sticky-1',
    text: 'Idee: Gemeinsamer Untertaunus KI-Workshop im Herbst 🚀',
    author: 'Lena Berger (Idstein)',
    color: '#EDF5F7',
    x: 40,
    y: 40,
  },
  {
    id: 'sticky-2',
    text: 'Wer hat Lust auf eine Fahrgemeinschaft zur Messe nach Frankfurt?',
    author: 'Tim Schneider (Taunusstein)',
    color: '#FDF5EE',
    x: 310,
    y: 55,
  },
];

const chatHistory = [
  {
    id: 'msg-init-1',
    senderId: 'npc-idstein',
    senderName: 'Lena Berger (Idstein)',
    text: 'Guten Morgen in die Runde! Falls jemand Fragen zu Fördermitteln für Digitalisierung hat – sprecht mich gern an.',
    timestamp: '09:15',
    color: '#174955',
  },
  {
    id: 'msg-init-2',
    senderId: 'npc-taunusstein',
    senderName: 'Tim Schneider (Taunusstein)',
    text: 'Moin! Ich sitze heute im Fokus-Bereich an einem Web-Projekt, bin ab 14 Uhr in der Kaffeelounge.',
    timestamp: '09:42',
    color: '#E68A36',
  },
];

const roomChatHistories = {
  conference: [],
  networking: [],
};

app.get('/api/status', (_req, res) => {
  res.json({
    onlineCount: players.size,
    pinsCount: bulletinPins.length,
    status: 'ok',
  });
});

io.on('connection', (socket) => {
  socket.emit('hub:init', {
    selfId: socket.id,
    players: Array.from(players.values()),
    pins: bulletinPins,
    chatHistory: chatHistory.slice(-30),
    roomChatHistories: {
      conference: roomChatHistories.conference.slice(-30),
      networking: roomChatHistories.networking.slice(-30),
    },
    whiteboard: {
      strokes: whiteboardStrokes,
      stickies: whiteboardStickies,
    },
  });

  socket.on('player:join', (profile) => {
    const playerState = {
      id: socket.id,
      name: profile.name || 'Gast aus dem Taunus',
      company: profile.company || 'Selbstständig',
      location: profile.location || 'Taunusstein',
      offers: profile.offers || 'Netzwerken & Austausch',
      seeks: profile.seeks || 'Spannende Kontakte in der Region',
      website: profile.website || '',
      color: profile.color || '#174955',
      x: profile.x ?? 560,
      y: profile.y ?? 640,
      direction: 'up',
      zone: 'lobby',
      status: profile.status || 'available',
      customStatus: profile.customStatus || '',
      hasCoffee: false,
      bubbleText: null,
      bubbleExpiresAt: 0,
    };
    players.set(socket.id, playerState);
    io.emit('player:joined', playerState);
    io.emit('hub:onlineCount', players.size);
  });

  socket.on('player:move', (moveData) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.x = moveData.x;
    p.y = moveData.y;
    p.direction = moveData.direction || p.direction;
    p.zone = moveData.zone || p.zone;
    if (typeof moveData.hasCoffee === 'boolean') {
      p.hasCoffee = moveData.hasCoffee;
    }
    socket.broadcast.emit('player:moved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      direction: p.direction,
      zone: p.zone,
      status: p.status,
      customStatus: p.customStatus,
      hasCoffee: p.hasCoffee,
    });
  });

  socket.on('player:updateProfile', (profile) => {
    const p = players.get(socket.id);
    if (!p) return;
    Object.assign(p, {
      name: profile.name ?? p.name,
      company: profile.company ?? p.company,
      location: profile.location ?? p.location,
      offers: profile.offers ?? p.offers,
      seeks: profile.seeks ?? p.seeks,
      website: profile.website ?? p.website,
      color: profile.color ?? p.color,
      status: profile.status ?? p.status,
      customStatus: profile.customStatus ?? p.customStatus,
      hasCoffee: profile.hasCoffee ?? p.hasCoffee,
    });
    io.emit('player:updated', p);
  });

  socket.on('player:emote', (payload) => {
    const emoji = String(payload?.emoji || '👋').slice(0, 8);
    io.emit('player:emote', {
      id: socket.id,
      emoji,
    });
  });

  socket.on('chat:message', (payload) => {
    const p = players.get(socket.id);
    const senderName = p
      ? `${p.name} (${p.location})`
      : payload.senderName || 'Teilnehmer';
    const color = p ? p.color : payload.color || '#174955';
    const text = String(payload.text || '').trim().slice(0, 180);
    if (!text) return;

    const requestedRoom = payload.room;
    const room =
      requestedRoom === 'conference' || requestedRoom === 'networking'
        ? requestedRoom
        : 'global';

    // Only allow sending to a conference room chat if the player is in that room
    if (room !== 'global' && p && p.zone !== room) {
      return;
    }

    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 5);
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: socket.id,
      senderName,
      text,
      timestamp,
      color,
      room,
    };

    if (p) {
      p.bubbleText = text;
      p.bubbleExpiresAt = Date.now() + 6000;
    }

    if (room === 'conference' || room === 'networking') {
      roomChatHistories[room].push(msg);
      if (roomChatHistories[room].length > 50) roomChatHistories[room].shift();

      // Deliver strictly to players currently inside this specific conference room
      for (const [peerSocketId, peerState] of players.entries()) {
        if (peerState.zone === room || peerSocketId === socket.id) {
          io.to(peerSocketId).emit('chat:message', msg);
        }
      }
    } else {
      chatHistory.push(msg);
      if (chatHistory.length > 50) chatHistory.shift();
      io.emit('chat:message', msg);
    }
  });

  socket.on('bulletin:add', (pinData) => {
    const newPin = {
      id: `pin-${Date.now()}`,
      type: ['angebot', 'gesuch', 'event'].includes(pinData.type)
        ? pinData.type
        : 'angebot',
      title: String(pinData.title || '').trim().slice(0, 90),
      author: String(pinData.author || 'Hub-Mitglied').trim().slice(0, 60),
      company: String(pinData.company || '').trim().slice(0, 60),
      location: String(pinData.location || 'Untertaunus').trim().slice(0, 40),
      description: String(pinData.description || '').trim().slice(0, 360),
      contact: String(pinData.contact || '').trim().slice(0, 100),
      createdAt: 'Gerade eben',
    };
    if (!newPin.title || !newPin.description) return;
    bulletinPins.unshift(newPin);
    io.emit('bulletin:added', newPin);
  });

  socket.on('whiteboard:stroke', (stroke) => {
    if (whiteboardStrokes.length > 300) whiteboardStrokes.shift();
    whiteboardStrokes.push(stroke);
    socket.broadcast.emit('whiteboard:stroke', stroke);
  });

  socket.on('whiteboard:sticky', (sticky) => {
    if (whiteboardStickies.length > 20) whiteboardStickies.shift();
    whiteboardStickies.push(sticky);
    io.emit('whiteboard:sticky', sticky);
  });

  socket.on('whiteboard:clear', () => {
    whiteboardStrokes.length = 0;
    whiteboardStickies.length = 0;
    io.emit('whiteboard:clear');
  });

  socket.on('disconnect', () => {
    if (players.has(socket.id)) {
      players.delete(socket.id);
      io.emit('player:left', socket.id);
      io.emit('hub:onlineCount', players.size);
    }
  });
});

// SPA fallback: Send built index.html for any frontend web routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(
    `[Untertaunus Hub Server] Socket.io & Express aktiv auf http://localhost:${PORT}`
  );
});
