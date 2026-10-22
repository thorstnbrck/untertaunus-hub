import Phaser from 'phaser';
import './styles/main.css';
import { CoworkingScene } from './game/CoworkingScene';
import { NetworkManager } from './game/NetworkManager';
import {
  attachDialogLightDismissFallback,
  escapeHtml,
  loadSavedProfile,
  openBusinessCardModal,
  populateTownSelect,
  renderAvatarSwatches,
  renderBulletinBoardList,
  safeShowModal,
  saveProfile,
} from './components/Modals';
import {
  EMOTE_SHORTCUTS,
  getPlayerStatusMeta,
  getZoneFromCoordinates,
  getZoneMeta,
  type AvailabilityStatus,
  type ChatMessage,
  type PlayerProfile,
  type PlayerState,
  type WhiteboardStroke,
  type ZoneType,
} from './types';

// Application State
let currentProfile: PlayerProfile = loadSavedProfile();
let selectedAvatarColor = currentProfile.color;
let currentBoardFilter: 'all' | 'angebot' | 'gesuch' | 'event' = 'all';
let jitsiActive = false;
let phaserGame: Phaser.Game | null = null;
let inOfficeMode = false;
let activeProximityObject:
  | 'bulletin'
  | 'coffee'
  | 'whiteboard'
  | 'foosball'
  | null = null;
let currentConferenceZone: 'conference' | 'networking' = 'conference';
let currentPlayerZone: ZoneType = 'lobby';

const TOUR_STORAGE_KEY = 'untertaunus_tour_completed';
let currentTourStepIndex = 0;

interface OnboardingTourStation {
  icon: string;
  subtitle: string;
  title: string;
  tooltip: string;
  camX: number;
  camY: number;
  zoom: number;
  rect: { x: number; y: number; w: number; h: number };
}

const ONBOARDING_TOUR_STATIONS: OnboardingTourStation[] = [
  {
    icon: '🌿',
    subtitle: 'STATION 1 • SILENT COWORKING',
    title: 'Station 1: Dein Arbeitsplatz (Fokus-Zone)',
    tooltip:
      'Willkommen! Das ist der Silent Coworking-Bereich. Wenn du an einem Tisch sitzt, arbeitest du konzentriert. Chatte hier leise über Sprechblasen [Enter].',
    camX: 355,
    camY: 325,
    zoom: 1.22,
    rect: { x: 24, y: 24, w: 666, h: 586 },
  },
  {
    icon: '☕',
    subtitle: 'STATION 2 • KAFFEEKÜCHE & LOUNGE',
    title: 'Station 2: Die Kaffeeküche & Lounge',
    tooltip:
      'Der Treffpunkt für lockeren Austausch. Hier kannst du dich spontan mit anderen austauschen oder in der Mittagspause netzwerken.',
    camX: 1740,
    camY: 325,
    zoom: 1.22,
    rect: { x: 1406, y: 24, w: 670, h: 586 },
  },
  {
    icon: '🔴',
    subtitle: 'STATION 3 • LIVE-MEETINGS & EVENTS',
    title: 'Station 3: Der Konferenzraum',
    tooltip:
      'Meetings & Events: Betrittst du diesen Raum mit deinem Avatar, schaltet sich automatisch die Video- und Audio-Konferenz ein. Verlässt du ihn, bist du wieder offline.',
    camX: 1570,
    camY: 930,
    zoom: 1.26,
    rect: { x: 1406, y: 626, w: 329, h: 610 },
  },
  {
    icon: '📌',
    subtitle: 'STATION 4 • B2B-MATCHING & STEUERUNG',
    title: 'Station 4: Digitales Schwarzes Brett & Visitenkarten',
    tooltip:
      'Klicke auf das Schwarze Brett für regionale B2B-Angebote oder klicke Kollegen an, um ihre digitale Visitenkarte zu sehen. Steuere deinen Avatar mit WASD oder den Pfeiltasten.',
    camX: 985,
    camY: 885,
    zoom: 1.32,
    rect: { x: 706, y: 626, w: 684, h: 610 },
  },
];

const network = new NetworkManager();
const coworkingScene = new CoworkingScene();

function initApp(): void {
  // 1. Setup all native <dialog closedby="any"> modals + mandatory Safari fallback
  const profileDialog = document.getElementById(
    'profile-modal'
  ) as HTMLDialogElement;
  const vcardDialog = document.getElementById('vcard-modal') as HTMLDialogElement;
  const bulletinDialog = document.getElementById(
    'bulletin-modal'
  ) as HTMLDialogElement;
  const whiteboardDialog = document.getElementById(
    'whiteboard-modal'
  ) as HTMLDialogElement;

  [profileDialog, vcardDialog, bulletinDialog, whiteboardDialog].forEach(
    (dlg) => {
      if (dlg) attachDialogLightDismissFallback(dlg);
    }
  );

  // 2. Connect Socket.io in background
  network.connect(currentProfile, 700, 620);

  // 3. Bind UI Events & Synchronize Initial State
  setupOnboardingAndProfileModal(profileDialog);
  setupBulletinModal(bulletinDialog);
  setupWhiteboardModal(whiteboardDialog);
  setupInGameHudAndChat(vcardDialog, bulletinDialog, whiteboardDialog);
  setupQuickZoneNavigation();
  setupConferenceOverlay();
  setupOnboardingTour();
  setupLandingFeatureTabs();

  updateHudProfileBadge();
  renderDirectoryList();
  renderChatHistory();
  updateOnlineStatusBadge(network.isServerConnected(), network.getOnlineCount());

  network.on('connectionChanged', (connected, count) => {
    updateOnlineStatusBadge(connected, count);
    renderDirectoryList();
  });

  network.on('playersUpdated', () => {
    renderDirectoryList();
    if (
      currentPlayerZone === 'conference' ||
      currentPlayerZone === 'networking'
    ) {
      renderConferenceRoomParticipants(currentPlayerZone);
    }
    updateOnlineStatusBadge(
      network.isServerConnected(),
      network.getOnlineCount()
    );
  });

  network.on('chatMessage', (msg) => {
    const room = msg.room || 'global';
    if (room === 'conference' || room === 'networking') {
      // Only show and log conference room messages if the local player is currently in that exact room
      if (currentPlayerZone === room) {
        appendConferenceRoomChatMessage(msg);
        if (msg.senderId !== 'local-player') {
          coworkingScene.showRemoteSpeechBubble(msg.senderId, msg.text);
        }
      }
      return;
    }

    appendChatMessage(msg);
    if (msg.senderId !== 'local-player') {
      coworkingScene.showRemoteSpeechBubble(msg.senderId, msg.text);
    }
  });

  network.on('pinsUpdated', (pins) => {
    const listContainer = document.getElementById('bulletin-pins-list');
    if (listContainer) {
      renderBulletinBoardList(listContainer, pins, currentBoardFilter);
    }
    document.querySelectorAll('[data-pin-count]').forEach((el) => {
      el.textContent = String(pins.length);
    });
  });
}

