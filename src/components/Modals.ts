import {
  AVATAR_PALETTE,
  UNTERTAUNUS_TOWNS,
  getPlayerStatusMeta,
  getZoneFromCoordinates,
  getZoneMeta,
  type BulletinPin,
  type PlayerProfile,
  type PlayerState,
} from '../types';

const dialogOpenedTimestamps = new WeakMap<HTMLDialogElement, number>();

/**
 * Safely opens a modal dialog so that a canvas pointerdown/pointerup/click
 * sequence never triggers immediate light-dismiss on the backdrop.
 */
export function safeShowModal(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  dialogOpenedTimestamps.set(dialog, performance.now());

  const hadClosedBy = dialog.getAttribute('closedby');
  if (hadClosedBy === 'any') {
    dialog.setAttribute('closedby', 'closerequest');
    setTimeout(() => {
      if (dialog.open) {
        dialog.setAttribute('closedby', 'any');
      }
    }, 250);
  }

  dialog.showModal();
}

/**
 * Attaches the mandatory light-dismiss fallback for browsers that do not
 * yet support the declarative `<dialog closedby="any">` attribute.
 */
export function attachDialogLightDismissFallback(dialog: HTMLDialogElement): void {
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const openedAt = dialogOpenedTimestamps.get(dialog) || 0;
      if (performance.now() - openedAt < 250) return;

      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      dialog.close();
    });
  }
}

export function renderAvatarSwatches(
  container: HTMLElement,
  selectedHex: string,
  onSelect: (hex: string) => void
): void {
  container.innerHTML = '';
  AVATAR_PALETTE.forEach((swatch) => {
    const isSelected = swatch.hex.toLowerCase() === selectedHex.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `group relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
      isSelected
        ? 'border-[#174955] bg-[#EDF5F7] text-[#174955] ring-2 ring-[#E68A36] shadow-xs'
        : 'border-[#4B6F77]/20 bg-[#F4F5F6] text-[#2A2E30] hover:border-[#4B6F77]/50 hover:bg-white'
    }`;
    btn.innerHTML = `
      <span class="h-4 w-4 rounded-full border border-black/15 shrink-0 shadow-2xs" style="background-color: ${swatch.hex}"></span>
      <span>${swatch.name}</span>
    `;
    btn.addEventListener('click', () => {
      onSelect(swatch.hex);
      renderAvatarSwatches(container, swatch.hex, onSelect);
    });
    container.appendChild(btn);
  });
}

