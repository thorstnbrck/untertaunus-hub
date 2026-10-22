import type { CoworkingScene } from '../game/CoworkingScene';
import type { NetworkManager } from '../game/NetworkManager';
import {
  escapeHtml,
  safeShowModal,
} from './Modals';
import {
  getPlayerStatusMeta,
  getZoneMeta,
  type ChatMessage,
  type ChatRoomType,
  type PlayerProfile,
  type PlayerState,
  type ZoneType,
} from '../types';

export interface RoomDefinition {
  id: ChatRoomType;
  label: string;
  icon: string;
  description: string;
  allowedZones: ZoneType[];
  teleportZone: ZoneType;
}

export const CHAT_ROOMS: RoomDefinition[] = [
  {
    id: 'global',
    label: '#allgemein',
    icon: '🌐',
    description: 'Offener Hub-weiter Chat – erreichbar für alle Teilnehmer im gesamten Coworking Space.',
    allowedZones: ['lobby', 'focus', 'cowork2', 'lounge', 'fun', 'conference', 'networking'],
    teleportZone: 'lobby',
  },
  {
    id: 'lounge',
    label: '#kaffeeküche-lounge',
    icon: '☕',
    description: 'Plauderecke an der Siebträger-Bar & Lounge – nur für Teilnehmer in der Kaffeeküche.',
    allowedZones: ['lounge'],
    teleportZone: 'lounge',
  },
  {
    id: 'focus',
    label: '#coworking-fokus',
    icon: '🌿',
    description: 'Fokus- & Teamarbeitsbereich – nur für Teilnehmer an den Coworking-Schreibtischen.',
    allowedZones: ['focus', 'cowork2'],
    teleportZone: 'focus',
  },
  {
    id: 'conference',
    label: '#konferenzsaal',
    icon: '🔒',
    description: 'Konferenz- & Networking-Säle – nur für Teilnehmer in Saal I & Saal II.',
    allowedZones: ['conference', 'networking'],
    teleportZone: 'conference',
  },
];

export type ActiveChatTarget =
  | { type: 'room'; room: RoomDefinition }
  | { type: 'dm'; partner: PlayerState };

export class ChatCenter {
  private dialog: HTMLDialogElement;
  private network: NetworkManager;
  private coworkingScene: CoworkingScene;
  private getLocalProfile: () => PlayerProfile;

  private currentZone: ZoneType = 'lobby';
  private activeTarget: ActiveChatTarget = {
    type: 'room',
    room: CHAT_ROOMS[0],
  };

  private unreadByPartner = new Map<string, number>();
  private onWalkToPlayer?: (playerId: string) => void;
  private onOpenVCard?: (player: PlayerState) => void;

  constructor(
    dialog: HTMLDialogElement,
    network: NetworkManager,
    coworkingScene: CoworkingScene,
    getLocalProfile: () => PlayerProfile,
    options?: {
      onWalkToPlayer?: (playerId: string) => void;
      onOpenVCard?: (player: PlayerState) => void;
    }
  ) {
    this.dialog = dialog;
    this.network = network;
    this.coworkingScene = coworkingScene;
    this.getLocalProfile = getLocalProfile;
    this.onWalkToPlayer = options?.onWalkToPlayer;
    this.onOpenVCard = options?.onOpenVCard;

    this.setupListeners();
    this.updateBadges();
  }

  private setupListeners(): void {
    const closeBtn = this.dialog.querySelector('#chat-center-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const form = this.dialog.querySelector('#chat-center-form') as HTMLFormElement;
    const input = this.dialog.querySelector('#chat-center-input') as HTMLInputElement;

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      this.sendMessage(text);
      input.value = '';
    });

    // Listen to incoming messages
    this.network.on('chatMessage', (msg: ChatMessage) => {
      this.handleIncomingMessage(msg);
    });

    this.network.on('privateMessage', (msg: ChatMessage) => {
      this.handleIncomingMessage(msg);
    });