/**
 * Launches or resumes the Fullscreen 2D Office View after completing the Onboarding Mask.
 * First-time visitors (`localStorage.getItem('untertaunus_tour_completed') !== 'true'`)
 * automatically start in the interactive 4-station Onboarding Tour!
 */
function enterFullscreenOffice(): void {
  const landingView = document.getElementById('landing-info-view');
  const officeView = document.getElementById('office-fullscreen-view');

  landingView?.classList.add('hidden');
  officeView?.classList.remove('hidden');
  inOfficeMode = true;

  if (!phaserGame) {
    const vcardDialog = document.getElementById(
      'vcard-modal'
    ) as HTMLDialogElement;
    const bulletinDialog = document.getElementById(
      'bulletin-modal'
    ) as HTMLDialogElement;
    const whiteboardDialog = document.getElementById(
      'whiteboard-modal'
    ) as HTMLDialogElement;

    coworkingScene.initData(network, currentProfile, {
      onZoneChange: handleZoneChange,
      onAvatarClick: (player: PlayerState) => {
        openBusinessCardModal(
          vcardDialog,
          player,
          (recipientName) => {
            const chatInput = document.getElementById(
              'chat-input'
            ) as HTMLInputElement;
            if (chatInput) {
              chatInput.value = `@${recipientName}: `;
              chatInput.focus();
            }
          },
          (playerId) => {
            coworkingScene.walkToPlayer(playerId);
          }
        );
      },
      onOpenBulletinBoard: () => {
        openBulletinBoardModal(bulletinDialog);
      },
      onOpenWhiteboard: () => {
        safeShowModal(whiteboardDialog);
        redrawWhiteboard();
      },
      onCoffeeGrabbed: (expiresAt: number) => {
        const badge = document.getElementById('hud-coffee-boost-badge');
        if (badge) {
          badge.classList.remove('hidden');
          badge.classList.add('inline-flex');
          setTimeout(() => {
            if (Date.now() >= expiresAt - 500) {
              badge.classList.add('hidden');
              badge.classList.remove('inline-flex');
            }
          }, 90000);
        }
      },
      onSeatChange: (seatLabel: string | null) => {
        const seatBadge = document.getElementById('hud-seated-badge');
        const seatText = document.getElementById('hud-seated-label');
        if (seatBadge && seatText) {
          if (seatLabel) {
            seatText.textContent = `🪑 Sitzt an: ${seatLabel}`;
            seatBadge.classList.remove('hidden');
            seatBadge.classList.add('inline-flex');
          } else {
            seatBadge.classList.add('hidden');
            seatBadge.classList.remove('inline-flex');
          }
        }
      },
      onInteractPromptChange: (prompt) => {
        const banner = document.getElementById('object-proximity-banner');
        const label = document.getElementById('object-proximity-label');
        activeProximityObject = prompt ? prompt.type : null;
        if (banner && label) {
          if (prompt) {
            label.textContent = prompt.label;
            banner.classList.remove('hidden');
          } else {
            banner.classList.add('hidden');
          }
        }
      },
      onRequestChatFocus: () => {
        const chatInput = document.getElementById(
          'chat-input'
        ) as HTMLInputElement;
        chatInput?.focus();
      },
      onZoomChange: (zoomPercent: number) => {
        const zoomLabel = document.getElementById('zoom-level-label');
        if (zoomLabel) {
          zoomLabel.textContent = `${zoomPercent}%`;
        }
      },
    });

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-canvas-container',
      width: window.innerWidth,
      height: window.innerHeight,
      render: {
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
      },
      backgroundColor: '#0F323A',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [coworkingScene],
    };

    phaserGame = new Phaser.Game(config);
  } else {
    phaserGame.scale.resize(window.innerWidth, window.innerHeight);
    coworkingScene.updateLocalProfile(currentProfile);
    coworkingScene.setZoomPercent(50);
  }

  // Automatically start the Onboarding Tour for first-time visitors
  if (!hasCompletedOnboardingTour()) {
    startOnboardingTour();
  }
}

function hasCompletedOnboardingTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markOnboardingTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage quota errors
  }
}

function setupOnboardingTour(): void {
  const prevBtn = document.getElementById('tour-prev-btn');
  const nextBtn = document.getElementById('tour-next-btn');
  const skipBtn = document.getElementById('tour-skip-btn');

  prevBtn?.addEventListener('click', () => {
    if (currentTourStepIndex > 0) {
      currentTourStepIndex -= 1;
      renderOnboardingTourStep();
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (currentTourStepIndex < ONBOARDING_TOUR_STATIONS.length - 1) {
      currentTourStepIndex += 1;
      renderOnboardingTourStep();
    } else {
      finishOrSkipOnboardingTour();
    }
  });

  skipBtn?.addEventListener('click', () => {
    finishOrSkipOnboardingTour();
  });

  document
    .querySelectorAll('[data-action="restart-tour"]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!inOfficeMode) {
          enterFullscreenOffice();
        }
        startOnboardingTour();
      });
    });
}

function startOnboardingTour(): void {
  currentTourStepIndex = 0;
  const overlay = document.getElementById('onboarding-tour-overlay');
  overlay?.classList.remove('hidden');
  renderOnboardingTourStep();
}

function renderOnboardingTourStep(): void {
  const station = ONBOARDING_TOUR_STATIONS[currentTourStepIndex];
  if (!station) return;

  const counterEl = document.getElementById('tour-step-counter');
  const iconEl = document.getElementById('tour-station-icon');
  const subtitleEl = document.getElementById('tour-station-subtitle');
  const titleEl = document.getElementById('tour-station-title');
  const tooltipEl = document.getElementById('tour-station-tooltip');
  const prevBtn = document.getElementById('tour-prev-btn');
  const skipBtn = document.getElementById('tour-skip-btn');
  const nextBtnLabel = document.getElementById('tour-next-btn-label');
  const dotsContainer = document.getElementById('tour-progress-dots');

  if (counterEl) {
    counterEl.textContent = `Station ${currentTourStepIndex + 1} von ${ONBOARDING_TOUR_STATIONS.length}`;
  }
  if (iconEl) iconEl.textContent = station.icon;
  if (subtitleEl) subtitleEl.textContent = station.subtitle;
  if (titleEl) titleEl.textContent = station.title;
  if (tooltipEl) tooltipEl.textContent = station.tooltip;

  // Station 1: "Weiter" | "Tour überspringen"
  // Station 2 & 3: "Zurück" | "Weiter"
  // Station 4: "Zurück" | "Loslegen & Hub betreten"
  if (prevBtn) {
    if (currentTourStepIndex === 0) {
      prevBtn.classList.add('hidden');
    } else {
      prevBtn.classList.remove('hidden');
    }
  }

  if (skipBtn) {
    if (currentTourStepIndex === 0) {
      skipBtn.classList.remove('hidden');
    } else {
      skipBtn.classList.add('hidden');
    }
  }

  if (nextBtnLabel) {
    if (currentTourStepIndex === ONBOARDING_TOUR_STATIONS.length - 1) {
      nextBtnLabel.textContent = '🚀 Loslegen & Hub betreten';
    } else {
      nextBtnLabel.textContent = 'Weiter →';
    }
  }

  if (dotsContainer) {
    dotsContainer.innerHTML = ONBOARDING_TOUR_STATIONS.map((_, idx) => {
      const isCurrent = idx === currentTourStepIndex;
      const isPast = idx < currentTourStepIndex;
      const cls = isCurrent
        ? 'h-2.5 w-6 rounded-full bg-[#E68A36] transition-all'
        : isPast
          ? 'h-2.5 w-2.5 rounded-full bg-[#00A5B5] transition-all'
          : 'h-2.5 w-2.5 rounded-full bg-[#4B6F77] transition-all';
      return `<span class="${cls}"></span>`;
    }).join('');
  }

  coworkingScene.focusTourStation(
    station.camX,
    station.camY,
    station.zoom,
    station.rect
  );
}

