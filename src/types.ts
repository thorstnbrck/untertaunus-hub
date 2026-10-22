export type ZoneType =
  | 'lobby'
  | 'focus'
  | 'cowork2'
  | 'lounge'
  | 'fun'
  | 'conference'
  | 'networking';

export type AvailabilityStatus = 'available' | 'focus' | 'away' | 'busy';

export function getZoneFromCoordinates(x: number, y: number): ZoneType {
  if (y < 618) {
    if (x < 698) return 'focus';
    if (x < 1398) return 'cowork2';
    return 'lounge';
  } else {
    if (x < 698) return 'fun';
    if (x < 1398) return 'lobby';
    if (x < 1743) return 'conference';
    return 'networking';
  }
}

export function getZoneMeta(zone: ZoneType): {
  label: string;
  shortLabel: string;
  icon: string;
  colorHex: string;
  colorNum: number;
} {
  switch (zone) {
    case 'focus':
      return {
        label: 'Fokus-Coworking I',
        shortLabel: 'Fokus I',
        icon: '🌿',
        colorHex: '#00A5B5',
        colorNum: 0x00a5b5,
      };
    case 'cowork2':
      return {
        label: 'Team-Studio II',
        shortLabel: 'Studio II',
        icon: '💻',
        colorHex: '#8EAE9D',
        colorNum: 0x8eae9d,
      };
    case 'lounge':
      return {
        label: 'Kaffeeküche & Lounge',
        shortLabel: 'Lounge',
        icon: '☕',
        colorHex: '#E68A36',
        colorNum: 0xe68a36,
      };
    case 'fun':
      return {
        label: 'Fun im Office (Kicker & Arcade)',
        shortLabel: 'Fun-Zone',
        icon: '🎮',
        colorHex: '#8EAE9D',
        colorNum: 0x8eae9d,
      };
    case 'conference':
      return {
        label: 'Konferenzsaal I „Feldberg“',
        shortLabel: 'Konferenzsaal I',
        icon: '🔴',
        colorHex: '#7E1946',
        colorNum: 0x7e1946,
      };
    case 'networking':
      return {
        label: '2. Konferenzraum „Networking-Arena“',
        shortLabel: 'Networking-Arena',
        icon: '🤝',
        colorHex: '#7E1946',
        colorNum: 0x7e1946,
      };
    case 'lobby':
    default:
      return {
        label: 'Eingangshalle & Infopunkt',
        shortLabel: 'Eingangshalle',
        icon: '🏛️',
        colorHex: '#8EAE9D',
        colorNum: 0x8eae9d,
      };
  }
}

export function getPlayerStatusMeta(player: {
  zone?: ZoneType;
  status?: AvailabilityStatus;
  x?: number;
  y?: number;
}): {
  label: string;
  dotHex: string;
  dotNum: number;
  badgeClasses: string;
} {
  const actualZone: ZoneType =
    player.x !== undefined && player.y !== undefined && player.x > 0 && player.y > 0
      ? getZoneFromCoordinates(player.x, player.y)
      : player.zone || 'lobby';

  // 1. Explicit Away / Pause Status
  if (player.status === 'away') {
    return {
      label: '☕ Kurz weg / Kaffeepause',
      dotHex: '#E68A36',
      dotNum: 0xe68a36,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#FDF5EE] px-3 py-1 text-xs font-semibold text-[#B86518] border border-[#E68A36]/40',
    };
  }

  // 2. Active Meeting in Conference Room 1
  if (actualZone === 'conference') {
    return {
      label: '🔴 Im Konferenzsaal I (Besetzt)',
      dotHex: '#7E1946',
      dotNum: 0x7e1946,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#FBF0F4] px-3 py-1 text-xs font-semibold text-[#7E1946] border border-[#7E1946]/25',
    };
  }

  // 3. Active in Networking Arena
  if (actualZone === 'networking') {
    return {
      label: '🤝 Networking-Arena (Im Gespräch)',
      dotHex: '#7E1946',
      dotNum: 0x7e1946,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#FBF0F4] px-3 py-1 text-xs font-semibold text-[#7E1946] border border-[#7E1946]/25',
    };
  }

  // 4. Explicit Busy outside conference
  if (player.status === 'busy') {
    return {
      label: '🔴 Beschäftigt (Bitte nicht stören)',
      dotHex: '#7E1946',
      dotNum: 0x7e1946,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#FBF0F4] px-3 py-1 text-xs font-semibold text-[#7E1946] border border-[#7E1946]/25',
    };
  }

  // 5. In Focus Coworking or explicit focus
  if (actualZone === 'focus' || player.status === 'focus') {
    return {
      label: '🎧 Fokus-Coworking (Deep Work)',
      dotHex: '#00A5B5',
      dotNum: 0x00a5b5,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#EBF9FB] px-3 py-1 text-xs font-semibold text-[#007A87] border border-[#00A5B5]/40',
    };
  }

  // 6. In Kaffeeküche & Lounge
  if (actualZone === 'lounge') {
    return {
      label: '☕ Kaffeeküche & Lounge (Pause)',
      dotHex: '#E68A36',
      dotNum: 0xe68a36,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#FDF5EE] px-3 py-1 text-xs font-semibold text-[#B86518] border border-[#E68A36]/40',
    };
  }

  // 7. In Fun-Zone
  if (actualZone === 'fun') {
    return {
      label: '🎮 Fun-Zone (Ansprechbar)',
      dotHex: '#5F7F6E',
      dotNum: 0x5f7f6e,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#F2F7F4] px-3 py-1 text-xs font-semibold text-[#5F7F6E] border border-[#8EAE9D]/40',
    };
  }

  // 8. In Team-Studio II
  if (actualZone === 'cowork2') {
    return {
      label: '🟢 Im Studio II (Verfügbar)',
      dotHex: '#5F7F6E',
      dotNum: 0x5f7f6e,
      badgeClasses:
        'inline-flex items-center gap-1.5 rounded-full bg-[#F2F7F4] px-3 py-1 text-xs font-semibold text-[#5F7F6E] border border-[#8EAE9D]/40',
    };
  }

  // 9. Default / Eingangshalle
  return {
    label: '🟢 In der Eingangshalle (Verfügbar)',
    dotHex: '#5F7F6E',
    dotNum: 0x5f7f6e,
    badgeClasses:
      'inline-flex items-center gap-1.5 rounded-full bg-[#F2F7F4] px-3 py-1 text-xs font-semibold text-[#5F7F6E] border border-[#8EAE9D]/40',
  };
}