    this.network.on('playersUpdated', () => {
      if (this.isOpen()) {
        this.renderDmsList();
        this.renderActiveHeader();
      }
    });
  }

  public isOpen(): boolean {
    return this.dialog.open;
  }

  public open(): void {
    safeShowModal(this.dialog);
    this.render();
    setTimeout(() => {
      const input = this.dialog.querySelector('#chat-center-input') as HTMLInputElement;
      input?.focus();
    }, 60);
  }

  public close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  public toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  public setZone(zone: ZoneType): void {
    const oldZone = this.currentZone;
    this.currentZone = zone;

    // If currently in a room chat that is not allowed in new zone, auto-fallback to #allgemein
    if (this.activeTarget.type === 'room') {
      const isAllowed = this.activeTarget.room.allowedZones.includes(zone);
      if (!isAllowed) {
        this.activeTarget = {
          type: 'room',
          room: CHAT_ROOMS[0], // #allgemein
        };
      }
    }

    if (this.isOpen() || oldZone !== zone) {
      this.renderRoomsList();
      this.renderActiveHeader();
      this.renderActiveFeed();
    }
  }

  public selectRoom(roomId: ChatRoomType): void {
    const target = CHAT_ROOMS.find((r) => r.id === roomId) || CHAT_ROOMS[0];
    const isAllowed = target.allowedZones.includes(this.currentZone);

    if (!isAllowed) {
      this.showZoneLockedHint(target);
      return;
    }

    this.activeTarget = { type: 'room', room: target };
    this.render();
    const input = this.dialog.querySelector('#chat-center-input') as HTMLInputElement;
    input?.focus();
  }

  public selectDm(partner: PlayerState): void {
    this.activeTarget = { type: 'dm', partner };
    this.unreadByPartner.delete(partner.id);
    this.updateBadges();
    this.render();
    const input = this.dialog.querySelector('#chat-center-input') as HTMLInputElement;
    input?.focus();
  }

  public selectDmById(partnerId: string): void {
    const all = this.network.getOtherPlayers();
    const found = all.find((p) => p.id === partnerId);
    if (found) {
      this.selectDm(found);
    }
  }

  private sendMessage(text: string): void {
    const profile = this.getLocalProfile();
    if (this.activeTarget.type === 'room') {
      const room = this.activeTarget.room;
      if (!room.allowedZones.includes(this.currentZone)) {
        this.showZoneLockedHint(room);
        return;
      }
      this.network.sendChatMessage(text, profile, room.id);
      this.coworkingScene.showLocalSpeechBubble(text);
    } else {
      const partner = this.activeTarget.partner;
      this.network.sendPrivateMessage(partner.id, text, profile);
    }

    this.renderActiveFeed();
  }

  private handleIncomingMessage(msg: ChatMessage): void {
    const selfId = this.network.getSelfId();

    if (msg.isDirect) {
      const partnerId = msg.senderId === selfId ? msg.recipientId : msg.senderId;
      if (partnerId) {
        const isCurrentlyViewing =
          this.isOpen() &&
          this.activeTarget.type === 'dm' &&
          this.activeTarget.partner.id === partnerId;

        if (!isCurrentlyViewing && msg.senderId !== selfId) {
          const current = this.unreadByPartner.get(partnerId) || 0;
          this.unreadByPartner.set(partnerId, current + 1);
        } else if (isCurrentlyViewing) {
          this.unreadByPartner.delete(partnerId);
        }
      }
    }

    this.updateBadges();

    if (this.isOpen()) {
      this.renderDmsList();
      this.renderActiveFeed();
    }
  }

  private updateBadges(): void {
    let totalUnread = 0;
    this.unreadByPartner.forEach((count) => {
      totalUnread += count;
    });

    const badge = document.getElementById('chat-center-badge');
    if (badge) {
      if (totalUnread > 0) {
        badge.textContent = String(totalUnread);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  public render(): void {
    this.renderRoomsList();
    this.renderDmsList();
    this.renderActiveHeader();
    this.renderActiveFeed();
    this.updateInputState();
  }

  private renderRoomsList(): void {
    const container = this.dialog.querySelector('#chat-center-rooms-list');
    if (!container) return;

    container.innerHTML = '';
    CHAT_ROOMS.forEach((room) => {
      const isAllowed = room.allowedZones.includes(this.currentZone);
      const isSelected =
        this.activeTarget.type === 'room' &&
        this.activeTarget.room.id === room.id;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer ${
        isSelected
          ? 'bg-[#174955] text-white shadow-xs font-bold'
          : isAllowed
          ? 'hover:bg-[#174955]/10 text-[#174955] font-semibold'
          : 'opacity-50 hover:opacity-75 bg-[#F0F3F4] text-[#4B6F77] cursor-not-allowed'
      }`;

      btn.innerHTML = `
        <div class="flex items-center gap-2 truncate">
          <span class="text-sm select-none">${room.icon}</span>
          <span class="text-xs truncate">${escapeHtml(room.label)}</span>
        </div>
        <div class="shrink-0 flex items-center">
          ${
            room.id === 'global'
              ? '<span class="text-[9.5px] px-1.5 py-0.5 rounded bg-white/20 text-current font-bold">Global</span>'
              : isAllowed
              ? '<span class="text-[9.5px] px-1.5 py-0.5 rounded bg-[#5F7F6E]/20 text-[#2D6A4F] dark:text-white font-extrabold flex items-center gap-1">🟢 Hier</span>'
              : '<span class="text-[9.5px] px-1.5 py-0.5 rounded bg-black/10 text-current font-bold flex items-center gap-1">🔒 Sperre</span>'
          }
        </div>
      `;

      btn.addEventListener('click', () => {
        this.selectRoom(room.id);
      });

      container.appendChild(btn);
    });
  }

  private renderDmsList(): void {
    const container = this.dialog.querySelector('#chat-center-dms-list');
    if (!container) return;

    const others = this.network.getOtherPlayers();
    container.innerHTML = '';

    if (others.length === 0) {
      container.innerHTML = `
        <div class="p-3 text-center text-xs text-[#4B6F77]">
          Keine anderen Teilnehmer im Hub.
        </div>
      `;
      return;
    }

    others.forEach((p) => {
      const isSelected =
        this.activeTarget.type === 'dm' &&
        this.activeTarget.partner.id === p.id;
      const unread = this.unreadByPartner.get(p.id) || 0;
      const statusMeta = getPlayerStatusMeta({
        status: p.status,
        zone: p.zone,
        x: p.x,
        y: p.y,
      });

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left p-2 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer ${
        isSelected
          ? 'bg-[#174955] text-white shadow-xs font-bold'
          : 'hover:bg-[#174955]/10 text-[#174955]'
      }`;

      btn.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <div class="relative shrink-0">
            <span class="inline-block h-3 w-3 rounded-full" style="background-color: ${escapeHtml(
              p.color || '#174955'
            )}"></span>
            <span class="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full" style="background-color: ${
              statusMeta.dotHex
            }"></span>
          </div>
          <div class="min-w-0 truncate">
            <div class="text-xs truncate flex items-center gap-1">
              <span class="truncate ${isSelected ? 'text-white' : 'text-[#174955]'} font-bold">
                ${escapeHtml(p.name)}
              </span>
              ${
                p.isNpc
                  ? '<span class="rounded bg-black/10 px-1 py-0.2 text-[8.5px] font-extrabold uppercase">Bot</span>'
                  : ''
              }
            </div>
            <div class="text-[9.5px] truncate ${
              isSelected ? 'text-white/80' : 'text-[#4B6F77]'
            }">
              ${escapeHtml(p.company || p.location)}
            </div>
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-1">
          ${
            unread > 0
              ? `<span class="rounded-full bg-[#E68A36] px-1.5 py-0.2 text-[9.5px] font-extrabold text-white animate-pulse">${unread}</span>`
              : ''
          }
        </div>
      `;

      btn.addEventListener('click', () => {
        this.selectDm(p);
      });

      container.appendChild(btn);
    });
  }

  private renderActiveHeader(): void {
    const titleEl = this.dialog.querySelector('#chat-center-active-title');
    const subtitleEl = this.dialog.querySelector('#chat-center-active-subtitle');
    const actionsEl = this.dialog.querySelector('#chat-center-active-actions');

    if (!titleEl || !subtitleEl || !actionsEl) return;
    actionsEl.innerHTML = '';

    if (this.activeTarget.type === 'room') {
      const room = this.activeTarget.room;
      titleEl.innerHTML = `<span>${room.icon}</span> <span>${escapeHtml(room.label)}</span>`;
      subtitleEl.textContent = room.description;
    } else {
      const partner = this.activeTarget.partner;
      const zoneMeta = getZoneMeta(partner.zone);
      titleEl.innerHTML = `
        <span class="inline-block h-3.5 w-3.5 rounded-full shrink-0" style="background-color: ${escapeHtml(
          partner.color || '#174955'
        )}"></span>
        <span>${escapeHtml(partner.name)}</span>
        ${
          partner.isNpc
            ? '<span class="rounded bg-[#174955]/10 px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#4B6F77]">🤖 DEMO-BOT</span>'
            : ''
        }
      `;
      subtitleEl.textContent = `${partner.company || 'Selbstständig'} • 📍 ${partner.location} • ${zoneMeta.icon} ${zoneMeta.label}`;

      // Add walk & vcard buttons
      const walkBtn = document.createElement('button');
      walkBtn.type = 'button';
      walkBtn.className =
        'rounded-lg bg-[#8EAE9D] hover:bg-[#5F7F6E] text-white px-2.5 py-1 text-xs font-bold transition cursor-pointer flex items-center gap-1';
      walkBtn.innerHTML = '🧭 <span>Hinlaufen</span>';
      walkBtn.addEventListener('click', () => {
        this.close();
        if (this.onWalkToPlayer) {
          this.onWalkToPlayer(partner.id);
        }
      });

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className =
        'rounded-lg bg-[#EDF5F7] hover:bg-[#174955]/10 text-[#174955] px-2.5 py-1 text-xs font-bold transition cursor-pointer flex items-center gap-1';
      cardBtn.innerHTML = '👤 <span>Visitenkarte</span>';
      cardBtn.addEventListener('click', () => {
        if (this.onOpenVCard) {
          this.onOpenVCard(partner);
        }
      });

      actionsEl.appendChild(walkBtn);
      actionsEl.appendChild(cardBtn);
    }
  }

  private renderActiveFeed(): void {
    const container = this.dialog.querySelector('#chat-center-messages');
    if (!container) return;

    let messages: ChatMessage[] = [];
    if (this.activeTarget.type === 'room') {
      messages = this.network.getRoomChatHistory(this.activeTarget.room.id);
    } else {
      messages = this.network.getPrivateChatHistory(this.activeTarget.partner.id);
    }

    container.innerHTML = '';
    const selfId = this.network.getSelfId();

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-[#4B6F77]">
          <span class="text-3xl mb-2">${
            this.activeTarget.type === 'room' ? this.activeTarget.room.icon : '💬'
          }</span>
          <p class="font-bold text-[#174955] mb-1">Noch keine Nachrichten vorhanden</p>
          <p class="max-w-xs text-[#64748B]">
            ${
              this.activeTarget.type === 'room'
                ? `Schreibe die erste Nachricht an ${this.activeTarget.room.label}!`
                : `Starte deinen persönlichen Austausch mit ${this.activeTarget.partner.name}.`
            }
          </p>
        </div>
      `;
      return;
    }

    messages.forEach((msg) => {
      const isSelf = msg.senderId === selfId;
      const row = document.createElement('div');
      row.className = `flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1`;

      row.innerHTML = `
        <div class="flex items-center gap-1.5 text-[10px] ${
          isSelf ? 'text-right' : 'text-left'
        }">
          <span class="font-extrabold text-[#174955] flex items-center gap-1">
            <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${escapeHtml(
              msg.color || '#174955'
            )}"></span>
            ${escapeHtml(msg.senderName)}
            ${
              msg.senderId?.startsWith('npc-')
                ? '<span class="rounded bg-[#174955]/10 px-1 py-0.2 text-[8.5px] font-extrabold text-[#4B6F77]">BOT</span>'
                : ''
            }
          </span>
          <span class="text-[#64748B] font-medium">${escapeHtml(msg.timestamp)}</span>
        </div>
        <div class="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed shadow-2xs break-words ${
          isSelf
            ? 'bg-[#174955] text-white rounded-tr-xs'
            : 'bg-white border border-[#4B6F77]/20 text-[#151718] rounded-tl-xs'
        }">
          ${escapeHtml(msg.text)}
        </div>
      `;

      container.appendChild(row);
    });

    container.scrollTop = container.scrollHeight;
  }

  private updateInputState(): void {
    const input = this.dialog.querySelector('#chat-center-input') as HTMLInputElement;
    const submitBtn = this.dialog.querySelector('#chat-center-submit-btn') as HTMLButtonElement;
    const lockedBanner = this.dialog.querySelector('#chat-center-locked-banner') as HTMLElement;

    if (!input || !submitBtn || !lockedBanner) return;

    if (this.activeTarget.type === 'room') {
      const isAllowed = this.activeTarget.room.allowedZones.includes(this.currentZone);
      if (!isAllowed) {
        input.disabled = true;
        input.placeholder = 'Raum gesperrt – bewege deinen Avatar in diesen Raum...';
        submitBtn.disabled = true;
        lockedBanner.classList.remove('hidden');

        const tpBtn = lockedBanner.querySelector('#chat-center-teleport-btn') as HTMLButtonElement;
        if (tpBtn) {
          tpBtn.onclick = () => {
            if (this.activeTarget.type === 'room') {
              this.coworkingScene.teleportToZone(this.activeTarget.room.teleportZone);
              this.setZone(this.activeTarget.room.teleportZone);
            }
          };
        }
        return;
      }
    }

    input.disabled = false;
    submitBtn.disabled = false;
    lockedBanner.classList.add('hidden');

    if (this.activeTarget.type === 'room') {
      input.placeholder = `Nachricht an ${this.activeTarget.room.label}... [Enter]`;
    } else {
      input.placeholder = `Direktnachricht an ${this.activeTarget.partner.name}... [Enter]`;
    }
  }

  private showZoneLockedHint(room: RoomDefinition): void {
    const banner = this.dialog.querySelector('#chat-center-locked-banner') as HTMLElement;
    if (banner) {
      banner.classList.remove('hidden');
      const textEl = banner.querySelector('#chat-center-locked-text');
      if (textEl) {
        textEl.textContent = `🔒 Du bist außerhalb von ${room.label}. Bewege deinen Avatar in diesen Raum, um mitzureden.`;
      }
      const tpBtn = banner.querySelector('#chat-center-teleport-btn') as HTMLButtonElement;
      if (tpBtn) {
        tpBtn.onclick = () => {
          this.coworkingScene.teleportToZone(room.teleportZone);
          this.setZone(room.teleportZone);
          this.selectRoom(room.id);
        };
      }
    }
  }
}