function finishOrSkipOnboardingTour(): void {
  markOnboardingTourCompleted();
  const overlay = document.getElementById('onboarding-tour-overlay');
  overlay?.classList.add('hidden');
  coworkingScene.endOnboardingTour();
}

function leaveFullscreenOffice(): void {
  const landingView = document.getElementById('landing-info-view');
  const officeView = document.getElementById('office-fullscreen-view');
  const tourOverlay = document.getElementById('onboarding-tour-overlay');

  tourOverlay?.classList.add('hidden');
  coworkingScene.endOnboardingTour();
  stopJitsiIframe();
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  officeView?.classList.add('hidden');
  landingView?.classList.remove('hidden');
  inOfficeMode = false;
}

function setupOnboardingAndProfileModal(dialog: HTMLDialogElement): void {
  const townSelect = document.getElementById(
    'profile-location'
  ) as HTMLSelectElement;
  const swatchesEl = document.getElementById('profile-color-swatches')!;
  const form = document.getElementById('profile-form') as HTMLFormElement;
  const submitBtn = document.getElementById(
    'profile-submit-btn'
  ) as HTMLButtonElement;

  const populateForm = (buttonLabel: string) => {
    (document.getElementById('profile-name') as HTMLInputElement).value =
      currentProfile.name;
    (document.getElementById('profile-company') as HTMLInputElement).value =
      currentProfile.company;
    (document.getElementById('profile-offers') as HTMLInputElement).value =
      currentProfile.offers;
    (document.getElementById('profile-seeks') as HTMLInputElement).value =
      currentProfile.seeks;
    (document.getElementById('profile-website') as HTMLInputElement).value =
      currentProfile.website || '';
    selectedAvatarColor = currentProfile.color;
    populateTownSelect(townSelect, currentProfile.location);
    renderAvatarSwatches(swatchesEl, selectedAvatarColor, (hex) => {
      selectedAvatarColor = hex;
    });
    if (submitBtn) {
      submitBtn.textContent = buttonLabel;
    }
  };

  document
    .querySelectorAll('[data-action="start-onboarding"]')
    .forEach((trigger) => {
      trigger.addEventListener('click', () => {
        populateForm('🚀 Jetzt Raum betreten →');
        safeShowModal(dialog);
      });
    });

  document
    .querySelectorAll('[data-action="edit-profile-ingame"]')
    .forEach((trigger) => {
      trigger.addEventListener('click', () => {
        populateForm('💾 Visitenkarte aktualisieren');
        safeShowModal(dialog);
      });
    });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const updated: PlayerProfile = {
      ...currentProfile,
      name:
        (
          document.getElementById('profile-name') as HTMLInputElement
        ).value.trim() || 'Gast aus dem Taunus',
      company:
        (
          document.getElementById('profile-company') as HTMLInputElement
        ).value.trim() || 'Selbstständig / KMU',
      location: townSelect.value || 'Taunusstein',
      offers:
        (
          document.getElementById('profile-offers') as HTMLInputElement
        ).value.trim() || 'Austausch & regionale Kooperation',
      seeks:
        (
          document.getElementById('profile-seeks') as HTMLInputElement
        ).value.trim() || 'Netzwerk im Untertaunus',
      website: (
        document.getElementById('profile-website') as HTMLInputElement
      ).value.trim(),
      color: selectedAvatarColor,
    };

    currentProfile = updated;
    saveProfile(updated);
    network.updateProfile(updated);
    updateHudProfileBadge();
    renderDirectoryList();
    dialog.close();

    enterFullscreenOffice();
  });
}

