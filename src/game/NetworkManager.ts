import { io, Socket } from 'socket.io-client';
import {
  getZoneFromCoordinates,
  type AvailabilityStatus,
  type BulletinPin,
  type ChatMessage,
  type ChatRoomType,
  type PlayerProfile,
  type PlayerState,
  type WhiteboardSticky,
  type WhiteboardStroke,
  type ZoneType,
} from '../types';

const REGIONAL_NPCS: PlayerState[] = [
  {
    id: 'npc-idstein',
    name: 'Lena Berger',
    company: 'Berger Förderberatung & Digitalisierung',
    location: 'Idstein',
    offers: 'Digitalisierungs-Fördermittel (Hessen/Bund), Prozessberatung für KMU',
    seeks: 'IT-Systemhäuser & Steuerberater im Untertaunus für Kooperationen',
    website: 'https://untertaunus-hub.beispiel.de/lena-berger',
    color: '#174955',
    x: 310,
    y: 230,
    direction: 'up',
    zone: 'focus',
    status: 'focus',
    customStatus: 'Förderantrag Hessen-Digital 📝',
    hasCoffee: true,
    isSeated: true,
    isNpc: true,
    bubbleText: 'Tipp: Klicke auf einen freien Tisch oder Stuhl in deiner Nähe, um dich hinzusetzen!',
    bubbleExpiresAt: Date.now() + 10000,
  },
  {
    id: 'npc-taunusstein',
    name: 'Tim Schneider',
    company: 'Schneider Web & UX Studio',
    location: 'Taunusstein',
    offers: 'Moderne Web-Apps, Barrierefreiheit (BFSG 2025/2026) & UI-Design',
    seeks: 'Texter, Fotografen & Marketing-Freelancer aus der Region',
    website: 'https://untertaunus-hub.beispiel.de/tim-schneider',
    color: '#8EAE9D',
    x: 960,
    y: 230,
    direction: 'up',
    zone: 'cowork2',
    status: 'available',
    customStatus: 'Im neuen Schreibtisch-Raum II 💻',
    hasCoffee: false,
    isSeated: true,
    isNpc: true,
    bubbleText: null,
    bubbleExpiresAt: 0,
  },
  {
    id: 'npc-schwalbach',
    name: 'Dr. Miriam Koch',
    company: 'Kanzlei & Mediation am Kurpark',
    location: 'Bad Schwalbach',
    offers: 'Vertragsrecht für IT/Agenturen, Wirtschaftsmediation & Datenschutz',
    seeks: 'Austausch beim virtuellen Kaffee & spannende Gründer-Projekte',
    website: 'https://untertaunus-hub.beispiel.de/miriam-koch',
    color: '#E68A36',
    x: 1620,
    y: 295,
    direction: 'left',
    zone: 'lounge',
    status: 'available',
    customStatus: 'Kaffeepause in der Lounge ☕',
    hasCoffee: true,
    isNpc: true,
    bubbleText: 'Jemand Lust auf einen kurzen Espresso-Talk in der Lounge? ☕',
    bubbleExpiresAt: Date.now() + 12000,
  },
  {
    id: 'npc-hohenstein',
    name: 'Markus Weber',
    company: 'TaunusCloud & IT-Security GmbH',
    location: 'Hohenstein',
    offers: 'IT-Sicherheit (NIS-2), Cloud-Architektur & M365 für Mittelstand',
    seeks: 'Steuerkanzleien & Produktionsbetriebe im Untertaunus',
    website: 'https://untertaunus-hub.beispiel.de/markus-weber',
    color: '#4B6F77',
    x: 960,
    y: 805,
    direction: 'down',
    zone: 'lobby',
    status: 'available',
    customStatus: 'Am Infopunkt & Schwarzen Brett 🏛️',
    hasCoffee: false,
    isSeated: false,
    isNpc: true,
    bubbleText: 'Willkommen im Hub! Schau gern ans Schwarze Brett für regionale B2B-Projekte. 📌',
    bubbleExpiresAt: Date.now() + 14000,
  },
  {
    id: 'npc-feldberg',
    name: 'Carsten Reuter',
    company: 'Reuter IT-Consulting & Cloud',
    location: 'Idstein',
    offers: 'NIS-2 Compliance, Cloud-Architektur & M365 für KMUs',
    seeks: 'Mittelständische Betriebe & Projektpartner im Untertaunus',
    website: 'https://untertaunus-hub.beispiel.de/carsten-reuter',
    color: '#7E1946',
    x: 1570,
    y: 893,
    direction: 'down',
    zone: 'conference',
    status: 'busy',
    customStatus: 'Im Konferenzsaal I „Feldberg“ 🔴',
    hasCoffee: false,
    isSeated: true,
    isNpc: true,
    bubbleText: 'Live-Meeting im Konferenzsaal I! Schreib gern direkt im Raum-Chat.',
    bubbleExpiresAt: Date.now() + 14000,
  },
  {
    id: 'npc-niedernhausen',
    name: 'Svenja Hartmann',
    company: 'Hartmann B2B-Marketing & Events',
    location: 'Niedernhausen',
    offers: 'LinkedIn-Strategie für den Mittelstand & regionale B2B-Events',
    seeks: 'Spannende Gründer & KMUs im neuen Networking-Konferenzraum',
    website: 'https://untertaunus-hub.beispiel.de/svenja-hartmann',
    color: '#7E1946',
    x: 1826,
    y: 915,
    direction: 'right',
    zone: 'networking',
    status: 'available',
    customStatus: 'Speed-Networking in Raum II 🤝',
    hasCoffee: false,
    isSeated: true,
    isNpc: true,
    bubbleText: 'Kommt gern an den Networking-Tisch für regionale Kooperationen! 🤝',
    bubbleExpiresAt: Date.now() + 14000,
  },
  {
    id: 'npc-aarbergen',
    name: 'Jan-Philipp Kraft',
    company: 'Kraft Holzbau & Smart Energy',
    location: 'Aarbergen',
    offers: 'Gewerbliche PV-Konzepte & nachhaltiger Innenausbau im Rheingau-Taunus',
    seeks: 'Software-Partner für digitales Baustellen- & Kundenportal',
    website: 'https://untertaunus-hub.beispiel.de/jan-kraft',
    color: '#00A5B5',
    x: 340,
    y: 865,
    direction: 'down',
    zone: 'fun',
    status: 'available',
    customStatus: 'Kurze Runde am Tischkicker ⚽',
    hasCoffee: false,
    isNpc: true,
    bubbleText: null,
    bubbleExpiresAt: 0,
  },
];