export function populateTownSelect(
  selectEl: HTMLSelectElement,
  selectedTown: string
): void {
  selectEl.innerHTML = '';
  UNTERTAUNUS_TOWNS.forEach((town) => {
    const opt = document.createElement('option');
    opt.value = town;
    opt.textContent = town;
    if (town === selectedTown) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

export function openBusinessCardModal(
  dialog: HTMLDialogElement,
  player: PlayerState,
  onStartDirectChat: (player: PlayerState) => void,
  onWalkToPlayer?: (playerId: string) => void
): void {
  const nameEl = dialog.querySelector('#vcard-name') as HTMLElement;
  const companyEl = dialog.querySelector('#vcard-company') as HTMLElement;
  const locationEl = dialog.querySelector('#vcard-location') as HTMLElement;
  const statusEl = dialog.querySelector('#vcard-status') as HTMLElement;
  const customStatusEl = dialog.querySelector(
    '#vcard-custom-status'
  ) as HTMLElement | null;
  const offersEl = dialog.querySelector('#vcard-offers') as HTMLElement;
  const seeksEl = dialog.querySelector('#vcard-seeks') as HTMLElement;
  const avatarBadge = dialog.querySelector('#vcard-avatar') as HTMLElement;
  const linkEl = dialog.querySelector('#vcard-website') as HTMLAnchorElement;
  const chatBtn = dialog.querySelector('#vcard-chat-btn') as HTMLButtonElement;
  const walkBtn = dialog.querySelector(
    '#vcard-walk-btn'
  ) as HTMLButtonElement | null;

  nameEl.textContent = player.name;
  companyEl.textContent = player.company || 'Selbstständig / KMU';
  locationEl.textContent = player.location;
  offersEl.textContent =
    player.offers || 'Regulärer Austausch & regionale Zusammenarbeit';
  seeksEl.textContent =
    player.seeks || 'Spannende Unternehmenskontakte im Untertaunus';

  avatarBadge.style.backgroundColor = player.color || '#174955';
  const initials = player.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  avatarBadge.textContent = initials || 'UT';

  const actualZone =
    player.x !== undefined && player.y !== undefined && player.x > 0 && player.y > 0
      ? getZoneFromCoordinates(player.x, player.y)
      : player.zone || 'lobby';

  const zoneMeta = getZoneMeta(actualZone);
  const statusMeta = getPlayerStatusMeta({
    zone: actualZone,
    status: player.status,
    x: player.x,
    y: player.y,
  });

  statusEl.textContent = statusMeta.label;
  statusEl.className = statusMeta.badgeClasses;

  const zoneBadge = dialog.querySelector('#vcard-zone') as HTMLElement | null;
  if (zoneBadge) {
    zoneBadge.textContent = `${zoneMeta.icon} ${zoneMeta.label}`;
  }

  const botBadge = dialog.querySelector('#vcard-bot-badge') as HTMLElement | null;
  if (botBadge) {
    if (player.isNpc) {
      botBadge.classList.remove('hidden');
    } else {
      botBadge.classList.add('hidden');
    }
  }

  if (customStatusEl) {
    if (player.customStatus && player.customStatus.trim().length > 0) {
      customStatusEl.textContent = `💬 Aktuell: „${player.customStatus}“`;
      customStatusEl.classList.remove('hidden');
    } else {
      customStatusEl.classList.add('hidden');
    }
  }

  if (player.website && player.website.trim().length > 0) {
    linkEl.href = player.website.startsWith('http')
      ? player.website
      : `https://${player.website}`;
    linkEl.textContent = player.website.replace(/^https?:\/\//, '');
    linkEl.parentElement?.classList.remove('hidden');
  } else {
    linkEl.parentElement?.classList.add('hidden');
  }

  if (walkBtn) {
    if (player.id !== 'self' && onWalkToPlayer) {
      walkBtn.classList.remove('hidden');
      walkBtn.onclick = () => {
        dialog.close();
        onWalkToPlayer(player.id);
      };
    } else {
      walkBtn.classList.add('hidden');
    }
  }

  chatBtn.onclick = () => {
    dialog.close();
    onStartDirectChat(player);
  };

  safeShowModal(dialog);
}

export function renderBulletinBoardList(
  container: HTMLElement,
  pins: BulletinPin[],
  filter: 'all' | 'angebot' | 'gesuch' | 'event'
): void {
  const filtered =
    filter === 'all' ? pins : pins.filter((p) => p.type === filter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="rounded-xl border border-[#4B6F77]/20 bg-[#F0F4F5] p-8 text-center text-sm text-[#4B6F77]">
        Noch keine Einträge in dieser Kategorie vorhanden. Erstelle rechts den ersten Aushang!
      </div>
    `;
    return;
  }

  const badgeStyles: Record<
    BulletinPin['type'],
    { label: string; classes: string }
  > = {
    angebot: {
      label: 'ICH BIETE / ANGEBOT',
      classes: 'bg-[#F2F7F4] text-[#5F7F6E] border-[#8EAE9D]/50',
    },
    gesuch: {
      label: 'ICH SUCHE / KOOPERATION',
      classes: 'bg-[#FDF5EE] text-[#B86518] border-[#E68A36]/50',
    },
    event: {
      label: 'REGIONALES EVENT',
      classes: 'bg-[#EBF9FB] text-[#007A87] border-[#00A5B5]/40',
    },
  };

  container.innerHTML = filtered
    .map((pin) => {
      const badge = badgeStyles[pin.type] || badgeStyles.angebot;
      return `
        <article class="rounded-xl border border-[#4B6F77]/25 bg-white p-4 shadow-xs transition hover:border-[#00A5B5]">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${badge.classes}">
              ${badge.label}
            </span>
            <span class="text-xs text-[#4B6F77] font-medium">📍 ${escapeHtml(
              pin.location
            )} • ${escapeHtml(pin.createdAt)}</span>
          </div>
          <h4 class="text-base font-bold text-[#174955] mb-1.5">${escapeHtml(
            pin.title
          )}</h4>
          <p class="text-sm text-[#2A2E30]/90 leading-relaxed mb-3">${escapeHtml(
            pin.description
          )}</p>
          <div class="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#F0F4F5] text-xs">
            <div class="font-semibold text-[#334E54]">
              👤 ${escapeHtml(pin.author)} <span class="font-normal text-[#4B6F77]">(${escapeHtml(
        pin.company
      )})</span>
            </div>
            <div class="font-semibold text-[#007A87] bg-[#EBF9FB] px-2.5 py-1 rounded-md">
              ✉️ ${escapeHtml(pin.contact)}
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

export const USER_PROFILE_KEY = 'untertaunus_user_profile';
export const LEGACY_PROFILE_KEY = 'taunushub_profile';

export function hasSavedProfile(): boolean {
  try {
    const raw =
      localStorage.getItem(USER_PROFILE_KEY) ||
      localStorage.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.name && parsed.name.trim().length > 0);
  } catch {
    return false;
  }
}

export function loadSavedProfile(): PlayerProfile {
  try {
    const raw =
      localStorage.getItem(USER_PROFILE_KEY) ||
      localStorage.getItem(LEGACY_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) {
        return {
          status: 'available',
          customStatus: 'Ansprechbar im Hub 👋',
          ...parsed,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    name: 'Alex Hoffmann',
    company: 'Hoffmann Digital Consulting',
    location: 'Taunusstein',
    offers: 'Prozessautomatisierung, Web-Entwicklung & KI-Workshops für KMU',
    seeks: 'Steuerberater, Handwerksbetriebe & kreative Partner im Untertaunus',
    website: 'https://untertaunus-hub.de',
    color: '#174955',
    status: 'available',
    customStatus: 'Ansprechbar im Hub 👋',
  };
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    const payload = JSON.stringify(profile);
    localStorage.setItem(USER_PROFILE_KEY, payload);
    localStorage.setItem(LEGACY_PROFILE_KEY, payload);
  } catch {
    // ignore
  }
}

export function clearSavedProfile(): void {
  try {
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.removeItem(LEGACY_PROFILE_KEY);
    localStorage.removeItem('untertaunus_chat_cache');
    localStorage.removeItem('untertaunus_tour_completed');
  } catch {
    // ignore
  }
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