function setupLandingFeatureTabs(): void {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('[data-feature-tab]');
  const badgeEl = document.getElementById('feature-preview-badge');
  const zonePillEl = document.getElementById('feature-preview-zone-pill');
  const titleEl = document.getElementById('feature-preview-title');
  const descEl = document.getElementById('feature-preview-desc');
  const mockupEl = document.getElementById('feature-preview-mockup');

  if (!tabBtns.length || !titleEl || !descEl || !mockupEl) return;

  interface FeatureTabConfig {
    accentHex: string;
    badgeHtml: string;
    badgeClasses: string;
    zoneLabel: string;
    zoneClasses: string;
    title: string;
    desc: string;
    mockupHtml: string;
  }

  const tabs: FeatureTabConfig[] = [
    {
      accentHex: '#00A5B5',
      badgeHtml: '<span>❖</span><span>LIVE-VORSCHAU • SCHRITT 01</span>',
      badgeClasses:
        'inline-flex items-center gap-2 rounded-full bg-[#EBF9FB] border border-[#00A5B5]/25 px-3.5 py-1 text-xs font-extrabold text-[#007A87]',
      zoneLabel: '🌿 Fokus-Coworking I & Studio II',
      zoneClasses:
        'rounded-full bg-[#F2F7F4] border border-[#8EAE9D]/40 px-3 py-1 text-xs font-bold text-[#5F7F6E]',
      title: 'Digitale Visitenkarte & reaktive 2.5D-Schreibtische',
      desc: 'Wähle deinen Standort (z. B. Taunusstein, Idstein oder Bad Schwalbach) und trage kurz „Ich biete / Ich suche“ ein. Klickst du im Raum auf einen freien Tisch, setzt sich dein Avatar hin, die Schreibtischlampe schaltet sich ein und der Tisch zeigt allen deinen Status.',
      mockupHtml: `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="rounded-2xl bg-white border border-[#4B6F77]/15 p-4 shadow-2xs">
            <div class="flex items-center gap-3 mb-2.5">
              <span class="h-10 w-10 rounded-xl bg-[#174955] text-white font-extrabold text-xs flex items-center justify-center">AH</span>
              <div>
                <div class="text-xs font-extrabold text-[#174955]">Alex Hoffmann</div>
                <div class="text-[11px] text-[#4B6F77]">📍 Taunusstein • Digital Consulting</div>
              </div>
            </div>
            <div class="rounded-xl bg-[#F2F7F4] border border-[#8EAE9D]/40 px-2.5 py-1.5 text-[11px] font-semibold text-[#5F7F6E]">
              🌿 Bietet: Web-Apps, KI-Workshops &amp; Automatisierung
            </div>
          </div>

          <div class="rounded-2xl bg-[#FDF5EE] border-2 border-[#E68A36] p-4 shadow-2xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-extrabold text-[#B86518]">
              <span>🪑 Schreibtisch #03</span>
              <span class="rounded-full bg-[#E68A36] px-2 py-0.5 text-[10px] text-white">BESETZT</span>
            </div>
            <p class="text-[11px] text-[#2A2E30]/85 my-2">
              Tischplatte leuchtet in Warm-Amber, solange du am Platz arbeitest.
            </p>
            <div class="text-[10px] font-bold text-[#5F7F6E]">💡 Schreibtischlampe aktiv • 🎧 Fokus-Modus</div>
          </div>
        </div>
      `,
    },
    {
      accentHex: '#E68A36',
      badgeHtml: '<span>❖</span><span>LIVE-VORSCHAU • SCHRITT 02</span>',
      badgeClasses:
        'inline-flex items-center gap-2 rounded-full bg-[#FDF5EE] border border-[#E68A36]/35 px-3.5 py-1 text-xs font-extrabold text-[#B86518]',
      zoneLabel: '☕ Kaffeeküche, Lounge & Fun-Raum',
      zoneClasses:
        'rounded-full bg-[#FDF5EE] border border-[#E68A36]/40 px-3 py-1 text-xs font-bold text-[#B86518]',
      title: 'Sprechblasen-Chat [Enter], Emotes & Espresso-Boost',
      desc: 'Im Alltag bleiben Kamera und Mikrofon aus: Tippe eine kurze Nachricht für eine 6-sekündige Sprechblase direkt über deinem Avatar, reagiere mit den Tasten [1–6] per Emoji oder hol dir an der Siebträgermaschine einen Espresso-Boost.',
      mockupHtml: `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="rounded-2xl bg-white border border-[#4B6F77]/15 p-4 shadow-2xs space-y-2.5">
            <div class="inline-flex items-center gap-2 rounded-2xl bg-[#174955] text-white px-3 py-1.5 text-xs font-bold shadow-xs">
              <span>💬 „Jemand Lust auf kurzen Kaffee &amp; Austausch?“</span>
            </div>
            <div class="flex items-center justify-between pt-1 text-[11px] text-[#4B6F77] font-semibold">
              <span>👤 Sarah Becker (Idstein)</span>
              <span class="rounded-full bg-[#EBF9FB] px-2 py-0.5 text-[10px] font-bold text-[#007A87]">Taste [Enter]</span>
            </div>
          </div>

          <div class="rounded-2xl bg-white border border-[#E68A36]/45 p-4 shadow-2xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-extrabold text-[#174955]">
              <span>☕ Siebträgermaschine &amp; Kicker</span>
              <span class="rounded-full bg-[#FDF5EE] border border-[#E68A36] px-2 py-0.5 text-[10px] text-[#B86518]">+25% Tempo</span>
            </div>
            <p class="text-[11px] text-[#4B6F77] my-2">
              Schnapp dir einen frischen Espresso oder starte ein kurzes Match am Tischkicker im Fun-Raum.
            </p>
            <div class="flex items-center gap-1.5 text-xs">
              <span class="rounded-lg bg-[#EDF5F7] px-2 py-0.5 font-bold text-[#174955]">👋 1</span>
              <span class="rounded-lg bg-[#EDF5F7] px-2 py-0.5 font-bold text-[#174955]">☕ 2</span>
              <span class="rounded-lg bg-[#EDF5F7] px-2 py-0.5 font-bold text-[#174955]">🚀 3</span>
              <span class="rounded-lg bg-[#EDF5F7] px-2 py-0.5 font-bold text-[#174955]">💡 4</span>
            </div>
          </div>
        </div>
      `,
    },
    {
      accentHex: '#7E1946',
      badgeHtml: '<span>❖</span><span>LIVE-VORSCHAU • SCHRITT 03</span>',
      badgeClasses:
        'inline-flex items-center gap-2 rounded-full bg-[#FBF0F4] border border-[#7E1946]/30 px-3.5 py-1 text-xs font-extrabold text-[#7E1946]',
      zoneLabel: '🔴 Saal „Feldberg“ & 🤝 Networking-Arena',
      zoneClasses:
        'rounded-full bg-[#FBF0F4] border border-[#7E1946]/35 px-3 py-1 text-xs font-bold text-[#7E1946]',
      title: 'Geschützter Raum-Chat, Team-Whiteboard & Live-Video',
      desc: 'Sobald du mit deinem Avatar einen der beiden Konferenzräume betrittst, öffnet sich automatisch das Raum-Overlay: Nur Personen, die sich physisch im selben Raum befinden, sehen den exklusiven Raum-Chat und können gemeinsam am Whiteboard skizzieren.',
      mockupHtml: `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="rounded-2xl bg-white border-2 border-[#7E1946]/40 p-4 shadow-2xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-extrabold text-[#7E1946]">
              <span>🔒 Exklusiver Raum-Chat</span>
              <span class="rounded bg-[#7E1946] px-2 py-0.5 text-[10px] text-white">Nur Saal I</span>
            </div>
            <p class="text-[11px] text-[#2A2E30]/85 my-2">
              Nachrichten und Video-Calls sind strikt auf die Anwesenden im Konferenzraum begrenzt.
            </p>
            <div class="text-[10px] font-bold text-[#5F7F6E]">🟢 Automatisch aktiv beim Betreten</div>
          </div>

          <div class="rounded-2xl bg-white border border-[#4B6F77]/15 p-4 shadow-2xs flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-extrabold text-[#174955]">
              <span>🎨 Team-Whiteboard &amp; Post-its</span>
              <span class="rounded-full bg-[#EBF9FB] px-2 py-0.5 text-[10px] font-bold text-[#007A87]">Echtzeit</span>
            </div>
            <p class="text-[11px] text-[#4B6F77] my-2">
              Zeichne live mit mehreren Personen oder pinne bunte Post-it-Ideen für euren nächsten B2B-Pitch an.
            </p>
            <div class="text-[10px] font-bold text-[#E68A36]">✨ Optionaler 1-Klick Jitsi-Video-Raum</div>
          </div>
        </div>
      `,
    },
  ];

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-feature-tab') || '0');
      const selected = tabs[idx] || tabs[0];

      tabBtns.forEach((b, i) => {
        const isActive = i === idx;
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        b.className = isActive
          ? 'feature-tab-btn group text-left rounded-3xl bg-white border border-[#4B6F77]/15 p-5 sm:p-6 shadow-md transition-all cursor-pointer relative overflow-hidden'
          : 'feature-tab-btn group text-left rounded-3xl bg-white/70 hover:bg-white border border-[#4B6F77]/15 p-5 sm:p-6 shadow-xs transition-all cursor-pointer relative overflow-hidden';

        const indicator = b.querySelector<HTMLElement>('[data-tab-indicator]');
        if (indicator) {
          indicator.style.backgroundColor = isActive
            ? tabs[i].accentHex
            : 'transparent';
        }
      });

      if (badgeEl) {
        badgeEl.className = selected.badgeClasses;
        badgeEl.innerHTML = selected.badgeHtml;
      }
      if (zonePillEl) {
        zonePillEl.className = selected.zoneClasses;
        zonePillEl.textContent = selected.zoneLabel;
      }
      titleEl.textContent = selected.title;
      descEl.textContent = selected.desc;
      mockupEl.innerHTML = selected.mockupHtml;
    });
  });
}