export interface PlayerProfile {
  name: string;
  company: string;
  location: string;
  offers: string;
  seeks: string;
  website?: string;
  color: string;
  status?: AvailabilityStatus;
  customStatus?: string;
  completedQuests?: string[];
  badges?: string[];
}

export interface PlayerState extends PlayerProfile {
  id: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  zone: ZoneType;
  status: AvailabilityStatus;
  customStatus?: string;
  hasCoffee?: boolean;
  isSeated?: boolean;
  isNpc?: boolean;
  bubbleText?: string | null;
  bubbleExpiresAt?: number;
}

export interface BulletinPin {
  id: string;
  type: 'angebot' | 'gesuch' | 'event';
  title: string;
  author: string;
  company: string;
  location: string;
  description: string;
  contact: string;
  createdAt: string;
}

export type ChatRoomType =
  | 'global'
  | 'conference'
  | 'networking'
  | 'lounge'
  | 'focus';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  color: string;
  room?: ChatRoomType;
  recipientId?: string;
  isDirect?: boolean;
}

export interface WhiteboardStroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

export interface WhiteboardSticky {
  id: string;
  text: string;
  author: string;
  color: string;
  x: number;
  y: number;
}

export const EMOTE_SHORTCUTS = [
  { key: '1', emoji: '👋', label: 'Winken' },
  { key: '2', emoji: '☕', label: 'Kaffee?' },
  { key: '3', emoji: '💡', label: 'Idee!' },
  { key: '4', emoji: '👍', label: 'Super' },
  { key: '5', emoji: '🎧', label: 'Deep Work' },
  { key: '6', emoji: '🎉', label: 'Feiern' },
] as const;

export const UNTERTAUNUS_TOWNS = [
  'Taunusstein',
  'Idstein',
  'Bad Schwalbach',
  'Niedernhausen',
  'Aarbergen',
  'Hohenstein',
  'Hünstetten',
  'Heidenrod',
  'Schlangenbad',
  'Waldems',
] as const;

export const AVATAR_PALETTE = [
  { name: 'Taunus-Petrol', hex: '#174955', dark: '#0F323A' },
  { name: 'Warm-Amber', hex: '#E68A36', dark: '#B86518' },
  { name: 'Salbeigrün', hex: '#8EAE9D', dark: '#5F7F6E' },
  { name: 'Beerenrot', hex: '#7E1946', dark: '#580E30' },
  { name: 'Schiefer-Petrol', hex: '#4B6F77', dark: '#334E54' },
  { name: 'Lebendiges Cyan', hex: '#00A5B5', dark: '#007A87' },
  { name: 'Anthrazit', hex: '#2A2E30', dark: '#151718' },
] as const;