const NPC_QUOTES: Record<string, string[]> = {
  'npc-idstein': [
    'Klicke einfach auf einen Tisch oder Stuhl in deiner Nähe, um dich hinzusetzen!',
    'Sobald man am Schreibtisch sitzt, wechselt der Tisch direkt seine Farbe!',
    'Bei Fragen zu Digital-Zuschüssen: Klickt einfach auf meinen Avatar.',
  ],
  'npc-taunusstein': [
    'Der 2. Schreibtisch-Raum hier in der Mitte ist perfekt für Projekt-Teams!',
    'Suche noch Copywriter aus Taunusstein oder Umgebung!',
    'Drückt mal die Tasten [1] bis [6] für Schnell-Reaktionen über dem Kopf!',
  ],
  'npc-schwalbach': [
    'Frischer Espresso an der Maschine oben rechts gibt Tempo-Boost! ☕',
    'Setzt euch gern auf einen der Hocker hier am Lounge-Tisch!',
    'Schöne Grüße aus Bad Schwalbach in den gesamten Untertaunus!',
  ],
  'npc-hohenstein': [
    'Willkommen im Untertaunus Hub! Unser Schwarzes Brett hier hat tolle regionale Angebote.',
    'Für IT-Security und Cloud-Architektur in Hohenstein und Umgebung bin ich gern ansprechbar.',
    'Klickt einfach auf meinen Avatar oder pinnt ein neues Gesuch ans Schwarze Brett!',
  ],
  'npc-feldberg': [
    'Hier im Konferenzsaal I haben wir unseren eigenen geschützten Raum-Chat! 🔒',
    'Wer Fragen zu IT-Security oder Cloud-Backups hat: Schreibt gern in den Saal-Chat.',
    'Am Whiteboard rechts im Saal können wir direkt Architektur-Skizzen zeichnen.',
  ],
  'npc-niedernhausen': [
    'Im 2. Konferenzraum „Networking“ unten rechts könnt ihr euch direkt vernetzen! 🤝',
    'Wer sucht noch Kooperationspartner im Raum Niedernhausen / Idstein?',
    'Setzt euch einfach an den runden Networking-Tisch!',
  ],
  'npc-aarbergen': [
    'Der neue Fun-im-Office Raum unten links hat Tischkicker & Arcade! 🎮',
    'Kurze Pause im Sitzsack, danach geht es zurück an den Schreibtisch.',
    'Suchen noch Unterstützung für unser Kundenportal in Aarbergen.',
  ],
};