function setupBulletinModal(dialog: HTMLDialogElement): void {
  document
    .querySelectorAll('[data-action="open-bulletin"]')
    .forEach((trigger) => {
      trigger.addEventListener('click', () => {
        openBulletinBoardModal(dialog);
      });
    });

  const filterBtns = dialog.querySelectorAll('[data-pin-filter]');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentBoardFilter = (btn.getAttribute('data-pin-filter') ||
        'all') as typeof currentBoardFilter;
      filterBtns.forEach((b) => {
        const active =
          b.getAttribute('data-pin-filter') === currentBoardFilter;
        b.className = active
          ? 'rounded-lg bg-[#174955] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer'
          : 'rounded-lg bg-[#F0F4F5] px-3 py-1.5 text-xs font-semibold text-[#334E54] hover:bg-[#EDF5F7] cursor-pointer';
      });
      const listContainer = document.getElementById('bulletin-pins-list');
      if (listContainer) {
        renderBulletinBoardList(
          listContainer,
          network.getPins(),
          currentBoardFilter
        );
      }
    });
  });

  const pinForm = document.getElementById(
    'bulletin-new-form'
  ) as HTMLFormElement;
  pinForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const typeEl = document.getElementById('pin-type') as HTMLSelectElement;
    const titleEl = document.getElementById('pin-title') as HTMLInputElement;
    const descEl = document.getElementById(
      'pin-description'
    ) as HTMLTextAreaElement;
    const contactEl = document.getElementById(
      'pin-contact'
    ) as HTMLInputElement;

    const title = titleEl.value.trim();
    const description = descEl.value.trim();
    if (!title || !description) return;

    network.addBulletinPin({
      type: (typeEl.value as 'angebot' | 'gesuch' | 'event') || 'angebot',
      title,
      description,
      contact: contactEl.value.trim() || `${currentProfile.name} (im Hub)`,
      author: currentProfile.name,
      company: currentProfile.company,
      location: currentProfile.location,
    });

    titleEl.value = '';
    descEl.value = '';
    contactEl.value = '';

    const listContainer = document.getElementById('bulletin-pins-list');
    if (listContainer) {
      renderBulletinBoardList(
        listContainer,
        network.getPins(),
        currentBoardFilter
      );
    }
  });
}

function openBulletinBoardModal(dialog: HTMLDialogElement): void {
  const listContainer = document.getElementById('bulletin-pins-list');
  if (listContainer) {
    renderBulletinBoardList(
      listContainer,
      network.getPins(),
      currentBoardFilter
    );
  }
  safeShowModal(dialog);
}

let redrawWhiteboard = () => {};

function setupWhiteboardModal(dialog: HTMLDialogElement): void {
  const canvas = document.getElementById(
    'whiteboard-canvas'
  ) as HTMLCanvasElement;
  const stickiesLayer = document.getElementById('whiteboard-stickies-layer');
  const stickyForm = document.getElementById(
    'whiteboard-sticky-form'
  ) as HTMLFormElement;
  const stickyInput = document.getElementById(
    'whiteboard-sticky-input'
  ) as HTMLInputElement;
  const clearBtn = document.getElementById('whiteboard-clear-btn');

  let activeColor = '#174955';
  let drawing = false;
  let currentPoints: { x: number; y: number }[] = [];

  document
    .querySelectorAll('[data-action="open-whiteboard"]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        safeShowModal(dialog);
        redrawWhiteboard();
      });
    });

  dialog.querySelectorAll('[data-wb-color]').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      activeColor = swatch.getAttribute('data-wb-color') || '#174955';
      dialog.querySelectorAll('[data-wb-color]').forEach((s) => {
        s.classList.toggle(
          'ring-2',
          s.getAttribute('data-wb-color') === activeColor
        );
      });
    });
  });

  const getCanvasPoint = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  canvas?.addEventListener('mousedown', (e) => {
    drawing = true;
    currentPoints = [getCanvasPoint(e)];
  });

  canvas?.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const pt = getCanvasPoint(e);
    currentPoints.push(pt);
    drawStrokeOnCanvas(canvas, {
      points: currentPoints.slice(-2),
      color: activeColor,
      size: 3.5,
    });
  });

  window.addEventListener('mouseup', () => {
    if (!drawing) return;
    drawing = false;
    if (currentPoints.length > 1) {
      network.addWhiteboardStroke({
        points: currentPoints,
        color: activeColor,
        size: 3.5,
      });
    }
    currentPoints = [];
  });

  stickyForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = stickyInput.value.trim();
    if (!text) return;
    const bgColors = ['#EDF5F7', '#FDF5EE', '#F2F7F4', '#EBF9FB'];
    network.addWhiteboardSticky({
      id: `sticky-${Date.now()}`,
      text,
      author: `${currentProfile.name} (${currentProfile.location})`,
      color: bgColors[Math.floor(Math.random() * bgColors.length)],
      x: 20,
      y: 20,
    });
    stickyInput.value = '';
    redrawWhiteboard();
  });

  clearBtn?.addEventListener('click', () => {
    network.clearWhiteboard();
    redrawWhiteboard();
  });

  redrawWhiteboard = () => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle dot grid on whiteboard
    ctx.fillStyle = '#E2E8F0';
    for (let x = 20; x < canvas.width; x += 24) {
      for (let y = 20; y < canvas.height; y += 24) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const { strokes, stickies } = network.getWhiteboardData();
    strokes.forEach((s) => drawStrokeOnCanvas(canvas, s));

    if (stickiesLayer) {
      stickiesLayer.innerHTML = stickies
        .map(
          (st) => `
          <div class="w-48 rounded-xl border border-[#4B6F77]/35 p-3 shadow-md" style="background-color: ${escapeHtml(
            st.color
          )}">
            <p class="text-xs font-bold text-[#174955] leading-snug mb-1.5">${escapeHtml(
              st.text
            )}</p>
            <div class="text-[10px] text-[#4B6F77] font-semibold">📌 ${escapeHtml(
              st.author
            )}</div>
          </div>
        `
        )
        .join('');
    }
  };

  network.on('whiteboardUpdated', () => {
    if (dialog.open) {
      redrawWhiteboard();
    }
  });
}

function drawStrokeOnCanvas(
  canvas: HTMLCanvasElement,
  stroke: WhiteboardStroke
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || stroke.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function setupInGameHudAndChat(
  _vcardDialog: HTMLDialogElement,
  bulletinDialog: HTMLDialogElement,
  whiteboardDialog: HTMLDialogElement
): void {
  const chatForm = document.getElementById('chat-form') as HTMLFormElement;
  const chatInput = document.getElementById('chat-input') as HTMLInputElement;
  const chatDrawer = document.getElementById('ingame-chat-drawer');
  const toggleChatBtn = document.getElementById('toggle-chat-drawer-btn');
  const closeChatBtn = document.getElementById('close-chat-drawer-btn');

  const membersDrawer = document.getElementById('ingame-members-drawer');
  const toggleMembersBtn = document.getElementById('toggle-members-drawer-btn');
  const closeMembersBtn = document.getElementById('close-members-drawer-btn');

  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const centerCameraBtn = document.getElementById('center-camera-btn');
  const fullscreenBtn = document.getElementById('browser-fullscreen-btn');
  const leaveOfficeBtn = document.getElementById('leave-office-btn');
  const objectBanner = document.getElementById('object-proximity-banner');

  // Gather Status Switcher & Custom Status Note in Bottom Dock
  const statusSelect = document.getElementById(
    'dock-status-select'
  ) as HTMLSelectElement;
  const customStatusInput = document.getElementById(
    'dock-custom-status'
  ) as HTMLInputElement;

  if (statusSelect) {
    statusSelect.value = currentProfile.status || 'available';
    statusSelect.addEventListener('change', () => {
      currentProfile.status = statusSelect.value as AvailabilityStatus;
      saveProfile(currentProfile);
      coworkingScene.updateLocalProfile(currentProfile);
      network.updateProfile(currentProfile);
      renderDirectoryList();
    });
  }

  if (customStatusInput) {
    customStatusInput.value = currentProfile.customStatus || '';
    const applyCustomStatus = () => {
      currentProfile.customStatus = customStatusInput.value.trim();
      saveProfile(currentProfile);
      coworkingScene.updateLocalProfile(currentProfile);
      network.updateProfile(currentProfile);
    };
    customStatusInput.addEventListener('change', applyCustomStatus);
    customStatusInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomStatus();
        customStatusInput.blur();
      }
    });
  }

  // Gather Emote Bar (1-6)
  const emoteBar = document.getElementById('dock-emote-bar');
  if (emoteBar) {
    emoteBar.innerHTML = '';
    EMOTE_SHORTCUTS.forEach((sc) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'group flex items-center gap-1 rounded-lg hover:bg-[#174955]/10 px-2 py-1 text-sm transition cursor-pointer';
      btn.title = `${sc.label} (Taste ${sc.key})`;
      btn.innerHTML = `<span>${sc.emoji}</span><span class="text-[9px] font-bold text-[#4B6F77]">${sc.key}</span>`;
      btn.addEventListener('click', () => {
        coworkingScene.triggerLocalEmote(sc.emoji);
      });
      emoteBar.appendChild(btn);
    });
  }

  // Context banner click handler
  objectBanner?.addEventListener('click', () => {
    if (activeProximityObject === 'bulletin') {
      openBulletinBoardModal(bulletinDialog);
    } else if (activeProximityObject === 'coffee') {
      coworkingScene.grabFreshEspresso();
    } else if (activeProximityObject === 'whiteboard') {
      safeShowModal(whiteboardDialog);
      redrawWhiteboard();
    } else if (activeProximityObject === 'foosball') {
      coworkingScene.playFoosballMatch();
    }
  });

  toggleChatBtn?.addEventListener('click', () => {
    chatDrawer?.classList.toggle('hidden');
  });
  closeChatBtn?.addEventListener('click', () => {
    chatDrawer?.classList.add('hidden');
  });

  toggleMembersBtn?.addEventListener('click', () => {
    membersDrawer?.classList.toggle('hidden');
  });
  closeMembersBtn?.addEventListener('click', () => {
    membersDrawer?.classList.add('hidden');
  });

  zoomInBtn?.addEventListener('click', () => {
    coworkingScene.adjustZoom(0.145);
  });
  zoomOutBtn?.addEventListener('click', () => {
    coworkingScene.adjustZoom(-0.145);
  });
  centerCameraBtn?.addEventListener('click', () => {
    coworkingScene.centerCameraOnPlayer();
  });

  fullscreenBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  leaveOfficeBtn?.addEventListener('click', () => {
    leaveFullscreenOffice();
  });

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    if (inOfficeMode) {
      coworkingScene.showLocalSpeechBubble(text);
    }
    network.sendChatMessage(text, currentProfile);

    chatInput.value = '';
    chatInput.blur();
  });
}

function renderChatHistory(): void {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';
  network.getChatHistory().forEach((msg) => appendChatMessage(msg));
}