const NPC_ROOM_REPLIES: Record<'conference' | 'networking', string[]> = {
  conference: [
    'Super Punkt! Lass uns das gern direkt auf dem Team-Whiteboard rechts festhalten. 🎯',
    'Klingt spannend – wir können dazu gern nächste Woche einen kurzen IT-/Projekt-Workshop machen!',
    'Perfekt, da wir hier unter uns im Konferenzsaal I sind, können wir die Details direkt besprechen.',
  ],
  networking: [
    'Klasse! Genau für solche regionalen Kooperationen im Untertaunus ist die Networking-Arena gedacht! 🤝',
    'Spannendes Angebot – lass uns gern direkt vernetzen, ich kenne da zwei passende KMUs aus Idstein!',
    'Super, dass du im Networking-Raum bist! Sollen wir dazu einen gemeinsamen Pitch-Termin aufsetzen?',
  ],
};

const DEFAULT_PINS: BulletinPin[] = [
  {
    id: 'pin-1',
    type: 'angebot',
    title: 'IT-Security & Cloud-Beratung für KMUs im Untertaunus',
    author: 'Markus Weber',
    company: 'TaunusCloud GmbH',
    location: 'Idstein',
    description:
      'Wir unterstützen Handwerksbetriebe und Kanzleien im Raum Idstein/Taunusstein bei NIS-2, Backup-Strategien und Microsoft 365. Kostenloser Erst-Check direkt hier im Konferenzsaal!',
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

type ListenerMap = {
  playersUpdated: (players: PlayerState[]) => void;
  chatMessage: (msg: ChatMessage) => void;
  privateMessage: (msg: ChatMessage) => void;
  pinsUpdated: (pins: BulletinPin[]) => void;
  connectionChanged: (connected: boolean, count: number) => void;
  emoteTriggered: (senderId: string, emoji: string) => void;
  whiteboardUpdated: () => void;
};

export class NetworkManager {
  private socket: Socket | null = null;
  private connected = false;
  private selfId = 'local-player';
  private remotePlayers = new Map<string, PlayerState>();
  private npcs = new Map<string, PlayerState>();
  private pins: BulletinPin[] = [...DEFAULT_PINS];
  private strokes: WhiteboardStroke[] = [];
  private stickies: WhiteboardSticky[] = [
    {
      id: 'sticky-1',
      text: 'Idee: Gemeinsamer Untertaunus KI-Workshop im Herbst 🚀',
      author: 'Lena Berger (Idstein)',
      color: '#EDF5F7',
      x: 30,
      y: 30,
    },
    {
      id: 'sticky-2',
      text: 'Kooperation gesucht: Handwerk + Digital-Agenturen',
      author: 'Jan-Philipp Kraft (Aarbergen)',
      color: '#FDF5EE',
      x: 280,
      y: 45,
    },
  ];

  private chatHistory: ChatMessage[] = [
    {
      id: 'init-1',
      senderId: 'npc-idstein',
      senderName: 'Lena Berger (Idstein)',
      text: 'Willkommen im Untertaunus Digital Business Hub! Klicke auf einen Avatar für die digitale Visitenkarte.',
      timestamp: '09:15',
      color: '#174955',
      room: 'global',
    },
    {
      id: 'init-2',
      senderId: 'npc-schwalbach',
      senderName: 'Dr. Miriam Koch (Bad Schwalbach)',
      text: 'Ich bin in der Kaffeelounge oben rechts – holt euch gern einen Espresso an der Maschine! ☕',
      timestamp: '09:30',
      color: '#E68A36',
      room: 'global',
    },
  ];

  private roomChatHistories: Record<ChatRoomType, ChatMessage[]> =
    {
      global: [],
      conference: [
        {
          id: 'conf-init-1',
          senderId: 'npc-feldberg',
          senderName: 'Carsten Reuter (Idstein)',
          text: 'Willkommen im Konferenzsaal I „Feldberg“! 🔒 Dieser Chat ist nur für Personen sichtbar, die sich aktuell hier im Saal befinden.',
          timestamp: '09:45',
          color: '#7E1946',
          room: 'conference',
        },
      ],
      networking: [
        {
          id: 'net-init-1',
          senderId: 'npc-badcamberg',
          senderName: 'Svenja Hartmann (Bad Camberg)',
          text: 'Hallo in der Networking-Arena! 🤝 Hier im Raum-Chat schreiben nur wir Teilnehmer, die gerade in diesem Konferenzraum stehen oder sitzen.',
          timestamp: '09:50',
          color: '#7E1946',
          room: 'networking',
        },
      ],
      lounge: [
        {
          id: 'lounge-init-1',
          senderId: 'npc-schwalbach',
          senderName: 'Dr. Florian Becker (Bad Schwalbach)',
          text: 'Der Kaffee hier schmeckt heute wieder hervorragend! ☕ Wer braucht noch einen Motivationsschub?',
          timestamp: '09:30',
          color: '#E68A36',
          room: 'lounge',
        },
      ],
      focus: [
        {
          id: 'focus-init-1',
          senderId: 'npc-taunusstein',
          senderName: 'Tim Schneider (Taunusstein)',
          text: 'Guten Morgen! Im Fokus-Bereich bitte leise arbeiten oder für Audio-Calls in den Konferenzraum wechseln. 🌿',
          timestamp: '09:20',
          color: '#00A5B5',
          room: 'focus',
        },
      ],
    };

  private privateChatHistories: Map<string, ChatMessage[]> = new Map();

  private listeners: { [K in keyof ListenerMap]: Set<ListenerMap[K]> } = {
    playersUpdated: new Set(),
    chatMessage: new Set(),
    privateMessage: new Set(),
    pinsUpdated: new Set(),
    connectionChanged: new Set(),
    emoteTriggered: new Set(),
    whiteboardUpdated: new Set(),
  };

  constructor() {
    try {
      const savedPins = localStorage.getItem('taunushub_pins');
      if (savedPins) {
        const parsed = JSON.parse(savedPins);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.pins = parsed;
        }
      }
    } catch {
      // ignore
    }

    REGIONAL_NPCS.forEach((npc) => {
      this.npcs.set(npc.id, { ...npc });
    });

    this.startNpcSimulation();
  }

  public connect(initialProfile: PlayerProfile, startX = 560, startY = 640): void {
    try {
      this.socket = io({
        reconnectionAttempts: 5,
        timeout: 4000,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.selfId = this.socket?.id || 'local-player';
        this.socket?.emit('player:join', {
          ...initialProfile,
          x: startX,
          y: startY,
        });
        this.notifyConnection();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        this.remotePlayers.clear();
        this.notifyConnection();
        this.notifyPlayers();
      });

      this.socket.on('connect_error', () => {
        this.connected = false;
        this.notifyConnection();
      });

      this.socket.on(
        'hub:init',
        (data: {
          selfId: string;
          players: PlayerState[];
          pins: BulletinPin[];
          chatHistory: ChatMessage[];
          roomChatHistories?: Record<string, ChatMessage[]>;
          whiteboard?: {
            strokes: WhiteboardStroke[];
            stickies: WhiteboardSticky[];
          };
        }) => {
          this.selfId = data.selfId;
          this.remotePlayers.clear();
          data.players.forEach((p) => {
            if (p.id !== this.selfId) {
              this.remotePlayers.set(p.id, p);
            }
          });
          if (Array.isArray(data.pins) && data.pins.length > 0) {
            this.pins = data.pins;
            this.notifyPins();
          }
          if (data.roomChatHistories) {
            (['conference', 'networking', 'lounge', 'focus'] as ChatRoomType[]).forEach(
              (r) => {
                if (
                  Array.isArray(data.roomChatHistories?.[r]) &&
                  data.roomChatHistories[r].length > 0
                ) {
                  this.roomChatHistories[r] = data.roomChatHistories[r];
                }
              }
            );
          }
          if (data.whiteboard) {
            this.strokes = data.whiteboard.strokes || [];
            this.stickies = data.whiteboard.stickies || [];
            this.listeners.whiteboardUpdated.forEach((cb) => cb());
          }
          this.notifyPlayers();
          this.notifyConnection();
        }
      );

      this.socket.on('player:joined', (p: PlayerState) => {
        if (p.id !== this.selfId) {
          this.remotePlayers.set(p.id, p);
          this.notifyPlayers();
          this.notifyConnection();
        }
      });

      this.socket.on(
        'player:moved',
        (move: {
          id: string;
          x: number;
          y: number;
          direction: 'up' | 'down' | 'left' | 'right';
          zone: ZoneType;
          status: AvailabilityStatus;
          customStatus?: string;
          hasCoffee?: boolean;
        }) => {
          const existing = this.remotePlayers.get(move.id);
          if (existing) {
            existing.x = move.x;
            existing.y = move.y;
            existing.direction = move.direction;
            existing.zone = move.zone;
            existing.status = move.status;
            if (move.customStatus !== undefined) {
              existing.customStatus = move.customStatus;
            }
            if (move.hasCoffee !== undefined) {
              existing.hasCoffee = move.hasCoffee;
            }
            this.notifyPlayers();
          }
        }
      );

      this.socket.on('player:updated', (p: PlayerState) => {
        if (p.id !== this.selfId) {
          this.remotePlayers.set(p.id, p);
          this.notifyPlayers();
        }
      });

      this.socket.on('player:emote', (payload: { id: string; emoji: string }) => {
        if (payload.id !== this.selfId) {
          this.listeners.emoteTriggered.forEach((cb) =>
            cb(payload.id, payload.emoji)
          );
        }
      });

      this.socket.on('player:left', (id: string) => {
        this.remotePlayers.delete(id);
        this.notifyPlayers();
        this.notifyConnection();
      });

      this.socket.on('chat:message', (msg: ChatMessage) => {
        const room = msg.room || 'global';
        if (room in this.roomChatHistories) {
          this.roomChatHistories[room].push(msg);
        }
        if (room === 'global') {
          this.chatHistory.push(msg);
        }
        const sender = this.remotePlayers.get(msg.senderId);
        if (sender) {
          sender.bubbleText = msg.text;
          sender.bubbleExpiresAt = Date.now() + 6000;
          this.notifyPlayers();
        }
        this.listeners.chatMessage.forEach((cb) => cb(msg));
      });

      const handleIncomingPrivateMessage = (msg: ChatMessage) => {
        const partnerId =
          msg.senderId === this.selfId ? msg.recipientId : msg.senderId;
        if (partnerId) {
          if (!this.privateChatHistories.has(partnerId)) {
            this.privateChatHistories.set(partnerId, []);
          }
          const list = this.privateChatHistories.get(partnerId)!;
          const alreadyExists = list.some(
            (existing) =>
              existing.id === msg.id ||
              (existing.senderId === msg.senderId &&
                existing.recipientId === msg.recipientId &&
                existing.text === msg.text)
          );
          if (!alreadyExists) {
            list.push(msg);
            this.listeners.privateMessage.forEach((cb) => cb(msg));
          }
        }
      };

      this.socket.on('chat:private', handleIncomingPrivateMessage);

      this.socket.on('bulletin:added', (pin: BulletinPin) => {
        if (!this.pins.some((existing) => existing.id === pin.id)) {
          this.pins.unshift(pin);
          this.savePinsLocally();
          this.notifyPins();
        }
      });

      this.socket.on('whiteboard:stroke', (stroke: WhiteboardStroke) => {
        this.strokes.push(stroke);
        this.listeners.whiteboardUpdated.forEach((cb) => cb());
      });

      this.socket.on('whiteboard:sticky', (sticky: WhiteboardSticky) => {
        this.stickies.push(sticky);
        this.listeners.whiteboardUpdated.forEach((cb) => cb());
      });

      this.socket.on('whiteboard:clear', () => {
        this.strokes = [];
        this.stickies = [];
        this.listeners.whiteboardUpdated.forEach((cb) => cb());
      });
    } catch {
      this.connected = false;
      this.notifyConnection();
    }
  }

  public sendMove(
    x: number,
    y: number,
    direction: 'up' | 'down' | 'left' | 'right',
    zone: ZoneType,
    hasCoffee = false
  ): void {
    if (this.connected && this.socket) {
      this.socket.emit('player:move', { x, y, direction, zone, hasCoffee });
    }
  }

  public updateProfile(
    profile: PlayerProfile & { hasCoffee?: boolean }
  ): void {
    if (this.connected && this.socket) {
      this.socket.emit('player:updateProfile', profile);
    }
  }

  public sendEmote(emoji: string): void {
    if (this.connected && this.socket) {
      this.socket.emit('player:emote', { emoji });
    }
  }

  public sendChatMessage(
    text: string,
    localProfile: PlayerProfile,
    room: ChatRoomType = 'global'
  ): ChatMessage | null {
    const clean = text.trim().slice(0, 240);
    if (!clean) return null;

    if (this.connected && this.socket) {
      this.socket.emit('chat:message', {
        text: clean,
        senderName: `${localProfile.name} (${localProfile.location})`,
        color: localProfile.color,
        room,
      });
      if (room === 'conference' || room === 'networking') {
        this.triggerNpcConferenceReply(room);
      }
      return null;
    }

    const now = new Date();
    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      senderId: this.selfId,
      senderName: `${localProfile.name} (${localProfile.location})`,
      text: clean,
      timestamp: now.toTimeString().slice(0, 5),
      color: localProfile.color,
      room,
    };
    if (room !== 'global') {
      if (!this.roomChatHistories[room]) {
        this.roomChatHistories[room] = [];
      }
      this.roomChatHistories[room].push(msg);
      if (room === 'conference' || room === 'networking') {
        this.triggerNpcConferenceReply(room);
      }
    } else {
      this.chatHistory.push(msg);
    }
    this.listeners.chatMessage.forEach((cb) => cb(msg));
    return msg;
  }

  public sendPrivateMessage(
    recipientId: string,
    text: string,
    localProfile: PlayerProfile
  ): ChatMessage | null {
    const clean = text.trim().slice(0, 240);
    if (!clean || !recipientId) return null;

    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 5);
    const msgId = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const msg: ChatMessage = {
      id: msgId,
      senderId: this.selfId,
      senderName: `${localProfile.name} (${localProfile.location})`,
      recipientId,
      text: clean,
      timestamp,
      color: localProfile.color,
      isDirect: true,
    };

    if (!this.privateChatHistories.has(recipientId)) {
      this.privateChatHistories.set(recipientId, []);
    }
    const list = this.privateChatHistories.get(recipientId)!;
    if (!list.some((m) => m.id === msg.id)) {
      list.push(msg);
    }

    if (this.connected && this.socket) {
      this.socket.emit('chat:private', {
        id: msgId,
        recipientId,
        text: clean,
      });
    } else {
      // Local fallback simulation if server is offline
      this.listeners.privateMessage.forEach((cb) => cb(msg));
      if (recipientId.startsWith('npc-')) {
        setTimeout(() => {
          const npc = this.npcs.get(recipientId);
          const replyText =
            'Hallo! Vielen Dank für deine Nachricht. Ich freue mich über den regionalen Austausch im Untertaunus Hub! 🤝';
          const botMsg: ChatMessage = {
            id: `pm-bot-${Date.now()}`,
            senderId: recipientId,
            senderName: npc?.name || 'Demo-Bot',
            recipientId: this.selfId,
            text: replyText,
            timestamp: new Date().toTimeString().slice(0, 5),
            color: npc?.color || '#174955',
            isDirect: true,
          };
          list.push(botMsg);
          this.listeners.privateMessage.forEach((cb) => cb(botMsg));
        }, 1200);
      }
    }

    return msg;
  }

  private triggerNpcConferenceReply(room: 'conference' | 'networking'): void {
    const roomNpc = Array.from(this.npcs.values()).find(
      (n) => n.zone === room
    );
    if (!roomNpc) return;

    setTimeout(() => {
      const pool = NPC_ROOM_REPLIES[room];
      const replyText = pool[Math.floor(Math.random() * pool.length)];
      const now = new Date();
      const replyMsg: ChatMessage = {
        id: `npc-room-${Date.now()}`,
        senderId: roomNpc.id,
        senderName: `${roomNpc.name} (${roomNpc.location})`,
        text: replyText,
        timestamp: now.toTimeString().slice(0, 5),
        color: roomNpc.color,
        room,
      };
      this.roomChatHistories[room].push(replyMsg);
      roomNpc.bubbleText = replyText;
      roomNpc.bubbleExpiresAt = Date.now() + 6000;
      this.notifyPlayers();
      this.listeners.chatMessage.forEach((cb) => cb(replyMsg));
    }, 1100);
  }

  public addBulletinPin(
    pinInput: Omit<BulletinPin, 'id' | 'createdAt'>
  ): BulletinPin {
    const newPin: BulletinPin = {
      ...pinInput,
      id: `pin-${Date.now()}`,
      createdAt: 'Gerade eben',
    };

    if (this.connected && this.socket) {
      this.socket.emit('bulletin:add', newPin);
    } else {
      this.pins.unshift(newPin);
      this.savePinsLocally();
      this.notifyPins();
    }
    return newPin;
  }

  public addWhiteboardStroke(stroke: WhiteboardStroke): void {
    this.strokes.push(stroke);
    if (this.connected && this.socket) {
      this.socket.emit('whiteboard:stroke', stroke);
    }
  }

  public addWhiteboardSticky(sticky: WhiteboardSticky): void {
    this.stickies.push(sticky);
    if (this.connected && this.socket) {
      this.socket.emit('whiteboard:sticky', sticky);
    } else {
      this.listeners.whiteboardUpdated.forEach((cb) => cb());
    }
  }

  public clearWhiteboard(): void {
    this.strokes = [];
    this.stickies = [];
    if (this.connected && this.socket) {
      this.socket.emit('whiteboard:clear');
    } else {
      this.listeners.whiteboardUpdated.forEach((cb) => cb());
    }
  }

  public getWhiteboardData(): {
    strokes: WhiteboardStroke[];
    stickies: WhiteboardSticky[];
  } {
    return { strokes: this.strokes, stickies: this.stickies };
  }

  public getOtherPlayers(): PlayerState[] {
    const list = [
      ...Array.from(this.remotePlayers.values()),
      ...Array.from(this.npcs.values()),
    ];
    return list.map((p) => ({
      ...p,
      zone: getZoneFromCoordinates(p.x, p.y),
    }));
  }

  public getPlayersInZone(zone: ZoneType): PlayerState[] {
    return this.getOtherPlayers().filter((p) => p.zone === zone);
  }

  public getPins(): BulletinPin[] {
    return this.pins;
  }

  public getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  public getRoomChatHistory(room: ChatRoomType): ChatMessage[] {
    if (room === 'global') return [...this.chatHistory];
    return [...(this.roomChatHistories[room] || [])];
  }

  public getPrivateChatHistory(partnerId: string): ChatMessage[] {
    return [...(this.privateChatHistories.get(partnerId) || [])];
  }

  public getSelfId(): string {
    return this.selfId;
  }

  public getOnlineCount(): number {
    return 1 + this.remotePlayers.size + this.npcs.size;
  }

  public isServerConnected(): boolean {
    return this.connected;
  }

  public on<K extends keyof ListenerMap>(event: K, cb: ListenerMap[K]): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private savePinsLocally(): void {
    try {
      localStorage.setItem('taunushub_pins', JSON.stringify(this.pins));
    } catch {
      // ignore
    }
  }

  private notifyPlayers(): void {
    const list = this.getOtherPlayers();
    this.listeners.playersUpdated.forEach((cb) => cb(list));
  }

  private notifyPins(): void {
    this.listeners.pinsUpdated.forEach((cb) => cb(this.pins));
  }

  private notifyConnection(): void {
    const total = this.getOnlineCount();
    this.listeners.connectionChanged.forEach((cb) => cb(this.connected, total));
  }

  private startNpcSimulation(): void {
    const origins = new Map<string, { x: number; y: number }>();
    REGIONAL_NPCS.forEach((n) => origins.set(n.id, { x: n.x, y: n.y }));
    const npcEmojis = ['👋', '☕', '💡', '👍'];

    setInterval(() => {
      const npcArray = Array.from(this.npcs.values());
      const randomNpc = npcArray[Math.floor(Math.random() * npcArray.length)];
      if (!randomNpc) return;

      const origin = origins.get(randomNpc.id) || { x: randomNpc.x, y: randomNpc.y };
      // Seated NPCs remain on their desk chair so their desk stays colored as occupied
      const radius = randomNpc.isSeated ? 0 : 28;
      const offsetX = (Math.random() - 0.5) * radius;
      const offsetY = (Math.random() - 0.5) * radius;
      randomNpc.x = Math.round(origin.x + offsetX);
      randomNpc.y = Math.round(origin.y + offsetY);

      if (Math.random() < 0.35) {
        const quotes = NPC_QUOTES[randomNpc.id] || [];
        if (quotes.length > 0) {
          const text = quotes[Math.floor(Math.random() * quotes.length)];
          randomNpc.bubbleText = text;
          randomNpc.bubbleExpiresAt = Date.now() + 6000;
        }
      } else if (Math.random() < 0.3) {
        const emoji = npcEmojis[Math.floor(Math.random() * npcEmojis.length)];
        this.listeners.emoteTriggered.forEach((cb) => cb(randomNpc.id, emoji));
      }

      this.notifyPlayers();
    }, 5500);
  }
}