function appendChatMessage(msg: ChatMessage): void {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const item = document.createElement('div');
  item.className =
    'rounded-xl border border-[#4B6F77]/20 bg-white p-2.5 text-xs shadow-2xs';
  item.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="font-bold flex items-center gap-1.5 text-[#174955]">
        <span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color: ${escapeHtml(
          msg.color || '#00A5B5'
        )}"></span>
        ${escapeHtml(msg.senderName)}
        ${
          msg.senderId?.startsWith('npc-')
            ? '<span class="rounded bg-[#174955]/10 px-1 py-0.2 text-[9px] font-extrabold text-[#4B6F77]">BOT</span>'
            : ''
        }
      </span>
      <span class="text-[10px] font-medium text-[#4B6F77]">${escapeHtml(
        msg.timestamp
      )}</span>
    </div>
    <p class="text-[#2A2E30] font-medium leading-snug break-words">${escapeHtml(
      msg.text
    )}</p>
  `;
  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

function renderDirectoryList(): void {
  const listEl = document.getElementById('active-members-list');
  if (!listEl) return;

  const vcardDialog = document.getElementById(
    'vcard-modal'
  ) as HTMLDialogElement;

  const selfState: PlayerState = {
    ...currentProfile,
    id: 'self',
    x: 0,
    y: 0,
    direction: 'down',
    zone: currentPlayerZone,
    status: currentProfile.status || 'available',
  };

  const allMembers: PlayerState[] = [selfState, ...network.getOtherPlayers()];

  listEl.innerHTML = '';
  allMembers.forEach((member, idx) => {
    const isSelf = idx === 0;
    const actualZone: ZoneType = isSelf
      ? currentPlayerZone
      : member.x !== undefined && member.y !== undefined && member.x > 0 && member.y > 0
      ? getZoneFromCoordinates(member.x, member.y)
      : member.zone || 'lobby';

    const zoneMeta = getZoneMeta(actualZone);
    const statusMeta = getPlayerStatusMeta({
      zone: actualZone,
      status: member.status,
      x: member.x,
      y: member.y,
    });
    const dotHex = statusMeta.dotHex;

    const row = document.createElement('div');
    row.className =
      'w-full flex items-center justify-between gap-2 rounded-xl border border-[#4B6F77]/20 bg-white px-3 py-2 hover:border-[#00A5B5] shadow-2xs transition';

    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className =
      'flex-1 text-left flex items-center gap-2.5 min-w-0 cursor-pointer';
    infoBtn.innerHTML = `
      <span class="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 relative" style="background-color: ${escapeHtml(
        member.color
      )}">
        ${escapeHtml(member.name.slice(0, 2).toUpperCase())}
        <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white" style="background-color: ${dotHex}"></span>
      </span>
      <div class="min-w-0">
        <div class="text-xs font-extrabold text-[#174955] truncate flex items-center gap-1.5">
          <span>${escapeHtml(member.name)}</span>
          ${isSelf ? '<span class="text-[#007A87] font-bold text-[10px]">(Du)</span>' : ''}
          ${member.isNpc ? '<span class="rounded-full bg-[#174955]/10 border border-[#174955]/20 px-1.5 py-0.2 text-[9px] font-extrabold text-[#4B6F77]">🤖 BOT</span>' : ''}
          <span>${member.isSeated ? '🪑' : ''} ${member.hasCoffee ? '☕' : ''}</span>
        </div>
        <div class="text-[10px] font-medium text-[#4B6F77] truncate">
          📍 ${escapeHtml(member.location)} • ${zoneMeta.icon} ${escapeHtml(
      zoneMeta.shortLabel
    )} • ${escapeHtml(member.customStatus || statusMeta.label)}
        </div>
      </div>
    `;
    infoBtn.addEventListener('click', () => {
      openBusinessCardModal(
        vcardDialog,
        member,
        (recipientName) => {
          const chatInput = document.getElementById(
            'chat-input'
          ) as HTMLInputElement;
          if (chatInput) {
            chatInput.value = `@${recipientName}: `;
            chatInput.focus();
          }
        },
        (playerId) => {
          coworkingScene.walkToPlayer(playerId);
        }
      );
    });

    const rightControls = document.createElement('div');
    rightControls.className = 'flex items-center gap-1.5 shrink-0';

    if (!isSelf) {
      const walkBtn = document.createElement('button');
      walkBtn.type = 'button';
      walkBtn.className =
        'rounded-lg bg-[#174955] hover:bg-[#00A5B5] px-2 py-1 text-[10px] font-bold text-white transition cursor-pointer';
      walkBtn.title = 'Direkt zu diesem Avatar laufen';
      walkBtn.textContent = '🧭 Hinlaufen';
      walkBtn.addEventListener('click', () => {
        document
          .getElementById('ingame-members-drawer')
          ?.classList.add('hidden');
        coworkingScene.walkToPlayer(member.id);
      });
      rightControls.appendChild(walkBtn);
    }

    const statusDot = document.createElement('span');
    statusDot.className = 'h-2.5 w-2.5 rounded-full shrink-0';
    statusDot.style.backgroundColor = dotHex;
    rightControls.appendChild(statusDot);

    row.appendChild(infoBtn);
    row.appendChild(rightControls);
    listEl.appendChild(row);
  });
}

function setupQuickZoneNavigation(): void {
  document.querySelectorAll('[data-teleport-zone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const zone = btn.getAttribute('data-teleport-zone') as ZoneType;
      if (zone) {
        coworkingScene.teleportToZone(zone);
      }
    });
  });
}

function handleZoneChange(zone: ZoneType): void {
  currentPlayerZone = zone;
  const badge = document.getElementById('current-zone-badge');
  const confOverlay = document.getElementById('conference-video-overlay');
  const confTitle = document.getElementById('conference-overlay-title');
  const confRoomBadge = document.getElementById(
    'conference-overlay-room-badge'
  );
  const confChatPill = document.getElementById('conference-chat-room-pill');
  const confChatInput = document.getElementById(
    'conference-room-chat-input'
  ) as HTMLInputElement | null;

  const zoneMeta: Record<ZoneType, { label: string; classes: string }> = {
    lobby: {
      label: '🏛️ Eingangshalle & Infopunkt',
      classes: 'text-[#174955]',
    },
    focus: {
      label: '🌿 Fokus-Coworking I',
      classes: 'text-[#5F7F6E]',
    },
    cowork2: {
      label: '💻 Team- & Projekt-Studio II',
      classes: 'text-[#334E54]',
    },
    lounge: {
      label: '☕ Kaffeeküche & Lounge',
      classes: 'text-[#B86518]',
    },
    fun: {
      label: '🎮 Fun im Office (Kicker & Arcade)',
      classes: 'text-[#007A87]',
    },
    conference: {
      label: '🔴 Konferenzsaal I „Feldberg“ (Live)',
      classes: 'text-[#7E1946]',
    },
    networking: {
      label: '🤝 2. Konferenzraum „Networking-Arena“ (Live)',
      classes: 'text-[#B86518]',
    },
  };

  if (badge) {
    const meta = zoneMeta[zone];
    badge.textContent = meta.label;
    badge.className = `inline-flex items-center gap-1.5 px-2 py-1 text-xs font-extrabold whitespace-nowrap transition-colors ${meta.classes}`;
  }

  renderDirectoryList();

  // Highlight active room in the 2nd row of the light top menu bar (still frameless)
  document.querySelectorAll<HTMLElement>('[data-teleport-zone]').forEach((btn) => {
    const isCurrent = btn.getAttribute('data-teleport-zone') === zone;
    btn.className = isCurrent
      ? 'rounded-lg bg-[#174955]/12 px-2.5 py-1 font-extrabold text-[#174955] transition cursor-pointer'
      : 'rounded-lg hover:bg-[#174955]/10 px-2.5 py-1 font-semibold text-[#334E54] hover:text-[#174955] transition cursor-pointer';
  });

  if (confOverlay) {
    if (zone === 'conference' || zone === 'networking') {
      currentConferenceZone = zone;
      if (confTitle) {
        confTitle.textContent =
          zone === 'networking'
            ? '🤝 2. KONFERENZRAUM „NETWORKING-ARENA“ • B2B-SPEED-NETWORKING AKTIV'
            : '🔴 KONFERENZSAAL I „FELDBERG“ • VIDEO- & VOICE-SESSION AKTIV';
      }
      if (confRoomBadge) {
        confRoomBadge.textContent =
          zone === 'networking' ? 'Networking-Arena' : 'Saal Feldberg';
      }
      if (confChatPill) {
        confChatPill.textContent =
          zone === 'networking' ? 'Nur Networking II' : 'Nur Saal I';
      }
      if (confChatInput) {
        confChatInput.placeholder =
          zone === 'networking'
            ? 'Nachricht nur an Anwesende in Networking II...'
            : 'Nachricht nur an Anwesende in Saal I...';
      }
      renderConferenceRoomParticipants(zone);
      renderConferenceRoomChat(zone);
      confOverlay.classList.remove('hidden');
    } else {
      confOverlay.classList.add('hidden');
      stopJitsiIframe();
    }
  }
}

function renderConferenceRoomParticipants(
  room: 'conference' | 'networking'
): void {
  const listEl = document.getElementById('conference-room-members-list');
  const countEl = document.getElementById('conference-room-member-count');
  const vcardDialog = document.getElementById(
    'vcard-modal'
  ) as HTMLDialogElement;
  if (!listEl) return;

  const selfState: PlayerState = {
    ...currentProfile,
    id: 'self',
    x: 0,
    y: 0,
    direction: 'down',
    zone: room,
    status: 'busy',
  };

  const roomPeers = network.getPlayersInZone(room);
  const participants = [selfState, ...roomPeers];

  if (countEl) {
    countEl.textContent = String(participants.length);
  }

  listEl.innerHTML = '';
  participants.forEach((member, idx) => {
    const isSelf = idx === 0;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className =
      'inline-flex items-center gap-1.5 rounded-lg border border-[#94B0B8] bg-[#EDF5F7] hover:bg-[#DCECEF] hover:border-[#174955] px-2.5 py-1 text-[11px] font-bold text-[#151718] transition cursor-pointer';
    pill.title = 'Klicken für digitale Visitenkarte';
    pill.innerHTML = `
      <span class="h-2.5 w-2.5 rounded-full shrink-0" style="background-color: ${escapeHtml(
        member.color
      )}"></span>
      <span>${escapeHtml(member.name)} ${
      isSelf ? '<span class="text-[#007A87]">(Du)</span>' : ''
    }</span>
      <span class="text-[10px] font-medium text-[#4B6F77]">• ${escapeHtml(
        member.location
      )}</span>
    `;
    pill.addEventListener('click', () => {
      openBusinessCardModal(
        vcardDialog,
        member,
        (recipientName) => {
          const roomInput = document.getElementById(
            'conference-room-chat-input'
          ) as HTMLInputElement;
          if (roomInput) {
            roomInput.value = `@${recipientName}: `;
            roomInput.focus();
          }
        },
        (playerId) => {
          coworkingScene.walkToPlayer(playerId);
        }
      );
    });
    listEl.appendChild(pill);
  });
}

function renderConferenceRoomChat(room: 'conference' | 'networking'): void {
  const container = document.getElementById('conference-room-chat-messages');
  if (!container) return;
  container.innerHTML = '';
  const history = network.getRoomChatHistory(room);
  history.forEach((msg) => appendConferenceRoomChatMessage(msg));
}

function appendConferenceRoomChatMessage(msg: ChatMessage): void {
  const container = document.getElementById('conference-room-chat-messages');
  if (!container) return;

  const item = document.createElement('div');
  item.className =
    'rounded-lg border border-[#CBD5E1] bg-[#F1F5F9] p-2 text-xs';
  item.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-0.5">
      <span class="font-bold flex items-center gap-1.5 text-[#151718]">
        <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${escapeHtml(
          msg.color || '#E68A36'
        )}"></span>
        ${escapeHtml(msg.senderName)}
      </span>
      <span class="text-[10px] font-medium text-[#64748B]">${escapeHtml(
        msg.timestamp
      )}</span>
    </div>
    <p class="text-[#1E293B] font-medium leading-snug break-words">${escapeHtml(
      msg.text
    )}</p>
  `;
  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

function setupConferenceOverlay(): void {
  const leaveBtn = document.getElementById('conference-leave-btn');
  const startJitsiBtn = document.getElementById('conference-jitsi-btn');
  const toggleMinimizeBtn = document.getElementById('conference-minimize-btn');
  const bodyPanel = document.getElementById('conference-overlay-body');
  const roomChatForm = document.getElementById(
    'conference-room-chat-form'
  ) as HTMLFormElement | null;
  const roomChatInput = document.getElementById(
    'conference-room-chat-input'
  ) as HTMLInputElement | null;

  roomChatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!roomChatInput) return;
    const text = roomChatInput.value.trim();
    if (!text) return;

    // Only allow chatting if currently inside one of the conference rooms
    if (
      currentPlayerZone !== 'conference' &&
      currentPlayerZone !== 'networking'
    ) {
      return;
    }

    coworkingScene.showLocalSpeechBubble(text);
    network.sendChatMessage(text, currentProfile, currentConferenceZone);
    roomChatInput.value = '';
    roomChatInput.focus();
  });

  leaveBtn?.addEventListener('click', () => {
    stopJitsiIframe();
    coworkingScene.teleportToZone('lobby');
  });

  startJitsiBtn?.addEventListener('click', () => {
    const jitsiContainer = document.getElementById('conference-jitsi-container');
    const placeholderGrid = document.getElementById(
      'conference-simulated-grid'
    );
    if (!jitsiContainer || !placeholderGrid) return;

    if (!jitsiActive) {
      jitsiActive = true;
      placeholderGrid.classList.add('hidden');
      jitsiContainer.classList.remove('hidden');
      const roomName =
        currentConferenceZone === 'networking'
          ? 'UntertaunusDigitalBusinessHubNetworkingArena2026'
          : 'UntertaunusDigitalBusinessHubFeldberg2026';
      jitsiContainer.innerHTML = `
        <iframe
          src="https://meet.jit.si/${roomName}#userInfo.displayName=%22${encodeURIComponent(
        currentProfile.name
      )}%22&config.prejoinPageEnabled=false"
          allow="camera; microphone; fullscreen; display-capture"
          class="w-full h-44 rounded-lg border border-[#7E1946]/40 bg-[#151718]"
          title="Untertaunus Konferenzsaal Jitsi Meet"
        ></iframe>
      `;
      startJitsiBtn.textContent = 'Zurück zur Kompakt-Ansicht';
    } else {
      stopJitsiIframe();
    }
  });

  toggleMinimizeBtn?.addEventListener('click', () => {
    if (!bodyPanel) return;
    const isHidden = bodyPanel.classList.toggle('hidden');
    toggleMinimizeBtn.textContent = isHidden ? 'Aufklappen' : 'Minimieren';
  });
}

function stopJitsiIframe(): void {
  jitsiActive = false;
  const jitsiContainer = document.getElementById('conference-jitsi-container');
  const placeholderGrid = document.getElementById('conference-simulated-grid');
  const startJitsiBtn = document.getElementById('conference-jitsi-btn');
  if (jitsiContainer) {
    jitsiContainer.innerHTML = '';
    jitsiContainer.classList.add('hidden');
  }
  placeholderGrid?.classList.remove('hidden');
  if (startJitsiBtn) {
    startJitsiBtn.textContent = 'Jitsi-Live-Raum laden (Optional)';
  }
}

function updateHudProfileBadge(): void {
  const nameBadge = document.getElementById('hud-profile-name');
  const townBadge = document.getElementById('hud-profile-town');
  const dot = document.getElementById('hud-profile-dot');
  if (nameBadge) {
    nameBadge.textContent = currentProfile.name;
  }
  if (townBadge) {
    townBadge.textContent = `📍 ${currentProfile.location} • Visitenkarte ✏️`;
  }
  if (dot) {
    dot.style.backgroundColor = currentProfile.color;
  }
}

function updateOnlineStatusBadge(_connected: boolean, count: number): void {
  document.querySelectorAll('[data-online-count]').forEach((el) => {
    el.textContent = `${count} Personen im Hub online`;
  });
}

window.addEventListener('DOMContentLoaded', initApp);
