import Phaser from 'phaser';
import { generateHubTextures } from './AssetGenerator';
import type { NetworkManager } from './NetworkManager';
import {
  EMOTE_SHORTCUTS,
  getPlayerStatusMeta,
  getZoneFromCoordinates,
  type PlayerProfile,
  type PlayerState,
  type ZoneType,
} from '../types';

interface AvatarVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  coffeeSprite: Phaser.GameObjects.Image;
  nameTag: Phaser.GameObjects.Text;
  townBadge: Phaser.GameObjects.Text;
  customStatusTag: Phaser.GameObjects.Text;
  statusDot: Phaser.GameObjects.Arc;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  bubbleExpiresAt: number;
  state: PlayerState;
}

interface SeatInstance {
  id: string;
  label: string;
  chairX: number;
  chairY: number;
  seatSprite: Phaser.GameObjects.Image;
  defaultSeatTexture: string;
  deskSprite?: Phaser.Physics.Arcade.Sprite;
  deskX?: number;
  deskY?: number;
  occupiedBadge?: Phaser.GameObjects.Text;
  isOccupied: boolean;
}

interface OutdoorWalker {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  texturePrefix: string;
  waypoints: Array<{ x: number; y: number }>;
  currentTargetIdx: number;
  speed: number;
  animTimer: number;
  bobAmplitude: number;
}

export interface CoworkingCallbacks {
  onZoneChange: (zone: ZoneType) => void;
  onAvatarClick: (player: PlayerState) => void;
  onOpenBulletinBoard: () => void;
  onOpenWhiteboard: () => void;
  onCoffeeGrabbed: (expiresAt: number) => void;
  onSeatChange: (seatLabel: string | null) => void;
  onInteractPromptChange: (
    prompt: {
      type: 'bulletin' | 'coffee' | 'whiteboard' | 'foosball';
      label: string;
    } | null
  ) => void;
  onRequestChatFocus: () => void;
  onZoomChange?: (zoomPercent: number) => void;
}

export class CoworkingScene extends Phaser.Scene {
  private network!: NetworkManager;
  private localProfile!: PlayerProfile;
  private callbacks!: CoworkingCallbacks;

  private playerBody!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private localVisual!: AvatarVisual;
  private otherVisuals = new Map<string, AvatarVisual>();
  private seats: SeatInstance[] = [];

  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
  };

  private currentZone: ZoneType = 'lobby';
  private activeInteractTarget:
    | 'bulletin'
    | 'coffee'
    | 'whiteboard'
    | 'foosball'
    | null = null;
  private moveTarget: { x: number; y: number } | null = null;
  private pendingSeat: SeatInstance | null = null;
  private currentSeatedAt: SeatInstance | null = null;
  private targetMarker!: Phaser.GameObjects.Arc;

  // Gather-style Proximity Circle, Desk Highlight & Onboarding Tour Spotlight Graphics
  private proximityGraphics!: Phaser.GameObjects.Graphics;
  private deskHighlightGraphics!: Phaser.GameObjects.Graphics;
  private tourSpotlightGraphics!: Phaser.GameObjects.Graphics;

  // Onboarding Tour State (locks avatar controls & highlights current tour station)
  private isTourActive = false;
  private activeTourRect: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  private pendingTourTarget: {
    camX: number;
    camY: number;
    zoom: number;
    rect: { x: number; y: number; w: number; h: number };
  } | null = null;

  // Interactive object prompts inside the 2D world
  private stelePromptContainer!: Phaser.GameObjects.Container;
  private coffeePromptContainer!: Phaser.GameObjects.Container;
  private whiteboardPromptContainer!: Phaser.GameObjects.Container;
  private foosballPromptContainer!: Phaser.GameObjects.Container;

  private lastNetworkSync = 0;
  private walkTimer = 0;
  private readonly DEFAULT_ZOOM = 1.45;
  private cameraZoom = 1.45 * 0.5;
  private coffeeBoostExpiresAt = 0;
  private outdoorWalkers: OutdoorWalker[] = [];

  // Mouse Hand Click-and-Hold Camera Drag State
  private isPointerDown = false;
  private isDraggingCamera = false;
  private isFollowingPlayer = true;
  private dragStartScreenX = 0;
  private dragStartScreenY = 0;
  private dragStartScrollX = 0;
  private dragStartScrollY = 0;
  private lastModalOpenTime = 0;

  // Expanded 7-Room Campus Dimensions
  private readonly WORLD_W = 2100;
  private readonly WORLD_H = 1260;

  // Key interactive object coordinates
  private readonly STELE_X = 880;
  private readonly STELE_Y = 820;
  private readonly COFFEE_X = 1740;
  private readonly COFFEE_Y = 115;
  private readonly WHITEBOARD_X = 1565;
  private readonly WHITEBOARD_Y = 710;
  private readonly FOOSBALL_X = 240;
  private readonly FOOSBALL_Y = 820;

  constructor() {
    super({ key: 'CoworkingScene' });
  }

  public initData(
    network: NetworkManager,
    profile: PlayerProfile,
    callbacks: CoworkingCallbacks
  ): void {
    this.network = network;
    this.localProfile = profile;
    this.callbacks = callbacks;
  }

  public create(): void {
    generateHubTextures(this);

    this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
    this.input.setDefaultCursor('grab');

    // 1. Draw 2.5D Gather-style floor layout, Taunus panorama windows & all 7 rooms
    this.drawFloorAndZones();

    // Graphics layers for occupied desks, proximity circle & onboarding tour spotlight
    this.deskHighlightGraphics = this.add.graphics().setDepth(6);
    this.proximityGraphics = this.add.graphics().setDepth(8);
    this.tourSpotlightGraphics = this.add.graphics().setDepth(3200);

    // 2. Build walls, 16 reactive desks, lounge, fun room, 2 conference rooms & seats
    this.obstacles = this.physics.add.staticGroup();
    this.buildArchitectureAndFurniture();

    // 3. Click-to-Move target indicator
    this.targetMarker = this.add.circle(0, 0, 14, 0x00a5b5, 0.28);
    this.targetMarker.setStrokeStyle(2.5, 0x00a5b5, 0.95);
    this.targetMarker.setVisible(false);

    // 4. Create Local Player physics body + visual avatar in central Lobby
    const startX = 1050;
    const startY = 980;
    this.playerBody = this.physics.add
      .sprite(startX, startY, this.getAvatarTextureKey(this.localProfile.color))
      .setAlpha(0);
    this.playerBody.body.setSize(28, 22);
    this.playerBody.body.setOffset(10, 20);
    this.playerBody.setCollideWorldBounds(true);

    this.physics.add.collider(this.playerBody, this.obstacles, () => {
      // If we were walking toward a clicked seat and touched the desk edge, snap onto the seat!
      if (this.pendingSeat) {
        const dist = Phaser.Math.Distance.Between(
          this.playerBody.x,
          this.playerBody.y,
          this.pendingSeat.chairX,
          this.pendingSeat.chairY
        );
        if (dist < 110) {
          this.sitAtSeat(this.pendingSeat);
          return;
        }
      }
      this.moveTarget = null;
      this.pendingSeat = null;
      this.targetMarker.setVisible(false);
    });

    const initialSelfState: PlayerState = {
      ...this.localProfile,
      id: 'self',
      x: startX,
      y: startY,
      direction: 'up',
      zone: 'lobby',
      status: this.localProfile.status || 'available',
      customStatus: this.localProfile.customStatus || '',
      hasCoffee: false,
      isSeated: false,
    };
    this.localVisual = this.createAvatarVisual(initialSelfState, true);

    // 5. Configure Fullscreen Camera (generous outer Taunus landscape bounds + free drag)
    this.cameras.main.setBackgroundColor('#244734');
    this.cameras.main.setBounds(
      -850,
      -650,
      this.WORLD_W + 1700,
      this.WORLD_H + 1300
    );
    this.cameras.main.startFollow(this.playerBody, true, 0.1, 0.1);
    this.cameras.main.setZoom(this.cameraZoom);
    this.isFollowingPlayer = true;
    this.callbacks.onZoomChange?.(this.getZoomPercent());

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.isTourActive) return;
        if (deltaY > 0) {
          this.adjustZoom(-0.0725);
        } else if (deltaY < 0) {
          this.adjustZoom(0.0725);
        }
      }
    );

    // 6. Render other players & regional NPCs + listen for Emotes
    this.syncOtherPlayers(this.network.getOtherPlayers());
    this.network.on('playersUpdated', (players) => {
      if (this.scene.isActive()) {
        this.syncOtherPlayers(players);
      }
    });

    this.network.on('emoteTriggered', (senderId, emoji) => {
      if (this.scene.isActive()) {
        this.showRemoteEmote(senderId, emoji);
      }
    });

    // 7. Keyboard Controls (WASD + Arrows + E + Enter + 1..6 Emote Shortcuts)
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.clearCaptures();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, false),
      };

      this.input.keyboard.on('keydown-E', () => {
        if (this.isTourActive || this.isTypingInInput()) return;
        this.triggerNearestObjectInteraction();
      });

      this.input.keyboard.on('keydown-ENTER', (event: KeyboardEvent) => {
        if (this.isTourActive || this.isTypingInInput()) return;
        event.preventDefault();
        this.callbacks.onRequestChatFocus();
      });

      EMOTE_SHORTCUTS.forEach((shortcut) => {
        this.input.keyboard?.on(`keydown-${shortcut.key}`, () => {
          if (this.isTourActive || this.isTypingInInput()) return;
          this.triggerLocalEmote(shortcut.emoji);
        });
      });
    }

    // 8. Mouse Hand Click-and-Hold Panning + Short-Click-to-Move on Floor
    document.querySelectorAll('dialog').forEach((dlg) => {
      dlg.addEventListener('close', () => {
        this.lastModalOpenTime = Date.now();
        this.isPointerDown = false;
      });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isPointerBlockedByUi(pointer)) {
        this.isPointerDown = false;
        return;
      }
      this.isPointerDown = true;
      this.isDraggingCamera = false;
      this.dragStartScreenX = pointer.x;
      this.dragStartScreenY = pointer.y;
      this.dragStartScrollX = this.cameras.main.scrollX;
      this.dragStartScrollY = this.cameras.main.scrollY;
      if (this.game?.canvas) {
        this.game.canvas.style.cursor = 'grabbing';
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (
        this.isPointerBlockedByUi(pointer) ||
        !this.isPointerDown ||
        !pointer.isDown
      ) {
        return;
      }
      const dx = pointer.x - this.dragStartScreenX;
      const dy = pointer.y - this.dragStartScreenY;

      if (Math.hypot(dx, dy) > 6) {
        this.isDraggingCamera = true;
        if (this.isFollowingPlayer) {
          this.cameras.main.stopFollow();
          this.isFollowingPlayer = false;
        }
        if (this.game?.canvas) {
          this.game.canvas.style.cursor = 'grabbing';
        }
        const zoom = this.cameras.main.zoom || 1;
        this.cameras.main.scrollX = this.dragStartScrollX - dx / zoom;
        this.cameras.main.scrollY = this.dragStartScrollY - dy / zoom;
      }
    });

    this.input.on(
      'pointerup',
      (
        pointer: Phaser.Input.Pointer,
        currentlyOver: Phaser.GameObjects.GameObject[]
      ) => {
        const wasPointerDownOnCanvas = this.isPointerDown;
        this.isPointerDown = false;
        if (this.game?.canvas) {
          this.game.canvas.style.cursor = 'grab';
        }

        if (this.isDraggingCamera) {
          setTimeout(() => {
            this.isDraggingCamera = false;
          }, 40);
          return;
        }

        // Ignore pointerup if the click did not start on the canvas or came from a modal / UI button (like closing X)
        if (!wasPointerDownOnCanvas || this.isPointerBlockedByUi(pointer)) {
          return;
        }

        if (currentlyOver && currentlyOver.length > 0) return;

        // Short click on empty floor -> Walk there
        this.standUpFromSeat();
        const targetX = Phaser.Math.Clamp(
          pointer.worldX,
          40,
          this.WORLD_W - 40
        );
        const targetY = Phaser.Math.Clamp(
          pointer.worldY,
          55,
          this.WORLD_H - 40
        );
        this.pendingSeat = null;
        this.moveTarget = { x: targetX, y: targetY };
        this.targetMarker.setPosition(targetX, targetY);
        this.targetMarker.setVisible(true);
        this.tweens.add({
          targets: this.targetMarker,
          scale: { from: 0.6, to: 1.25 },
          duration: 260,
          yoyo: true,
        });
      }
    );

    // If the Onboarding Tour was triggered right as Phaser booted, apply the first station immediately
    if (this.pendingTourTarget) {
      this.focusTourStation(
        this.pendingTourTarget.camX,
        this.pendingTourTarget.camY,
        this.pendingTourTarget.zoom,
        this.pendingTourTarget.rect
      );
    }
  }

  /**
   * Returns true if any modal `<dialog>` is currently open, was closed within the last 320ms,
   * the onboarding tour is active, or the pointer event originated on a DOM UI element rather than the canvas.
   */
  private isPointerBlockedByUi(pointer?: Phaser.Input.Pointer): boolean {
    if (this.isTourActive) return true;
    if (document.querySelector('dialog[open]')) {
      this.lastModalOpenTime = Date.now();
      return true;
    }
    if (Date.now() - this.lastModalOpenTime < 320) {
      return true;
    }
    const target = pointer?.event?.target as HTMLElement | null | undefined;
    if (target && this.game?.canvas && target !== this.game.canvas) {
      return true;
    }
    return false;
  }

  /**
   * Smoothly pans & zooms the camera to an Onboarding Tour station, locks avatar controls,
   * and activates the darkened map spotlight + pulsing Warm-Amber border around `rect`.
   */
  public focusTourStation(
    camX: number,
    camY: number,
    zoom: number,
    rect: { x: number; y: number; w: number; h: number }
  ): void {
    this.isTourActive = true;
    this.activeTourRect = rect;
    this.pendingTourTarget = { camX, camY, zoom, rect };

    if (!this.cameras?.main) return;

    this.moveTarget = null;
    this.pendingSeat = null;
    this.targetMarker?.setVisible(false);
    this.playerBody?.setVelocity(0, 0);

    this.isFollowingPlayer = false;
    this.cameras.main.stopFollow();
    this.cameras.main.pan(camX, camY, 850, 'Sine.easeInOut', true);
    this.cameras.main.zoomTo(zoom, 850, 'Sine.easeInOut', true);
  }

  /**
   * Ends the Onboarding Tour, clears the spotlight mask, unlocks avatar controls,
   * and smoothly returns the camera to the player's own avatar.
   */
  public endOnboardingTour(): void {
    this.isTourActive = false;
    this.activeTourRect = null;
    this.pendingTourTarget = null;
    this.tourSpotlightGraphics?.clear();

    if (!this.cameras?.main || !this.playerBody) return;

    this.cameras.main.pan(
      this.playerBody.x,
      this.playerBody.y,
      650,
      'Sine.easeInOut',
      true,
      (_cam, progress) => {
        if (progress === 1 && !this.isTourActive) {
          this.isFollowingPlayer = true;
          this.cameras.main.startFollow(this.playerBody, true, 0.12, 0.12);
        }
      }
    );
    this.cameras.main.zoomTo(this.cameraZoom, 650, 'Sine.easeInOut', true);
  }

  public centerCameraOnPlayer(): void {
    if (this.isTourActive || !this.cameras?.main || !this.playerBody) return;
    this.isFollowingPlayer = true;
    this.cameras.main.startFollow(this.playerBody, true, 0.12, 0.12);
  }

  public getZoomPercent(): number {
    return Math.round((this.cameraZoom / this.DEFAULT_ZOOM) * 100);
  }

  public setZoomPercent(percent: number): void {
    const clampedPercent = Phaser.Math.Clamp(percent, 30, 160);
    this.cameraZoom = this.DEFAULT_ZOOM * (clampedPercent / 100);
    this.callbacks?.onZoomChange?.(this.getZoomPercent());
    if (this.cameras?.main && !this.isTourActive) {
      this.cameras.main.setZoom(this.cameraZoom);
    }
  }

  public adjustZoom(delta: number): void {
    if (this.isTourActive) return;
    this.cameraZoom = Phaser.Math.Clamp(
      this.cameraZoom + delta,
      this.DEFAULT_ZOOM * 0.3,
      this.DEFAULT_ZOOM * 1.6
    );
    this.callbacks.onZoomChange?.(this.getZoomPercent());
    if (this.cameras && this.cameras.main) {
      this.tweens.add({
        targets: this.cameras.main,
        zoom: this.cameraZoom,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    }
  }

  public triggerNearestObjectInteraction(): void {
    if (this.isTourActive) return;
    if (this.activeInteractTarget === 'bulletin') {
      this.callbacks.onOpenBulletinBoard();
    } else if (this.activeInteractTarget === 'coffee') {
      this.grabFreshEspresso();
    } else if (this.activeInteractTarget === 'whiteboard') {
      this.callbacks.onOpenWhiteboard();
    } else if (this.activeInteractTarget === 'foosball') {
      this.playFoosballMatch();
    }
  }

  public grabFreshEspresso(): void {
    this.coffeeBoostExpiresAt = Date.now() + 90000;
    this.localVisual.state.hasCoffee = true;
    this.localVisual.coffeeSprite.setVisible(true);
    this.triggerLocalEmote('☕');
    this.showLocalSpeechBubble(
      '☕ Frischer Siebträger-Espresso! (+25% Tempo-Boost)'
    );
    this.callbacks.onCoffeeGrabbed(this.coffeeBoostExpiresAt);
    this.network.updateProfile({
      ...this.localProfile,
      hasCoffee: true,
    });
  }

  public playFoosballMatch(): void {
    const outcomes = [
      '⚽ TOR! 1:0 am Taunus-Tischkicker! 🎉',
      '⚽ Spannendes Kicker-Match in der Fun-Zone! 🔥',
      '⚽ Traumtor aus der Drehung am Tischkicker! 🏆',
    ];
    const msg = outcomes[Math.floor(Math.random() * outcomes.length)];
    this.triggerLocalEmote('🎉');
    this.showLocalSpeechBubble(msg);
  }

  public triggerLocalEmote(emoji: string): void {
    if (!this.localVisual) return;
    this.playFloatingEmote(this.localVisual, emoji);
    this.network.sendEmote(emoji);
  }

  public showRemoteEmote(senderId: string, emoji: string): void {
    const vis = this.otherVisuals.get(senderId);
    if (vis) {
      this.playFloatingEmote(vis, emoji);
    }
  }

  public walkToPlayer(playerId: string): void {
    if (!this.playerBody || this.isTourActive) return;
    const vis = this.otherVisuals.get(playerId);
    if (!vis) return;

    this.standUpFromSeat();
    this.centerCameraOnPlayer();
    const targetX = Phaser.Math.Clamp(vis.state.x - 48, 50, this.WORLD_W - 50);
    const targetY = Phaser.Math.Clamp(vis.state.y + 15, 65, this.WORLD_H - 50);
    this.pendingSeat = null;
    this.moveTarget = { x: targetX, y: targetY };
    this.targetMarker.setPosition(targetX, targetY);
    this.targetMarker.setVisible(true);
  }

  /**
   * Handles clicking on a seat (chair/stool/beanbag) or desk/table.
   * If the player is within proximity (<= 230px), they immediately sit down on the seat.
   * If slightly further away, they walk to the seat and sit down upon arrival.
   */
  private handleSeatOrDeskClick(
    seat: SeatInstance,
    pointer?: Phaser.Input.Pointer
  ): void {
    if (
      !this.playerBody ||
      this.isDraggingCamera ||
      this.isPointerBlockedByUi(pointer)
    ) {
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.playerBody.x,
      this.playerBody.y,
      seat.chairX,
      seat.chairY
    );

    if (dist <= 230) {
      this.sitAtSeat(seat);
    } else {
      // Walk to seat and sit automatically on arrival
      this.standUpFromSeat();
      this.pendingSeat = seat;
      this.moveTarget = { x: seat.chairX, y: seat.chairY };
      this.targetMarker.setPosition(seat.chairX, seat.chairY);
      this.targetMarker.setVisible(true);
      this.showLocalSpeechBubble(`🪑 Laufe zu ${seat.label}...`);
    }
  }

  private sitAtSeat(seat: SeatInstance): void {
    this.moveTarget = null;
    this.pendingSeat = null;
    this.targetMarker.setVisible(false);

    this.currentSeatedAt = seat;
    this.playerBody.setVelocity(0, 0);
    this.playerBody.setPosition(seat.chairX, seat.chairY);
    this.localVisual.container.setPosition(seat.chairX, seat.chairY);
    this.localVisual.state.x = seat.chairX;
    this.localVisual.state.y = seat.chairY;
    this.localVisual.state.direction = 'up';
    this.localVisual.state.isSeated = true;
    this.localVisual.sprite.setTexture(
      this.getAvatarTextureKey(this.localProfile.color, 'up', 0, true)
    );

    this.callbacks.onSeatChange(seat.label);
    this.updateReactiveSeatsAndDesks();

    this.network.sendMove(
      seat.chairX,
      seat.chairY,
      'up',
      this.currentZone,
      Boolean(this.localVisual.state.hasCoffee)
    );
  }

  private standUpFromSeat(): void {
    if (!this.currentSeatedAt) return;
    this.currentSeatedAt = null;
    this.localVisual.state.isSeated = false;
    this.localVisual.sprite.setTexture(
      this.getAvatarTextureKey(
        this.localProfile.color,
        this.localVisual.state.direction,
        0,
        false
      )
    );
    this.callbacks.onSeatChange(null);
  }

  public update(time: number, delta: number): void {
    if (!this.playerBody || !this.localVisual) return;

    const now = Date.now();
    if (document.querySelector('dialog[open]')) {
      this.lastModalOpenTime = now;
    }

    if (this.coffeeBoostExpiresAt > 0 && now > this.coffeeBoostExpiresAt) {
      this.coffeeBoostExpiresAt = 0;
      this.localVisual.state.hasCoffee = false;
      this.localVisual.coffeeSprite.setVisible(false);
    }

    const typing = this.isTypingInInput();
    const baseSpeed = 245;
    const speed = this.coffeeBoostExpiresAt > now ? baseSpeed * 1.25 : baseSpeed;
    let vx = 0;
    let vy = 0;
    let direction = this.localVisual.state.direction;

    if (!this.isTourActive && !typing && this.cursors && this.wasd) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      if (left) {
        vx = -speed;
        direction = 'left';
      } else if (right) {
        vx = speed;
        direction = 'right';
      }

      if (up) {
        vy = -speed;
        direction = 'up';
      } else if (down) {
        vy = speed;
        direction = 'down';
      }

      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }

      if (vx !== 0 || vy !== 0) {
        this.standUpFromSeat();
        if (!this.isFollowingPlayer && !this.isPointerDown) {
          this.centerCameraOnPlayer();
        }
        this.moveTarget = null;
        this.pendingSeat = null;
        this.targetMarker.setVisible(false);
      }
    }

    if (!this.isTourActive && vx === 0 && vy === 0 && this.moveTarget) {
      const dx = this.moveTarget.x - this.playerBody.x;
      const dy = this.moveTarget.y - this.playerBody.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 14) {
        if (this.pendingSeat) {
          this.sitAtSeat(this.pendingSeat);
        } else {
          this.moveTarget = null;
          this.targetMarker.setVisible(false);
        }
      } else {
        vx = (dx / dist) * speed;
        vy = (dy / dist) * speed;
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }
      }
    }

    this.playerBody.setVelocity(vx, vy);

    const isMoving = Math.abs(vx) > 1 || Math.abs(vy) > 1;
    if (isMoving) {
      this.walkTimer += delta * 0.016;
    } else {
      this.walkTimer = 0;
    }

    const walkFrame: 0 | 1 =
      isMoving && Math.floor(this.walkTimer * 1.4) % 2 === 1 ? 1 : 0;
    const bobOffset = isMoving ? Math.sin(this.walkTimer) * 2.2 : 0;
    this.localVisual.container.setPosition(
      this.playerBody.x,
      this.playerBody.y + bobOffset
    );
    this.localVisual.container.setDepth(this.playerBody.y + 15);
    this.localVisual.state.x = Math.round(this.playerBody.x);
    this.localVisual.state.y = Math.round(this.playerBody.y);
    this.localVisual.state.direction = direction;

    const targetTexKey = this.getAvatarTextureKey(
      this.localProfile.color,
      direction,
      walkFrame,
      Boolean(this.localVisual.state.isSeated)
    );
    if (this.localVisual.sprite.texture.key !== targetTexKey) {
      this.localVisual.sprite.setTexture(targetTexKey);
    }

    // 1. Evaluate current architectural zone across all 7 rooms
    const detectedZone = this.detectZone(this.playerBody.x, this.playerBody.y);
    if (detectedZone !== this.currentZone) {
      this.currentZone = detectedZone;
      this.localVisual.state.zone = detectedZone;
      this.updateStatusDotColor(this.localVisual);
      this.callbacks.onZoneChange(detectedZone);
    }

    // 2. Gather-style Proximity Circle & Nearby Avatar Connection Lines
    this.drawProximityCircle(this.playerBody.x, this.playerBody.y);

    // 3. Reactive Seats & Desks: Change desk color & chair highlight when occupied!
    this.updateReactiveSeatsAndDesks();

    // 3b. Onboarding Tour Zone Spotlight & Pulsing Highlight Frame
    this.renderTourSpotlight(time);

    // 4. Check proximity to interactive objects (Schwarzes Brett, Coffee Bar, Whiteboard, Foosball)
    this.checkInteractiveObjectsProximity(this.playerBody.x, this.playerBody.y);

    // 5. Check speech bubble expirations
    this.checkBubbleExpiration(this.localVisual, now);
    this.otherVisuals.forEach((vis) => {
      this.checkBubbleExpiration(vis, now);
    });

    // 5b. Animate outdoor Taunus hikers & forest animals along paths & meadows
    this.updateOutdoorWalkers(delta);

    // 6. Throttled Socket.io position broadcast
    if (isMoving && time - this.lastNetworkSync > 60) {
      this.lastNetworkSync = time;
      this.network.sendMove(
        Math.round(this.playerBody.x),
        Math.round(this.playerBody.y),
        direction,
        this.currentZone,
        Boolean(this.localVisual.state.hasCoffee)
      );
    }
  }

  /**
   * Renders the darkened outer map mask and a pulsing Warm-Amber (#E68A36) + Cyan (#00A5B5)
   * highlight frame around the active Onboarding Tour zone.
   */
  private renderTourSpotlight(time: number): void {
    if (!this.tourSpotlightGraphics) return;
    this.tourSpotlightGraphics.clear();

    if (!this.isTourActive || !this.activeTourRect) return;

    const { x, y, w, h } = this.activeTourRect;
    const minX = -600;
    const minY = -500;
    const maxX = this.WORLD_W + 600;
    const maxY = this.WORLD_H + 500;

    // 4 dark semi-transparent rectangles around the active zone (leaves the zone crystal-clear!)
    this.tourSpotlightGraphics.fillStyle(0x091f24, 0.65);
    // Top band
    this.tourSpotlightGraphics.fillRect(minX, minY, maxX - minX, y - minY);
    // Bottom band
    this.tourSpotlightGraphics.fillRect(
      minX,
      y + h,
      maxX - minX,
      maxY - (y + h)
    );
    // Left band
    this.tourSpotlightGraphics.fillRect(minX, y, x - minX, h);
    // Right band
    this.tourSpotlightGraphics.fillRect(x + w, y, maxX - (x + w), h);

    // Pulsing Warm-Amber (#E68A36) outer glow + crisp border around the highlighted zone
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0055);
    const expand = 4 + pulse * 6;

    this.tourSpotlightGraphics.lineStyle(
      6,
      0xe68a36,
      0.28 + pulse * 0.35
    );
    this.tourSpotlightGraphics.strokeRoundedRect(
      x - expand,
      y - expand,
      w + expand * 2,
      h + expand * 2,
      18
    );

    this.tourSpotlightGraphics.lineStyle(3.5, 0xe68a36, 0.95);
    this.tourSpotlightGraphics.strokeRoundedRect(x, y, w, h, 14);

    this.tourSpotlightGraphics.lineStyle(
      1.5,
      0x00a5b5,
      0.55 + pulse * 0.4
    );
    this.tourSpotlightGraphics.strokeRoundedRect(
      x + 4,
      y + 4,
      w - 8,
      h - 8,
      11
    );
  }

  public updateLocalProfile(profile: PlayerProfile): void {
    this.localProfile = profile;
    if (!this.localVisual) return;
    Object.assign(this.localVisual.state, profile);
    this.localVisual.sprite.setTexture(
      this.getAvatarTextureKey(
        profile.color,
        this.localVisual.state.direction,
        0,
        Boolean(this.localVisual.state.isSeated)
      )
    );
    this.localVisual.nameTag.setText(`${profile.name} (Du)`);
    this.localVisual.townBadge.setText(`📍 ${profile.location}`);
    this.updateCustomStatusTag(this.localVisual);
    this.updateStatusDotColor(this.localVisual);
  }

  public showLocalSpeechBubble(text: string): void {
    if (!this.localVisual) return;
    this.applySpeechBubble(this.localVisual, text, Date.now() + 6000);
  }

  public showRemoteSpeechBubble(senderId: string, text: string): void {
    const vis = this.otherVisuals.get(senderId);
    if (vis) {
      this.applySpeechBubble(vis, text, Date.now() + 6000);
    }
  }

  public teleportToZone(zone: ZoneType): void {
    if (!this.playerBody) return;
    this.standUpFromSeat();
    this.centerCameraOnPlayer();
    const targets: Record<ZoneType, { x: number; y: number }> = {
      focus: { x: 350, y: 300 },
      cowork2: { x: 1050, y: 300 },
      lounge: { x: 1740, y: 290 },
      fun: { x: 350, y: 920 },
      lobby: { x: 1050, y: 950 },
      conference: { x: 1570, y: 920 },
      networking: { x: 1915, y: 920 },
    };
    const pos = targets[zone];
    this.moveTarget = null;
    this.pendingSeat = null;
    this.targetMarker.setVisible(false);
    this.playerBody.setPosition(pos.x, pos.y);
    this.network.sendMove(
      pos.x,
      pos.y,
      'down',
      zone,
      Boolean(this.localVisual?.state.hasCoffee)
    );
  }

  private drawProximityCircle(px: number, py: number): void {
    this.proximityGraphics.clear();

    const proxRadius = 155;
    this.proximityGraphics.fillStyle(0x00a5b5, 0.045);
    this.proximityGraphics.fillCircle(px, py, proxRadius);
    this.proximityGraphics.lineStyle(1.5, 0x00a5b5, 0.32);
    this.proximityGraphics.strokeCircle(px, py, proxRadius);

    this.otherVisuals.forEach((vis) => {
      const dist = Phaser.Math.Distance.Between(
        px,
        py,
        vis.container.x,
        vis.container.y
      );
      if (dist <= proxRadius) {
        this.proximityGraphics.lineStyle(2, 0x00a5b5, 0.55);
        this.proximityGraphics.lineBetween(
          px,
          py,
          vis.container.x,
          vis.container.y
        );
        this.proximityGraphics.fillStyle(0x00a5b5, 0.14);
        this.proximityGraphics.fillCircle(
          vis.container.x,
          vis.container.y,
          28
        );
      }
    });
  }

  /**
   * Checks all registered seats & desks.
   * When any avatar is seated on a chair/seat (`distance < 34`), the desk changes its texture
   * to the colored `desk-cowork-on` variant, the chair turns warm-amber (`chair-office-active`),
   * and a bright colored highlight frame + "BESETZT" badge is rendered so everyone sees it!
   */
  private updateReactiveSeatsAndDesks(): void {
    this.deskHighlightGraphics.clear();

    const allAvatars: { x: number; y: number; color: string; name: string }[] = [
      {
        x: this.playerBody.x,
        y: this.playerBody.y,
        color: this.localProfile.color,
        name: this.localProfile.name,
      },
    ];
    this.otherVisuals.forEach((vis) => {
      allAvatars.push({
        x: vis.container.x,
        y: vis.container.y,
        color: vis.state.color,
        name: vis.state.name,
      });
    });

    for (const seat of this.seats) {
      const occupant = allAvatars.find(
        (av) =>
          Phaser.Math.Distance.Between(av.x, av.y, seat.chairX, seat.chairY) <
          34
      );
      const occupied = Boolean(occupant);

      if (occupied !== seat.isOccupied) {
        seat.isOccupied = occupied;
        if (seat.deskSprite) {
          seat.deskSprite.setTexture(
            occupied ? 'desk-cowork-on' : 'desk-cowork-off'
          );
        }
        if (seat.defaultSeatTexture === 'chair-office') {
          seat.seatSprite.setTexture(
            occupied ? 'chair-office-active' : 'chair-office'
          );
        }
        if (seat.occupiedBadge) {
          seat.occupiedBadge.setVisible(occupied);
        }
      }

      // Draw vivid colored floor/desk aura when occupied so everyone sees the desk is taken
      if (occupied && seat.deskX !== undefined && seat.deskY !== undefined) {
        this.deskHighlightGraphics.fillStyle(0xe68a36, 0.22);
        this.deskHighlightGraphics.fillRoundedRect(
          seat.deskX - 66,
          seat.deskY - 38,
          132,
          112,
          14
        );
        this.deskHighlightGraphics.lineStyle(3, 0xe68a36, 0.9);
        this.deskHighlightGraphics.strokeRoundedRect(
          seat.deskX - 66,
          seat.deskY - 38,
          132,
          112,
          14
        );
      } else if (occupied) {
        // Highlight occupied lounge/conference/fun seat
        this.deskHighlightGraphics.fillStyle(0xe68a36, 0.25);
        this.deskHighlightGraphics.fillCircle(seat.chairX, seat.chairY, 24);
        this.deskHighlightGraphics.lineStyle(2.5, 0xe68a36, 0.9);
        this.deskHighlightGraphics.strokeCircle(seat.chairX, seat.chairY, 24);
      }
    }
  }

  private checkInteractiveObjectsProximity(px: number, py: number): void {
    const distStele = Phaser.Math.Distance.Between(
      px,
      py,
      this.STELE_X,
      this.STELE_Y + 25
    );
    const distCoffee = Phaser.Math.Distance.Between(
      px,
      py,
      this.COFFEE_X,
      this.COFFEE_Y + 35
    );
    const distWhiteboard = Phaser.Math.Distance.Between(
      px,
      py,
      this.WHITEBOARD_X,
      this.WHITEBOARD_Y + 28
    );
    const distFoosball = Phaser.Math.Distance.Between(
      px,
      py,
      this.FOOSBALL_X,
      this.FOOSBALL_Y
    );

    let nextTarget:
      | 'bulletin'
      | 'coffee'
      | 'whiteboard'
      | 'foosball'
      | null = null;
    let promptLabel = '';

    if (distStele < 105) {
      nextTarget = 'bulletin';
      promptLabel = '📌 [E] oder Klick: Digitales Schwarzes Brett öffnen';
    } else if (distCoffee < 105) {
      nextTarget = 'coffee';
      promptLabel =
        '☕ [E] oder Klick: Frischen Siebträger-Espresso ziehen (+Boost)';
    } else if (distWhiteboard < 105) {
      nextTarget = 'whiteboard';
      promptLabel = '🎨 [E] oder Klick: Kollaboratives Team-Whiteboard öffnen';
    } else if (distFoosball < 110) {
      nextTarget = 'foosball';
      promptLabel = '⚽ [E] oder Klick: Runde am Tischkicker spielen!';
    }

    this.stelePromptContainer.setVisible(nextTarget === 'bulletin');
    this.coffeePromptContainer.setVisible(nextTarget === 'coffee');
    this.whiteboardPromptContainer.setVisible(nextTarget === 'whiteboard');
    this.foosballPromptContainer.setVisible(nextTarget === 'foosball');

    if (nextTarget !== this.activeInteractTarget) {
      this.activeInteractTarget = nextTarget;
      this.callbacks.onInteractPromptChange(
        nextTarget ? { type: nextTarget, label: promptLabel } : null
      );
    }
  }

  private playFloatingEmote(visual: AvatarVisual, emoji: string): void {
    const emoteTxt = this.add
      .text(visual.container.x, visual.container.y - 36, emoji, {
        fontSize: '28px',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2500)
      .setScale(0.3);

    this.tweens.add({
      targets: emoteTxt,
      y: visual.container.y - 95,
      scale: { from: 0.4, to: 1.25 },
      alpha: { from: 1, to: 0 },
      duration: 2100,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        emoteTxt.destroy();
      },
    });
  }

  private drawFloorAndZones(): void {
    const floor = this.add.graphics();

    // =========================================================================
    // 0. OUTER TAUNUS NATURE LANDSCAPE (-850..-650 to WORLD_W+1700..WORLD_H+1300)
    // =========================================================================
    floor.fillStyle(0x284e3a, 1);
    floor.fillRect(-850, -650, this.WORLD_W + 1700, this.WORLD_H + 1300);

    // Soft organic meadow clearings & sunlit forest glades around the building
    const glades = [
      { x: -450, y: -320, rx: 320, ry: 180, color: 0x35644a, alpha: 0.65 },
      { x: 520, y: -340, rx: 460, ry: 190, color: 0x3a6b50, alpha: 0.6 },
      { x: 1620, y: -330, rx: 440, ry: 180, color: 0x35644a, alpha: 0.65 },
      { x: 2540, y: 260, rx: 310, ry: 360, color: 0x3a6b50, alpha: 0.6 },
      { x: 2520, y: 1080, rx: 320, ry: 340, color: 0x35644a, alpha: 0.65 },
      { x: -480, y: 380, rx: 310, ry: 380, color: 0x3a6b50, alpha: 0.6 },
      { x: -450, y: 1120, rx: 320, ry: 340, color: 0x35644a, alpha: 0.65 },
      { x: 420, y: 1580, rx: 440, ry: 210, color: 0x3a6b50, alpha: 0.6 },
      { x: 1680, y: 1580, rx: 450, ry: 210, color: 0x3a6b50, alpha: 0.6 },
    ];
    glades.forEach((gl) => {
      floor.fillStyle(gl.color, gl.alpha);
      floor.fillEllipse(gl.x, gl.y, gl.rx * 2, gl.ry * 2);
    });

    // Subtle 64x64 grass lawn checkerboard tiles & wildflower dots in the outer landscape
    for (let gx = -832; gx < this.WORLD_W + 832; gx += 64) {
      for (let gy = -640; gy < this.WORLD_H + 640; gy += 64) {
        const isOutside =
          gx < -16 ||
          gx >= this.WORLD_W + 16 ||
          gy < -16 ||
          gy >= this.WORLD_H + 16;
        if (isOutside && Math.abs((gx / 64 + gy / 64) % 2) === 0) {
          floor.fillStyle(0x2f5a44, 0.48);
          floor.fillRect(gx, gy, 64, 64);

          // Deterministic wildflower dots & grass tufts
          const hash = Math.abs((gx * 37 + gy * 17) % 11);
          if (hash === 1) {
            floor.fillStyle(0xf59e0b, 0.85);
            floor.fillCircle(gx + 18, gy + 24, 2.5);
            floor.fillCircle(gx + 26, gy + 29, 2);
          } else if (hash === 3) {
            floor.fillStyle(0xfdf5ee, 0.85);
            floor.fillCircle(gx + 42, gy + 19, 2.2);
            floor.fillCircle(gx + 36, gy + 25, 1.8);
          } else if (hash === 6) {
            floor.fillStyle(0x38bdf8, 0.8);
            floor.fillCircle(gx + 28, gy + 44, 2.2);
          }
        }
      }
    }

    // Scenic Taunus Forest Pond (North-West "Waldteich") & Southeast Biotope Pond
    // North-West Pond
    floor.fillStyle(0xc8b39b, 0.9);
    floor.fillEllipse(-470, -290, 250, 145);
    floor.fillStyle(0x007a87, 0.95);
    floor.fillEllipse(-470, -290, 224, 122);
    floor.fillStyle(0x00a5b5, 0.75);
    floor.fillEllipse(-465, -294, 175, 90);
    floor.lineStyle(2, 0xebf9fb, 0.55);
    floor.strokeEllipse(-480, -295, 90, 36);
    floor.strokeEllipse(-445, -280, 60, 24);

    // West Winding Creek ("Aar-Bachlauf") flowing from NW Pond southward
    floor.lineStyle(42, 0xc8b39b, 0.85);
    floor.lineBetween(-470, -230, -420, 420);
    floor.lineBetween(-420, 420, -490, 1180);
    floor.lineBetween(-490, 1180, -380, 1780);
    floor.lineStyle(30, 0x007a87, 0.92);
    floor.lineBetween(-470, -230, -420, 420);
    floor.lineBetween(-420, 420, -490, 1180);
    floor.lineBetween(-490, 1180, -380, 1780);
    floor.lineStyle(14, 0x00a5b5, 0.75);
    floor.lineBetween(-470, -230, -420, 420);
    floor.lineBetween(-420, 420, -490, 1180);
    floor.lineBetween(-490, 1180, -380, 1780);

    // South-East Biotope Pond
    floor.fillStyle(0xc8b39b, 0.9);
    floor.fillEllipse(2530, 1510, 230, 135);
    floor.fillStyle(0x007a87, 0.95);
    floor.fillEllipse(2530, 1510, 204, 114);
    floor.fillStyle(0x00a5b5, 0.75);
    floor.fillEllipse(2525, 1506, 155, 82);
    floor.lineStyle(2, 0xebf9fb, 0.55);
    floor.strokeEllipse(2520, 1506, 80, 30);

    // =========================================================================
    // TAUNUS-RUNDWANDERWEG (MAIN GRAVEL HIKING LOOP + BRANCHING FOOTPATHS)
    // =========================================================================
    const drawHikingPath = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      width: number
    ) => {
      floor.lineStyle(width + 8, 0x8c7358, 0.85);
      floor.lineBetween(x1, y1, x2, y2);
      floor.lineStyle(width, 0xd8c3a8, 0.96);
      floor.lineBetween(x1, y1, x2, y2);
      floor.lineStyle(Math.max(4, width * 0.35), 0xeadbc8, 0.55);
      floor.lineBetween(x1, y1, x2, y2);
    };

    // Main Loop Trail around the Campus:
    // North Trail (y = -185, x = -220..2320)
    drawHikingPath(-220, -185, 2320, -185, 36);
    // East Trail (x = 2320, y = -185..1445)
    drawHikingPath(2320, -185, 2320, 1445, 36);
    // South Trail (y = 1445, x = -220..2320)
    drawHikingPath(-220, 1445, 2320, 1445, 36);
    // West Trail (x = -220, y = -185..1445)
    drawHikingPath(-220, -185, -220, 1445, 36);

    // Rounded Path Corners for the Main Loop
    [
      { x: -220, y: -185 },
      { x: 2320, y: -185 },
      { x: 2320, y: 1445 },
      { x: -220, y: 1445 },
    ].forEach((pt) => {
      floor.fillStyle(0x8c7358, 0.9);
      floor.fillCircle(pt.x, pt.y, 23);
      floor.fillStyle(0xd8c3a8, 1);
      floor.fillCircle(pt.x, pt.y, 19);
    });

    // Smaller Branching Footpaths ("kleine Pfade"):
    // 1. North Feldberg Panorama Ridge Path (y = -410, x = -120..2220) with connectors
    drawHikingPath(340, -185, 340, -410, 24);
    drawHikingPath(340, -410, 1760, -410, 24);
    drawHikingPath(1760, -410, 1760, -185, 24);

    // 2. West Creek Footpath crossing the Aar-Bachlauf via Wooden Bridge to West Meadow
    drawHikingPath(-220, 560, -640, 560, 24);
    drawHikingPath(-640, 120, -640, 1040, 24);
    drawHikingPath(-640, 1040, -220, 1040, 24);

    // Wooden Footbridges ("Holzbrücken") over the West Creek at y = 560 and y = 1040
    [
      { bx: -435, by: 560 },
      { bx: -475, by: 1040 },
    ].forEach((br) => {
      floor.fillStyle(0x583118, 1);
      floor.fillRoundedRect(br.bx - 34, br.by - 20, 68, 40, 4);
      floor.fillStyle(0xb86518, 1);
      floor.fillRoundedRect(br.bx - 30, br.by - 16, 60, 32, 3);
      floor.lineStyle(2, 0x583118, 0.9);
      for (let px = br.bx - 24; px <= br.bx + 24; px += 8) {
        floor.lineBetween(px, br.by - 15, px, br.by + 15);
      }
      // Wooden bridge handrails
      floor.fillStyle(0xe68a36, 1);
      floor.fillRect(br.bx - 32, br.by - 19, 64, 4);
      floor.fillRect(br.bx - 32, br.by + 15, 64, 4);
    });

    // 3. East Woodland Loop Path (x = 2320..2680)
    drawHikingPath(2320, 260, 2660, 260, 24);
    drawHikingPath(2660, 260, 2660, 980, 24);
    drawHikingPath(2660, 980, 2320, 980, 24);

    // 4. South Meadow Stroll Path (y = 1445..1670)
    drawHikingPath(420, 1445, 420, 1665, 24);
    drawHikingPath(420, 1665, 1680, 1665, 24);
    drawHikingPath(1680, 1665, 1680, 1445, 24);

    // Paved Stone Promenade Path leading from South Trail into the Main Entrance
    floor.fillStyle(0x4b6f77, 1);
    floor.fillRoundedRect(900, this.WORLD_H - 10, 300, 205, 8);
    floor.lineStyle(2, 0x334e54, 0.9);
    for (let py = this.WORLD_H + 10; py < this.WORLD_H + 190; py += 28) {
      floor.lineBetween(905, py, 1195, py);
    }

    // Outer Building Drop Shadow & Stone Foundation Curb
    floor.fillStyle(0x091f24, 0.65);
    floor.fillRoundedRect(-14, -10, this.WORLD_W + 34, this.WORLD_H + 34, 22);
    floor.fillStyle(0x334e54, 1);
    floor.fillRoundedRect(-6, -6, this.WORLD_W + 12, this.WORLD_H + 12, 18);

    // Base building interior subfloor (#F4F5F6)
    floor.fillStyle(0xf4f5f6, 1);
    floor.fillRoundedRect(0, 0, this.WORLD_W, this.WORLD_H, 16);

    // =========================================================================
    // TOP ROW (NORTH WING: y 24..610)
    // =========================================================================

    // ROOM 1: Großraum-Coworking I (Fokus) (x: 24..690, y: 24..610) - Checkerboard Carpet Tiles
    floor.fillStyle(0xf2f7f4, 1);
    floor.fillRoundedRect(24, 24, 666, 586, 12);
    for (let tx = 28; tx < 684; tx += 32) {
      for (let ty = 28; ty < 604; ty += 32) {
        if (((tx - 28) / 32 + (ty - 28) / 32) % 2 === 0) {
          floor.fillStyle(0x8eae9d, 0.11);
          floor.fillRect(tx, ty, 32, 32);
        }
      }
    }
    floor.lineStyle(2.5, 0x8eae9d, 0.7);
    floor.strokeRoundedRect(24, 24, 666, 586, 12);
    // Woven Acoustic Desk Island Rugs with stitched trim
    [135, 350].forEach((rugY) => {
      floor.fillStyle(0x5f7f6e, 0.16);
      floor.fillRoundedRect(56, rugY, 604, 152, 14);
      floor.lineStyle(2, 0x5f7f6e, 0.45);
      floor.strokeRoundedRect(56, rugY, 604, 152, 14);
    });

    // ROOM 2: Schreibtisch-Raum II (Team- & Projekt-Studio) (x: 706..1390, y: 24..610) - Cyan/Slate Carpet Tiles
    floor.fillStyle(0xebf9fb, 0.75);
    floor.fillRoundedRect(706, 24, 684, 586, 12);
    for (let tx = 710; tx < 1384; tx += 32) {
      for (let ty = 28; ty < 604; ty += 32) {
        if (((tx - 710) / 32 + (ty - 28) / 32) % 2 === 0) {
          floor.fillStyle(0x00a5b5, 0.065);
          floor.fillRect(tx, ty, 32, 32);
        }
      }
    }
    floor.lineStyle(2.5, 0x00a5b5, 0.6);
    floor.strokeRoundedRect(706, 24, 684, 586, 12);
    [135, 350].forEach((rugY) => {
      floor.fillStyle(0x00a5b5, 0.12);
      floor.fillRoundedRect(742, rugY, 610, 152, 14);
      floor.lineStyle(2, 0x007a87, 0.4);
      floor.strokeRoundedRect(742, rugY, 610, 152, 14);
    });

    // ROOM 3: Kaffeeküche & Barista-Lounge (x: 1406..2076, y: 24..610) - Warm Wood Parquet Planks
    floor.fillStyle(0xfdf5ee, 1);
    floor.fillRoundedRect(1406, 24, 670, 586, 12);
    floor.lineStyle(1, 0xe68a36, 0.25);
    let rowIdx = 0;
    for (let py = 28; py < 606; py += 20) {
      floor.lineBetween(1408, py, 2074, py);
      const offset = (rowIdx % 2) * 44;
      for (let px = 1408 + offset; px < 2070; px += 88) {
        floor.lineBetween(px, py, px, Math.min(py + 20, 606));
      }
      rowIdx++;
    }
    floor.lineStyle(2.5, 0xe68a36, 0.7);
    floor.strokeRoundedRect(1406, 24, 670, 586, 12);
    // Cozy Woven Lounge Carpet under Coffee Tables
    floor.fillStyle(0xe68a36, 0.16);
    floor.fillRoundedRect(1460, 210, 560, 350, 20);
    floor.lineStyle(2.5, 0xb86518, 0.45);
    floor.strokeRoundedRect(1466, 216, 548, 338, 16);

    // =========================================================================
    // BOTTOM ROW (SOUTH WING: y 626..1236)
    // =========================================================================

    // ROOM 4: Fun-im-Office Raum (Arcade, Kicker & Chill) (x: 24..690, y: 626..1236)
    floor.fillStyle(0xf0f4f5, 1);
    floor.fillRoundedRect(24, 626, 666, 610, 12);
    for (let tx = 28; tx < 684; tx += 32) {
      for (let ty = 630; ty < 1230; ty += 32) {
        if (((tx - 28) / 32 + (ty - 630) / 32) % 2 === 0) {
          floor.fillStyle(0x4b6f77, 0.07);
          floor.fillRect(tx, ty, 32, 32);
        }
      }
    }
    floor.lineStyle(2.5, 0x00a5b5, 0.65);
    floor.strokeRoundedRect(24, 626, 666, 610, 12);
    // Foosball Arena Turf Mat & Chill Beanbag Carpet
    floor.fillStyle(0x174955, 0.11);
    floor.fillRoundedRect(60, 720, 590, 240, 18);
    floor.lineStyle(2, 0x00a5b5, 0.45);
    floor.strokeRoundedRect(60, 720, 590, 240, 18);
    floor.fillStyle(0xe68a36, 0.15);
    floor.fillRoundedRect(60, 985, 590, 210, 18);
    floor.lineStyle(2, 0xe68a36, 0.45);
    floor.strokeRoundedRect(60, 985, 590, 210, 18);

    // ROOM 5: Zentrale Eingangshalle & Schwarzes Brett (x: 706..1390, y: 626..1236) - Terrazzo Stone Tiles
    floor.fillStyle(0xedf5f7, 1);
    floor.fillRoundedRect(706, 626, 684, 610, 12);
    floor.lineStyle(1, 0x4b6f77, 0.18);
    for (let gx = 710; gx < 1388; gx += 48) {
      floor.lineBetween(gx, 628, gx, 1234);
    }
    for (let gy = 630; gy < 1234; gy += 48) {
      floor.lineBetween(708, gy, 1388, gy);
    }
    floor.lineStyle(2.5, 0x4b6f77, 0.6);
    floor.strokeRoundedRect(706, 626, 684, 610, 12);

    // Decorative Taunus Compass Medallion in Center of Lobby
    floor.fillStyle(0x174955, 0.08);
    floor.fillCircle(1050, 960, 72);
    floor.lineStyle(2, 0x00a5b5, 0.35);
    floor.strokeCircle(1050, 960, 72);
    floor.strokeCircle(1050, 960, 52);

    // Welcome Entrance Badge at Central South Entrance (Light Apple-Glass Menu Design)
    floor.fillStyle(0x0f323a, 0.16);
    floor.fillRoundedRect(904, 1174, 292, 46, 18);
    floor.fillStyle(0xf4f7f8, 0.96);
    floor.fillRoundedRect(906, 1170, 288, 44, 16);
    floor.lineStyle(3.5, 0xffffff, 0.98);
    floor.strokeRoundedRect(906, 1170, 288, 44, 16);
    floor.lineStyle(1.5, 0x174955, 0.28);
    floor.strokeRoundedRect(905, 1169, 290, 46, 17);

    // ROOM 6: Konferenzsaal I „Feldberg“ (x: 1406..1735, y: 626..1236) - Berry Acoustic Carpet
    floor.fillStyle(0xfbf0f4, 1);
    floor.fillRoundedRect(1406, 626, 329, 610, 12);
    for (let tx = 1410; tx < 1730; tx += 32) {
      for (let ty = 630; ty < 1230; ty += 32) {
        if (((tx - 1410) / 32 + (ty - 630) / 32) % 2 === 0) {
          floor.fillStyle(0x7e1946, 0.055);
          floor.fillRect(tx, ty, 32, 32);
        }
      }
    }
    floor.lineStyle(3, 0x7e1946, 0.8);
    floor.strokeRoundedRect(1406, 626, 329, 610, 12);
    floor.fillStyle(0x7e1946, 0.15);
    floor.fillRoundedRect(1435, 790, 270, 340, 16);
    floor.lineStyle(2, 0x580e30, 0.45);
    floor.strokeRoundedRect(1435, 790, 270, 340, 16);

    // ROOM 7: 2. Konferenzraum „Networking-Arena“ (x: 1751..2076, y: 626..1236) - Warm Parquet & Circular Rug
    floor.fillStyle(0xfdf5ee, 1);
    floor.fillRoundedRect(1751, 626, 325, 610, 12);
    floor.lineStyle(1, 0xe68a36, 0.22);
    for (let py = 632; py < 1232; py += 20) {
      floor.lineBetween(1753, py, 2074, py);
    }
    floor.lineStyle(3, 0xe68a36, 0.85);
    floor.strokeRoundedRect(1751, 626, 325, 610, 12);
    // Networking circular arena carpet
    floor.fillStyle(0x00a5b5, 0.14);
    floor.fillCircle(1914, 915, 135);
    floor.lineStyle(2.5, 0x00a5b5, 0.55);
    floor.strokeCircle(1914, 915, 135);
    floor.lineStyle(1.5, 0xe68a36, 0.55);
    floor.strokeCircle(1914, 915, 118);

    // Room Header Labels
    this.createZoneLabel(
      44,
      44,
      '🌿 COWORKING I: FOKUS-RAUM',
      'Klick auf Tisch/Stuhl = Hinsetzen & Schreibtischlampe leuchtet!',
      '#5F7F6E',
      '#F2F7F4'
    );
    this.createZoneLabel(
      726,
      44,
      '💻 COWORKING II: TEAM- & PROJEKT-STUDIO',
      '8 weitere 2.5D-Schreibtische • Klick zum Hinsetzen',
      '#007A87',
      '#EBF9FB'
    );
    this.createZoneLabel(
      1426,
      44,
      '☕ KAFFEEKÜCHE & BARISTA-LOUNGE',
      'Siebträger-Espresso [E] • Echtholz-Parkett & Sitzgruppen',
      '#B86518',
      '#FDF5EE'
    );
    this.createZoneLabel(
      44,
      646,
      '🎮 FUN-IM-OFFICE RAUM',
      'Tischkicker [E] • Retro-Arcade • Sitzsack-Lounge',
      '#007A87',
      '#EBF9FB'
    );
    this.createZoneLabel(
      726,
      646,
      '🏛️ EINGANGSHALLE & INFOPUNKT',
      'Digitales Schwarzes Brett [E] • Empfang',
      '#174955',
      '#EDF5F7'
    );
    this.createZoneLabel(
      1420,
      646,
      '🔴 KONFERENZSAAL I „FELDBERG“',
      'Auto-Video & Whiteboard [E]',
      '#7E1946',
      '#FBF0F4'
    );
    this.createZoneLabel(
      1765,
      646,
      '🤝 2. KONFERENZRAUM „NETWORKING“',
      'B2B-Speed-Networking & Pitches',
      '#B86518',
      '#FDF5EE'
    );

    this.add
      .text(1050, 1192, '🏛️ HAUPTEINGANG • UNTERTAUNUS BUSINESS HUB', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#174955',
      })
      .setOrigin(0.5, 0.5);
  }

  private createZoneLabel(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    accentHex: string,
    bgHex: string
  ): void {
    const t1 = this.add.text(x, y, title, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: accentHex,
      backgroundColor: bgHex,
      padding: { x: 8, y: 4 },
    });
    this.add.text(x, y + t1.height + 3, subtitle, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '11px',
      color: '#4B6F77',
    });
  }

  private buildArchitectureAndFurniture(): void {
    this.seats = [];

    // Outer perimeter walls (uniform frame on all 4 sides)
    this.addWallBlock(this.WORLD_W / 2, 12, this.WORLD_W - 20, 22, 0x174955, true);
    this.addWallBlock(this.WORLD_W / 2, this.WORLD_H - 12, this.WORLD_W - 20, 22, 0x174955, true);
    this.addWallBlock(12, this.WORLD_H / 2, 22, this.WORLD_H - 20, 0x174955, true);
    this.addWallBlock(this.WORLD_W - 12, this.WORLD_H / 2, 22, this.WORLD_H - 20, 0x174955, true);

    // Horizontal middle wall (y = 618) with wide doorways into every room
    this.addWallBlock(160, 618, 250, 14, 0x4b6f77, true);
    this.addWallBlock(565, 618, 240, 14, 0x4b6f77, true);
    this.addWallBlock(845, 618, 240, 14, 0x4b6f77, true);
    this.addWallBlock(1255, 618, 250, 14, 0x4b6f77, true);
    this.addWallBlock(1510, 618, 160, 14, 0x7e1946, true);
    this.addWallBlock(1830, 618, 150, 14, 0xe68a36, true);

    // Vertical wall between Col 1 and Col 2 (x = 698) with open doorways
    this.addWallBlock(698, 175, 14, 240, 0x4b6f77, true);
    this.addWallBlock(698, 520, 14, 180, 0x4b6f77, true);
    this.addWallBlock(698, 760, 14, 240, 0x4b6f77, true);
    this.addWallBlock(698, 1120, 14, 220, 0x4b6f77, true);

    // Vertical wall between Col 2 and Col 3 (x = 1398) with open doorways
    this.addWallBlock(1398, 175, 14, 240, 0x4b6f77, true);
    this.addWallBlock(1398, 520, 14, 180, 0x4b6f77, true);
    this.addWallBlock(1398, 750, 14, 210, 0x7e1946, true);
    this.addWallBlock(1398, 1120, 14, 210, 0x7e1946, true);

    // Vertical glass divider between Conference I (Feldberg) and Conference II (Networking) (x = 1743)
    this.addWallBlock(1743, 750, 12, 220, 0x7e1946, true);
    this.addWallBlock(1743, 1120, 12, 210, 0xe68a36, true);

    // =========================================================================
    // ROOM 1: COWORKING I (FOKUS) - 8 Interactive Color-Changing Desks
    // =========================================================================
    const focusDesks = [
      { id: 'F1', x: 135, y: 190 },
      { id: 'F2', x: 310, y: 190 },
      { id: 'F3', x: 485, y: 190 },
      { id: 'F4', x: 615, y: 190 },
      { id: 'F5', x: 135, y: 405 },
      { id: 'F6', x: 310, y: 405 },
      { id: 'F7', x: 485, y: 405 },
      { id: 'F8', x: 615, y: 405 },
    ];
    focusDesks.forEach((d) => {
      this.createInteractiveDeskWithSeat(
        `desk-${d.id}`,
        `Fokus-Tisch ${d.id}`,
        d.x,
        d.y
      );
    });

    // =========================================================================
    // ROOM 2: SCHREIBTISCH-RAUM II (TEAM-STUDIO) - 8 Interactive Desks
    // =========================================================================
    const studioDesks = [
      { id: 'S1', x: 805, y: 190 },
      { id: 'S2', x: 960, y: 190 },
      { id: 'S3', x: 1125, y: 190 },
      { id: 'S4', x: 1285, y: 190 },
      { id: 'S5', x: 805, y: 405 },
      { id: 'S6', x: 960, y: 405 },
      { id: 'S7', x: 1125, y: 405 },
      { id: 'S8', x: 1285, y: 405 },
    ];
    studioDesks.forEach((d) => {
      this.createInteractiveDeskWithSeat(
        `desk-${d.id}`,
        `Studio-Tisch ${d.id}`,
        d.x,
        d.y
      );
    });

    // =========================================================================
    // ROOM 3: KAFFEEKÜCHE & BARISTA-LOUNGE
    // =========================================================================
    const counter = this.obstacles.create(
      this.COFFEE_X,
      this.COFFEE_Y,
      'coffee-counter'
    );
    counter.setDepth(115);
    counter.body.setSize(172, 38);
    counter.body.setOffset(7, 8);
    counter.setInteractive({ useHandCursor: true });
    counter.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
      this.grabFreshEspresso();
    });

    this.add
      .text(this.COFFEE_X, this.COFFEE_Y - 38, '☕ SIEBTRÄGER-BAR [E]', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        backgroundColor: '#E68A36',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(140);

    this.coffeePromptContainer = this.createWorldPromptBadge(
      this.COFFEE_X,
      this.COFFEE_Y + 48,
      '☕ [E] oder Klick: Frischer Espresso (+Boost)',
      0xe68a36
    );

    const loungeTables = [
      { id: 'L1', x: 1560, y: 280 },
      { id: 'L2', x: 1880, y: 280 },
      { id: 'L3', x: 1560, y: 465 },
      { id: 'L4', x: 1880, y: 465 },
    ];
    loungeTables.forEach((t) => {
      const sLeft = this.registerClickableSeat(
        `lounge-${t.id}-l`,
        `Lounge-Platz ${t.id}`,
        t.x - 46,
        t.y,
        'stool-lounge'
      );
      this.registerClickableSeat(
        `lounge-${t.id}-r`,
        `Lounge-Platz ${t.id}`,
        t.x + 46,
        t.y,
        'stool-lounge'
      );
      this.registerClickableSeat(
        `lounge-${t.id}-b`,
        `Lounge-Platz ${t.id}`,
        t.x,
        t.y + 46,
        'stool-lounge'
      );

      const tbl = this.obstacles.create(t.x, t.y, 'table-lounge');
      tbl.setDepth(t.y + 10);
      tbl.body.setSize(54, 54);
      tbl.body.setOffset(10, 10);
      tbl.setInteractive({ useHandCursor: true });
      tbl.on('pointerup', (pointer: Phaser.Input.Pointer) =>
        this.handleSeatOrDeskClick(sLeft, pointer)
      );
    });

    // =========================================================================
    // ROOM 4: FUN-IM-OFFICE RAUM (TISCHKICKER, ARCADE & SITZSÄCKE)
    // =========================================================================
    const foosball1 = this.obstacles.create(
      this.FOOSBALL_X,
      this.FOOSBALL_Y,
      'foosball-table'
    );
    foosball1.setDepth(this.FOOSBALL_Y + 10);
    foosball1.body.setSize(114, 54);
    foosball1.body.setOffset(8, 10);
    foosball1.setInteractive({ useHandCursor: true });
    foosball1.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
      this.playFoosballMatch();
    });

    this.add
      .text(
        this.FOOSBALL_X,
        this.FOOSBALL_Y - 48,
        '⚽ TAUNUS-TISCHKICKER [E]',
        {
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#FFFFFF',
          backgroundColor: '#5F7F6E',
          padding: { x: 7, y: 3 },
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(this.FOOSBALL_Y + 25);

    this.foosballPromptContainer = this.createWorldPromptBadge(
      this.FOOSBALL_X,
      this.FOOSBALL_Y + 54,
      '⚽ [E] oder Klick: Kicker-Match spielen!',
      0x5f7f6e
    );

    const foosball2 = this.obstacles.create(490, 820, 'foosball-table');
    foosball2.setDepth(830);
    foosball2.body.setSize(114, 54);
    foosball2.body.setOffset(8, 10);
    foosball2.setInteractive({ useHandCursor: true });
    foosball2.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
      this.playFoosballMatch();
    });

    // Retro Arcade Machines along top of Fun Room
    [130, 210, 560].forEach((ax, i) => {
      const arc = this.obstacles.create(ax, 715, 'arcade-machine');
      arc.setDepth(725);
      arc.body.setSize(48, 38);
      arc.body.setOffset(6, 8);
      arc.setInteractive({ useHandCursor: true });
      arc.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
        this.triggerLocalEmote('🎉');
        this.showLocalSpeechBubble(
          `🕹️ Neuer Highscore am Taunus-Arcade #${i + 1}!`
        );
      });
    });

    // Cozy Beanbag Seats (Sitzsäcke) in Fun Room - Clickable to sit!
    const beanbags = [
      { id: 'B1', x: 140, y: 1050 },
      { id: 'B2', x: 230, y: 1090 },
      { id: 'B3', x: 320, y: 1050 },
      { id: 'B4', x: 450, y: 1050 },
      { id: 'B5', x: 540, y: 1090 },
      { id: 'B6', x: 610, y: 1045 },
    ];
    beanbags.forEach((b) => {
      this.registerClickableSeat(
        `beanbag-${b.id}`,
        `Chill-Sitzsack ${b.id}`,
        b.x,
        b.y,
        'beanbag-seat'
      );
    });

    // =========================================================================
    // ROOM 5: ZENTRALE EINGANGSHALLE & SCHWARZES BRETT
    // =========================================================================
    const stele = this.obstacles.create(
      this.STELE_X,
      this.STELE_Y,
      'schwarzes-brett-stele'
    );
    stele.setDepth(this.STELE_Y + 10);
    stele.body.setSize(78, 40);
    stele.body.setOffset(9, 12);
    stele.setInteractive({ useHandCursor: true });
    stele.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
      setTimeout(() => this.callbacks.onOpenBulletinBoard(), 20);
    });

    this.add
      .text(this.STELE_X, this.STELE_Y - 40, '📌 SCHWARZES BRETT [E]', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        backgroundColor: '#00A5B5',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(this.STELE_Y + 30);

    this.stelePromptContainer = this.createWorldPromptBadge(
      this.STELE_X,
      this.STELE_Y + 52,
      '⚡ [E] oder Klick: Schwarzes Brett',
      0x00a5b5
    );

    // Waiting Lounge Table & Seats in Lobby
    const lobbySeat = this.registerClickableSeat(
      'lobby-seat-1',
      'Empfangs-Lounge',
      1165,
      820,
      'stool-lounge'
    );
    this.registerClickableSeat(
      'lobby-seat-2',
      'Empfangs-Lounge',
      1255,
      820,
      'stool-lounge'
    );
    const lobbyTable = this.obstacles.create(1210, 820, 'table-lounge');
    lobbyTable.setDepth(830);
    lobbyTable.body.setSize(54, 54);
    lobbyTable.body.setOffset(10, 10);
    lobbyTable.setInteractive({ useHandCursor: true });
    lobbyTable.on('pointerup', (pointer: Phaser.Input.Pointer) =>
      this.handleSeatOrDeskClick(lobbySeat, pointer)
    );

    // =========================================================================
    // ROOM 6: KONFERENZSAAL I „FELDBERG“
    // =========================================================================
    const whiteboard = this.obstacles.create(
      this.WHITEBOARD_X,
      this.WHITEBOARD_Y,
      'whiteboard-easel'
    );
    whiteboard.setDepth(this.WHITEBOARD_Y + 10);
    whiteboard.body.setSize(102, 34);
    whiteboard.body.setOffset(10, 12);
    whiteboard.setInteractive({ useHandCursor: true });
    whiteboard.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
      setTimeout(() => this.callbacks.onOpenWhiteboard(), 20);
    });

    this.add
      .text(
        this.WHITEBOARD_X,
        this.WHITEBOARD_Y - 34,
        '🎨 TEAM-WHITEBOARD [E]',
        {
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#FFFFFF',
          backgroundColor: '#7E1946',
          padding: { x: 7, y: 3 },
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(this.WHITEBOARD_Y + 25);

    this.whiteboardPromptContainer = this.createWorldPromptBadge(
      this.WHITEBOARD_X,
      this.WHITEBOARD_Y + 44,
      '🎨 [E] oder Klick: Team-Whiteboard öffnen',
      0x7e1946
    );

    const confX = 1570;
    const confY = 955;
    let firstConfSeat: SeatInstance | null = null;
    [-62, 0, 62].forEach((offsetX, i) => {
      const topSeat = this.registerClickableSeat(
        `conf1-top-${i}`,
        `Konferenzsaal I Platz ${i + 1}`,
        confX + offsetX,
        confY - 62,
        'chair-office'
      );
      if (!firstConfSeat) firstConfSeat = topSeat;
      this.registerClickableSeat(
        `conf1-bot-${i}`,
        `Konferenzsaal I Platz ${i + 4}`,
        confX + offsetX,
        confY + 62,
        'chair-office'
      );
    });

    const confTable = this.obstacles.create(confX, confY, 'conference-table');
    confTable.setDepth(confY + 10);
    confTable.body.setSize(184, 72);
    confTable.body.setOffset(12, 12);
    confTable.setInteractive({ useHandCursor: true });
    confTable.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (firstConfSeat) this.handleSeatOrDeskClick(firstConfSeat, pointer);
    });

    // =========================================================================
    // ROOM 7: 2. KONFERENZRAUM „NETWORKING-ARENA“
    // =========================================================================
    const netX = 1914;
    const netY = 915;
    const netAngles = [0, 60, 120, 180, 240, 300];
    let firstNetSeat: SeatInstance | null = null;
    netAngles.forEach((deg, idx) => {
      const rad = Phaser.Math.DegToRad(deg);
      const sx = Math.round(netX + Math.cos(rad) * 88);
      const sy = Math.round(netY + Math.sin(rad) * 88);
      const s = this.registerClickableSeat(
        `net-seat-${idx}`,
        `Networking-Runde Platz ${idx + 1}`,
        sx,
        sy,
        'chair-office'
      );
      if (!firstNetSeat) firstNetSeat = s;
    });

    const netTable = this.obstacles.create(netX, netY, 'networking-table');
    netTable.setDepth(netY + 10);
    netTable.body.setSize(110, 110);
    netTable.body.setOffset(17, 17);
    netTable.setInteractive({ useHandCursor: true });
    netTable.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (firstNetSeat) this.handleSeatOrDeskClick(firstNetSeat, pointer);
    });

    this.add
      .text(netX, netY - 122, '🤝 SPEED-NETWORKING TISCH (Klick zum Hinsetzen)', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        backgroundColor: '#E68A36',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(netY + 30);

    // Decorative Indoor Plants across all 7 rooms
    const plantCoords = [
      { x: 55, y: 105 },
      { x: 660, y: 105 },
      { x: 740, y: 105 },
      { x: 1360, y: 105 },
      { x: 1435, y: 105 },
      { x: 2040, y: 105 },
      { x: 55, y: 1195 },
      { x: 660, y: 1195 },
      { x: 745, y: 1195 },
      { x: 1355, y: 1195 },
      { x: 2040, y: 1195 },
    ];
    plantCoords.forEach((p) => {
      const plant = this.obstacles.create(p.x, p.y, 'plant-pot');
      plant.setDepth(p.y + 10);
      plant.body.setSize(26, 26);
      plant.body.setOffset(8, 8);
    });

    // Build surrounding Taunus forest, shrubs, rocks, benches, hikers & wildlife
    this.buildOutdoorTaunusLandscape();
  }

  /**
   * Populates the surrounding Taunus nature park outside the building perimeter (0..WORLD_W, 0..WORLD_H)
   * with deciduous trees, pine trees, berry & flower bushes, quartzite rocks, trail benches, signposts,
   * animated hikers on the footpaths, and roaming forest wildlife (deer, foxes, rabbits).
   */
  private buildOutdoorTaunusLandscape(): void {
    this.outdoorWalkers.forEach((w) => w.container.destroy());
    this.outdoorWalkers = [];

    // 1. Deciduous Taunus Trees ('tree-taunus') & Conifer Pines ('tree-pine')
    const treePlacements: Array<{
      x: number;
      y: number;
      type: 'tree-taunus' | 'tree-pine';
      scale: number;
    }> = [
      // North Forest & Ridge (above y = 0, avoiding y = -185 and y = -410 paths)
      { x: -680, y: -480, type: 'tree-pine', scale: 1.15 },
      { x: -580, y: -440, type: 'tree-taunus', scale: 1.05 },
      { x: -320, y: -470, type: 'tree-pine', scale: 1.1 },
      { x: -140, y: -320, type: 'tree-taunus', scale: 1.0 },
      { x: -60, y: -490, type: 'tree-pine', scale: 1.18 },
      { x: 90, y: -300, type: 'tree-taunus', scale: 0.96 },
      { x: 210, y: -495, type: 'tree-pine', scale: 1.12 },
      { x: 470, y: -300, type: 'tree-pine', scale: 0.95 },
      { x: 640, y: -510, type: 'tree-taunus', scale: 1.15 },
      { x: 780, y: -295, type: 'tree-taunus', scale: 1.04 },
      { x: 960, y: -515, type: 'tree-pine', scale: 1.2 },
      { x: 1140, y: -300, type: 'tree-pine', scale: 1.0 },
      { x: 1320, y: -510, type: 'tree-taunus', scale: 1.1 },
      { x: 1490, y: -295, type: 'tree-taunus', scale: 0.98 },
      { x: 1640, y: -515, type: 'tree-pine', scale: 1.16 },
      { x: 1910, y: -310, type: 'tree-taunus', scale: 1.08 },
      { x: 2080, y: -490, type: 'tree-pine', scale: 1.14 },
      { x: 2240, y: -320, type: 'tree-taunus', scale: 1.02 },
      { x: 2480, y: -450, type: 'tree-pine', scale: 1.18 },
      { x: 2640, y: -340, type: 'tree-taunus', scale: 1.06 },
      // Inner North Green Strip (between building y = 0 and North Trail y = -185)
      { x: 120, y: -85, type: 'tree-taunus', scale: 0.9 },
      { x: 520, y: -90, type: 'tree-pine', scale: 0.92 },
      { x: 980, y: -85, type: 'tree-taunus', scale: 0.9 },
      { x: 1520, y: -90, type: 'tree-pine', scale: 0.92 },
      { x: 1960, y: -85, type: 'tree-taunus', scale: 0.9 },

      // West Creek & Forest (x < 0, avoiding x = -220 and x = -640 paths)
      { x: -105, y: 110, type: 'tree-taunus', scale: 0.94 },
      { x: -110, y: 420, type: 'tree-pine', scale: 0.96 },
      { x: -105, y: 820, type: 'tree-taunus', scale: 0.94 },
      { x: -110, y: 1140, type: 'tree-pine', scale: 0.96 },
      { x: -340, y: -60, type: 'tree-pine', scale: 1.08 },
      { x: -330, y: 220, type: 'tree-taunus', scale: 1.04 },
      { x: -530, y: 310, type: 'tree-pine', scale: 1.12 },
      { x: -350, y: 740, type: 'tree-taunus', scale: 1.05 },
      { x: -550, y: 830, type: 'tree-pine', scale: 1.1 },
      { x: -340, y: 1260, type: 'tree-taunus', scale: 1.06 },
      { x: -750, y: 80, type: 'tree-pine', scale: 1.18 },
      { x: -760, y: 440, type: 'tree-taunus', scale: 1.12 },
      { x: -740, y: 780, type: 'tree-pine', scale: 1.15 },
      { x: -750, y: 1160, type: 'tree-taunus', scale: 1.1 },

      // East Woodland (x > 2100, avoiding x = 2320 and x = 2660 paths)
      { x: 2205, y: 120, type: 'tree-taunus', scale: 0.94 },
      { x: 2210, y: 480, type: 'tree-pine', scale: 0.96 },
      { x: 2205, y: 840, type: 'tree-taunus', scale: 0.94 },
      { x: 2210, y: 1160, type: 'tree-pine', scale: 0.96 },
      { x: 2470, y: 90, type: 'tree-pine', scale: 1.1 },
      { x: 2480, y: 440, type: 'tree-taunus', scale: 1.06 },
      { x: 2510, y: 680, type: 'tree-pine', scale: 1.12 },
      { x: 2470, y: 1150, type: 'tree-taunus', scale: 1.08 },
      { x: 2790, y: 140, type: 'tree-pine', scale: 1.2 },
      { x: 2810, y: 520, type: 'tree-taunus', scale: 1.14 },
      { x: 2790, y: 890, type: 'tree-pine', scale: 1.16 },
      { x: 2800, y: 1280, type: 'tree-taunus', scale: 1.12 },

      // South Park & Meadows (y > 1260, avoiding y = 1445 and y = 1665 paths & entrance x: 900..1200)
      { x: 140, y: 1340, type: 'tree-taunus', scale: 0.94 },
      { x: 560, y: 1345, type: 'tree-pine', scale: 0.95 },
      { x: 780, y: 1340, type: 'tree-taunus', scale: 0.92 },
      { x: 1320, y: 1340, type: 'tree-taunus', scale: 0.92 },
      { x: 1580, y: 1345, type: 'tree-pine', scale: 0.95 },
      { x: 1960, y: 1340, type: 'tree-taunus', scale: 0.94 },
      { x: -120, y: 1580, type: 'tree-pine', scale: 1.12 },
      { x: 180, y: 1560, type: 'tree-taunus', scale: 1.08 },
      { x: 640, y: 1555, type: 'tree-pine', scale: 1.04 },
      { x: 880, y: 1560, type: 'tree-taunus', scale: 1.02 },
      { x: 1240, y: 1560, type: 'tree-taunus', scale: 1.02 },
      { x: 1480, y: 1555, type: 'tree-pine', scale: 1.05 },
      { x: 1920, y: 1565, type: 'tree-taunus', scale: 1.08 },
      { x: 2180, y: 1580, type: 'tree-pine', scale: 1.14 },
      { x: 280, y: 1785, type: 'tree-pine', scale: 1.16 },
      { x: 760, y: 1790, type: 'tree-taunus', scale: 1.12 },
      { x: 1050, y: 1800, type: 'tree-pine', scale: 1.18 },
      { x: 1380, y: 1790, type: 'tree-taunus', scale: 1.12 },
      { x: 1840, y: 1785, type: 'tree-pine', scale: 1.16 },
    ];

    treePlacements.forEach((t) => {
      this.add
        .image(t.x, t.y, t.type)
        .setScale(t.scale)
        .setDepth(t.y + 18);
    });

    // 2. Shrubs & Flowering Bushes ('bush-taunus' & 'bush-flower') + Rocks ('rock-taunus')
    const bushAndRockPlacements: Array<{
      x: number;
      y: number;
      tex: 'bush-taunus' | 'bush-flower' | 'rock-taunus';
      scale?: number;
    }> = [
      // Along North Paths
      { x: -160, y: -135, tex: 'bush-flower' },
      { x: 280, y: -140, tex: 'bush-taunus' },
      { x: 400, y: -235, tex: 'bush-flower' },
      { x: 740, y: -135, tex: 'bush-taunus' },
      { x: 1050, y: -235, tex: 'rock-taunus' },
      { x: 1090, y: -230, tex: 'bush-flower' },
      { x: 1360, y: -135, tex: 'bush-taunus' },
      { x: 1700, y: -235, tex: 'bush-flower' },
      { x: 2120, y: -135, tex: 'bush-taunus' },
      // Around NW Pond & West Creek
      { x: -580, y: -250, tex: 'rock-taunus', scale: 1.1 },
      { x: -350, y: -260, tex: 'bush-flower' },
      { x: -390, y: 160, tex: 'rock-taunus' },
      { x: -460, y: 360, tex: 'bush-taunus' },
      { x: -380, y: 620, tex: 'bush-flower' },
      { x: -510, y: 960, tex: 'rock-taunus' },
      { x: -165, y: 290, tex: 'bush-taunus' },
      { x: -165, y: 660, tex: 'bush-flower' },
      { x: -165, y: 980, tex: 'bush-taunus' },
      // Along East Woods & SE Pond
      { x: 2265, y: 310, tex: 'bush-flower' },
      { x: 2265, y: 680, tex: 'bush-taunus' },
      { x: 2265, y: 1020, tex: 'bush-flower' },
      { x: 2590, y: 420, tex: 'rock-taunus' },
      { x: 2430, y: 840, tex: 'bush-taunus' },
      { x: 2410, y: 1490, tex: 'rock-taunus', scale: 1.1 },
      { x: 2640, y: 1530, tex: 'bush-flower' },
      // Along South Promenade & Meadow Trail
      { x: 865, y: 1320, tex: 'bush-flower' },
      { x: 865, y: 1390, tex: 'bush-taunus' },
      { x: 1235, y: 1320, tex: 'bush-flower' },
      { x: 1235, y: 1390, tex: 'bush-taunus' },
      { x: 340, y: 1395, tex: 'bush-flower' },
      { x: 680, y: 1495, tex: 'rock-taunus' },
      { x: 1440, y: 1495, tex: 'bush-flower' },
      { x: 1780, y: 1395, tex: 'bush-taunus' },
      { x: 540, y: 1620, tex: 'bush-flower' },
      { x: 1540, y: 1620, tex: 'bush-taunus' },
    ];

    bushAndRockPlacements.forEach((item) => {
      this.add
        .image(item.x, item.y, item.tex)
        .setScale(item.scale ?? 1)
        .setDepth(item.y + 10);
    });

    // 3. Wooden Trail Benches ('park-bench') & Signposts ('trail-signpost')
    const benches = [
      { x: 1050, y: -445, label: '⛰️ Feldberg-Blick' },
      { x: -580, y: -365, label: '🌊 Waldteich-Rast' },
      { x: 820, y: 1405, label: '☀️ Süd-Promenade' },
      { x: 1280, y: 1405, label: '' },
      { x: 1050, y: 1630, label: '🌿 Wiesen-Bank' },
    ];
    benches.forEach((b) => {
      this.add.image(b.x, b.y, 'park-bench').setDepth(b.y + 8);
      if (b.label) {
        this.add
          .text(b.x, b.y - 24, b.label, {
            fontFamily: 'Inter, sans-serif',
            fontSize: '9.5px',
            fontStyle: 'bold',
            color: '#174955',
            backgroundColor: '#F4F7F8',
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5, 0.5)
          .setDepth(b.y + 15);
      }
    });

    const signposts = [
      { x: 865, y: 1425, text: '🥾 Taunus-Rundweg' },
      { x: 310, y: -210, text: '⬆️ Panorama-Pfad' },
      { x: 2355, y: 235, text: '🌲 Ostwald-Steig' },
      { x: -255, y: 535, text: '🌉 Aar-Bachbrücke' },
    ];
    signposts.forEach((sp) => {
      this.add.image(sp.x, sp.y, 'trail-signpost').setDepth(sp.y + 12);
      this.add
        .text(sp.x, sp.y - 34, sp.text, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '9.5px',
          fontStyle: 'bold',
          color: '#FFFFFF',
          backgroundColor: '#5F7F6E',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(sp.y + 20);
    });

    // 4. Spawn Animated Hikers ("laufende Wanderer") on the Hiking Trails
    const hikerConfigs: Array<{
      name: string;
      texPrefix: string;
      speed: number;
      startIdx: number;
      waypoints: Array<{ x: number; y: number }>;
    }> = [
      {
        name: '🥾 Wanderin Lisa',
        texPrefix: 'hiker-a',
        speed: 58,
        startIdx: 0,
        waypoints: [
          { x: -220, y: 1445 },
          { x: 2320, y: 1445 },
          { x: 2320, y: -185 },
          { x: -220, y: -185 },
        ],
      },
      {
        name: '🎒 Wanderer Thomas',
        texPrefix: 'hiker-b',
        speed: 54,
        startIdx: 2,
        waypoints: [
          { x: -220, y: 1445 },
          { x: 2320, y: 1445 },
          { x: 2320, y: -185 },
          { x: -220, y: -185 },
        ],
      },
      {
        name: '🥾 Nordic-Walker Markus',
        texPrefix: 'hiker-c',
        speed: 64,
        startIdx: 0,
        waypoints: [
          { x: 340, y: -185 },
          { x: 340, y: -410 },
          { x: 1760, y: -410 },
          { x: 1760, y: -185 },
        ],
      },
      {
        name: '🎒 Wanderin Julia',
        texPrefix: 'hiker-a',
        speed: 52,
        startIdx: 0,
        waypoints: [
          { x: -220, y: 560 },
          { x: -640, y: 560 },
          { x: -640, y: 1040 },
          { x: -220, y: 1040 },
        ],
      },
      {
        name: '🥾 Spaziergänger Bernd',
        texPrefix: 'hiker-b',
        speed: 48,
        startIdx: 0,
        waypoints: [
          { x: 420, y: 1445 },
          { x: 420, y: 1665 },
          { x: 1680, y: 1665 },
          { x: 1680, y: 1445 },
        ],
      },
      {
        name: '🎒 Bergläuferin Anna',
        texPrefix: 'hiker-c',
        speed: 72,
        startIdx: 0,
        waypoints: [
          { x: 2320, y: 260 },
          { x: 2660, y: 260 },
          { x: 2660, y: 980 },
          { x: 2320, y: 980 },
        ],
      },
    ];

    hikerConfigs.forEach((hc) => {
      const startPt = hc.waypoints[hc.startIdx];
      const nextIdx = (hc.startIdx + 1) % hc.waypoints.length;
      const sprite = this.add.image(0, 0, `${hc.texPrefix}-0`);
      const tag = this.add
        .text(0, -32, hc.name, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '9.5px',
          fontStyle: 'bold',
          color: '#174955',
          backgroundColor: '#F4F7F8',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 0.5);

      const container = this.add
        .container(startPt.x, startPt.y, [sprite, tag])
        .setDepth(startPt.y + 15);

      this.outdoorWalkers.push({
        container,
        sprite,
        texturePrefix: hc.texPrefix,
        waypoints: hc.waypoints,
        currentTargetIdx: nextIdx,
        speed: hc.speed,
        animTimer: Math.random() * 10,
        bobAmplitude: 1.8,
      });
    });

    // 5. Spawn Animated Wildlife ("ein paar Tiere die lang laufen": Deer, Foxes, Rabbits)
    const wildlifeConfigs: Array<{
      texPrefix: string;
      speed: number;
      bobAmplitude: number;
      waypoints: Array<{ x: number; y: number }>;
    }> = [
      // Roe Deer (Taunus-Rehe)
      {
        texPrefix: 'animal-deer',
        speed: 38,
        bobAmplitude: 1.6,
        waypoints: [
          { x: -120, y: -330 },
          { x: 260, y: -340 },
          { x: 220, y: -260 },
          { x: -80, y: -260 },
        ],
      },
      {
        texPrefix: 'animal-deer',
        speed: 36,
        bobAmplitude: 1.6,
        waypoints: [
          { x: 2420, y: -120 },
          { x: 2720, y: -80 },
          { x: 2700, y: 160 },
          { x: 2420, y: 140 },
        ],
      },
      {
        texPrefix: 'animal-deer',
        speed: 40,
        bobAmplitude: 1.6,
        waypoints: [
          { x: -580, y: 1220 },
          { x: -300, y: 1340 },
          { x: -320, y: 1580 },
          { x: -620, y: 1480 },
        ],
      },
      // Red Foxes (Rotfüchse)
      {
        texPrefix: 'animal-fox',
        speed: 62,
        bobAmplitude: 1.4,
        waypoints: [
          { x: 820, y: -320 },
          { x: 1420, y: -320 },
          { x: 1380, y: -250 },
          { x: 860, y: -250 },
        ],
      },
      {
        texPrefix: 'animal-fox',
        speed: 58,
        bobAmplitude: 1.4,
        waypoints: [
          { x: 2420, y: 1080 },
          { x: 2740, y: 1120 },
          { x: 2720, y: 1360 },
          { x: 2410, y: 1320 },
        ],
      },
      {
        texPrefix: 'animal-fox',
        speed: 60,
        bobAmplitude: 1.4,
        waypoints: [
          { x: -580, y: -120 },
          { x: -310, y: -110 },
          { x: -320, y: 120 },
          { x: -580, y: 90 },
        ],
      },
      // Wild Rabbits (Feldhasen)
      {
        texPrefix: 'animal-rabbit',
        speed: 48,
        bobAmplitude: 2.8,
        waypoints: [
          { x: 520, y: 1510 },
          { x: 780, y: 1525 },
          { x: 740, y: 1610 },
          { x: 500, y: 1595 },
        ],
      },
      {
        texPrefix: 'animal-rabbit',
        speed: 52,
        bobAmplitude: 2.8,
        waypoints: [
          { x: 1320, y: 1520 },
          { x: 1610, y: 1510 },
          { x: 1590, y: 1610 },
          { x: 1340, y: 1600 },
        ],
      },
      {
        texPrefix: 'animal-rabbit',
        speed: 46,
        bobAmplitude: 2.8,
        waypoints: [
          { x: 1840, y: -290 },
          { x: 2180, y: -280 },
          { x: 2140, y: -230 },
          { x: 1860, y: -235 },
        ],
      },
      {
        texPrefix: 'animal-rabbit',
        speed: 50,
        bobAmplitude: 2.8,
        waypoints: [
          { x: -580, y: 650 },
          { x: -340, y: 660 },
          { x: -360, y: 780 },
          { x: -580, y: 760 },
        ],
      },
    ];

    wildlifeConfigs.forEach((wc) => {
      const startPt = wc.waypoints[0];
      const sprite = this.add.image(0, 0, `${wc.texPrefix}-0`);
      const container = this.add
        .container(startPt.x, startPt.y, [sprite])
        .setDepth(startPt.y + 12);

      this.outdoorWalkers.push({
        container,
        sprite,
        texturePrefix: wc.texPrefix,
        waypoints: wc.waypoints,
        currentTargetIdx: 1,
        speed: wc.speed,
        animTimer: Math.random() * 10,
        bobAmplitude: wc.bobAmplitude,
      });
    });
  }

  private updateOutdoorWalkers(delta: number): void {
    const dt = delta * 0.001;
    for (const w of this.outdoorWalkers) {
      const target = w.waypoints[w.currentTargetIdx];
      const dx = target.x - w.container.x;
      const dy = target.y - w.container.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        w.currentTargetIdx = (w.currentTargetIdx + 1) % w.waypoints.length;
        continue;
      }

      const step = Math.min(dist, w.speed * dt);
      const nx = w.container.x + (dx / dist) * step;
      const ny = w.container.y + (dy / dist) * step;

      w.animTimer += delta * 0.012;
      const frame = Math.floor(w.animTimer) % 2;
      const bob = Math.sin(w.animTimer * 2.2) * w.bobAmplitude;

      w.container.setPosition(nx, ny);
      w.container.setDepth(ny + 14);
      w.sprite.setY(bob);

      const texKey = `${w.texturePrefix}-${frame}`;
      if (w.sprite.texture.key !== texKey) {
        w.sprite.setTexture(texKey);
      }

      if (Math.abs(dx) > 0.5) {
        w.sprite.setFlipX(dx < 0);
      }
    }
  }

  /**
   * Creates a Coworking Desk + Chair pair where clicking EITHER the chair OR the desk
   * seats the player at the desk and changes the desk's color so everyone sees it's occupied.
   */
  private createInteractiveDeskWithSeat(
    id: string,
    label: string,
    deskX: number,
    deskY: number
  ): void {
    const chairX = deskX;
    const chairY = deskY + 40;

    const chairSprite = this.add
      .image(chairX, chairY, 'chair-office')
      .setDepth(deskY);

    const deskSprite = this.obstacles.create(
      deskX,
      deskY,
      'desk-cowork-off'
    ) as Phaser.Physics.Arcade.Sprite;
    deskSprite.setDepth(deskY + 10);
    deskSprite.body?.setSize(104, 44);
    deskSprite.body?.setOffset(7, 10);

    const occupiedBadge = this.add
      .text(deskX, deskY - 34, '🪑 BESETZT', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '9.5px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        backgroundColor: '#E68A36',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(deskY + 30)
      .setVisible(false);

    const seatInstance: SeatInstance = {
      id,
      label,
      chairX,
      chairY,
      seatSprite: chairSprite,
      defaultSeatTexture: 'chair-office',
      deskSprite,
      deskX,
      deskY,
      occupiedBadge,
      isOccupied: false,
    };

    chairSprite.setInteractive({ useHandCursor: true });
    deskSprite.setInteractive({ useHandCursor: true });

    chairSprite.on('pointerup', (pointer: Phaser.Input.Pointer) =>
      this.handleSeatOrDeskClick(seatInstance, pointer)
    );
    deskSprite.on('pointerup', (pointer: Phaser.Input.Pointer) =>
      this.handleSeatOrDeskClick(seatInstance, pointer)
    );

    this.seats.push(seatInstance);
  }

  private registerClickableSeat(
    id: string,
    label: string,
    chairX: number,
    chairY: number,
    texture: string
  ): SeatInstance {
    const seatSprite = this.add
      .image(chairX, chairY, texture)
      .setDepth(chairY - 4);
    seatSprite.setInteractive({ useHandCursor: true });

    const seatInstance: SeatInstance = {
      id,
      label,
      chairX,
      chairY,
      seatSprite,
      defaultSeatTexture: texture,
      isOccupied: false,
    };

    seatSprite.on('pointerup', (pointer: Phaser.Input.Pointer) =>
      this.handleSeatOrDeskClick(seatInstance, pointer)
    );
    this.seats.push(seatInstance);
    return seatInstance;
  }

  private createWorldPromptBadge(
    x: number,
    y: number,
    text: string,
    _borderColorHex: number
  ): Phaser.GameObjects.Container {
    const promptBg = this.add.graphics();
    // Soft drop shadow
    promptBg.fillStyle(0x0f323a, 0.16);
    promptBg.fillRoundedRect(-137, -15, 274, 36, 16);
    // Light Apple-Glass menu fill
    promptBg.fillStyle(0xf4f7f8, 0.96);
    promptBg.fillRoundedRect(-135, -18, 270, 36, 15);
    // Thick bright Apple-style inner bezel
    promptBg.lineStyle(3, 0xffffff, 0.98);
    promptBg.strokeRoundedRect(-135, -18, 270, 36, 15);
    // Crisp subtle outer contour
    promptBg.lineStyle(1.5, 0x174955, 0.28);
    promptBg.strokeRoundedRect(-136, -19, 272, 38, 16);

    const promptTxt = this.add
      .text(0, 0, text, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#174955',
      })
      .setOrigin(0.5, 0.5);

    return this.add
      .container(x, y, [promptBg, promptTxt])
      .setDepth(1600)
      .setVisible(false);
  }

  /**
   * Renders a true 3/4-perspective Gather.town wall segment with:
   * - Floor drop shadow
   * - Vertical front wall facade + baseboard (Sockelleiste)
   * - Top wall cap with highlight rim and doorway end-cap pillars
   * - Static physics collider for accurate collision
   */
  private addWallBlock(
    cx: number,
    cy: number,
    width: number,
    height: number,
    colorHex: number,
    visible = true
  ): void {
    const rect = this.add.rectangle(cx, cy, width, height, colorHex, 0);
    rect.setDepth(cy);
    this.physics.add.existing(rect, true);
    this.obstacles.add(rect);

    if (!visible) return;

    const wallGfx = this.add.graphics();
    wallGfx.setDepth(cy + 4);

    const x = cx - width / 2;
    const y = cy - height / 2;
    const isHorizontal = width >= height;

    if (isHorizontal) {
      const wallFaceH = 16;
      const topY = y - 10;
      // Floor shadow in front of wall
      wallGfx.fillStyle(0x091f24, 0.25);
      wallGfx.fillRoundedRect(x - 2, y + height - 2, width + 4, 10, 3);

      // Vertical front wall facade (plastered slate/cream wall)
      wallGfx.fillStyle(0x334e54, 1);
      wallGfx.fillRect(x, topY + height, width, wallFaceH);

      // Baseboard (Sockelleiste) at bottom of wall face
      wallGfx.fillStyle(0x0f323a, 1);
      wallGfx.fillRect(x, topY + height + wallFaceH - 4, width, 4);

      // Top wall cap (3/4 roof edge of wall)
      wallGfx.fillStyle(colorHex, 1);
      wallGfx.fillRoundedRect(x, topY, width, height + 2, 3);
      wallGfx.lineStyle(1.5, 0x0f323a, 0.9);
      wallGfx.strokeRoundedRect(x, topY, width, height + 2, 3);

      // Subtle inner highlight line on top cap
      wallGfx.lineStyle(1, 0xedf5f7, 0.35);
      wallGfx.lineBetween(x + 3, topY + 2, x + width - 3, topY + 2);

      // Doorway end-cap pillars on left & right ends of interior horizontal walls
      if (width < this.WORLD_W - 100) {
        [x, x + width - 8].forEach((px) => {
          wallGfx.fillStyle(0x0f323a, 1);
          wallGfx.fillRect(px, topY - 1, 8, height + wallFaceH + 2);
          wallGfx.fillStyle(0xe68a36, 0.85);
          wallGfx.fillRect(px + 1, topY, 6, 4);
        });
      }
    } else {
      // Vertical 3/4 wall segment
      const wallFaceH = 14;
      // Side floor shadow
      wallGfx.fillStyle(0x091f24, 0.22);
      wallGfx.fillRoundedRect(x + 3, y + 2, width + 4, height + wallFaceH, 3);

      // Southern vertical front end-face at bottom of vertical wall
      wallGfx.fillStyle(0x334e54, 1);
      wallGfx.fillRect(x, y + height - 2, width, wallFaceH);
      wallGfx.fillStyle(0x0f323a, 1);
      wallGfx.fillRect(x, y + height + wallFaceH - 4, width, 4);

      // Top cap running vertically
      wallGfx.fillStyle(colorHex, 1);
      wallGfx.fillRoundedRect(x, y, width, height, 3);
      wallGfx.lineStyle(1.5, 0x0f323a, 0.9);
      wallGfx.strokeRoundedRect(x, y, width, height, 3);

      // Highlight strip down the center of top cap
      wallGfx.lineStyle(1, 0xedf5f7, 0.3);
      wallGfx.lineBetween(cx, y + 4, cx, y + height - 4);
    }
  }

  private createAvatarVisual(state: PlayerState, isSelf: boolean): AvatarVisual {
    const texKey = this.getAvatarTextureKey(
      state.color,
      state.direction || 'down',
      0,
      Boolean(state.isSeated)
    );
    const sprite = this.add.image(0, 0, texKey);

    const coffeeSprite = this.add
      .image(19, 6, 'coffee-cup-hand')
      .setVisible(Boolean(state.hasCoffee));

    const labelText = isSelf ? `${state.name} (Du)` : state.name;
    const nameTag = this.add
      .text(0, 27, labelText, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        backgroundColor: isSelf ? '#174955' : '#2A2E30',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    const townBadge = this.add
      .text(0, 44, `📍 ${state.location}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '9.5px',
        color: '#0F323A',
        backgroundColor: '#EDF5F7',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    const customStatusTag = this.add
      .text(0, 60, state.customStatus || '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#FDF5EE',
        backgroundColor: '#4B6F77',
        padding: { x: 5, y: 1.5 },
      })
      .setOrigin(0.5, 0)
      .setVisible(Boolean(state.customStatus && state.customStatus.trim()));

    const statusDot = this.add.circle(16, -14, 5.5, 0x8eae9d);
    statusDot.setStrokeStyle(1.5, 0xffffff);

    const bubbleBg = this.add.graphics();
    const bubbleText = this.add
      .text(0, 0, '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#151718',
        wordWrap: { width: 195 },
        align: 'center',
      })
      .setOrigin(0.5, 1);

    const bubbleContainer = this.add.container(0, -28, [bubbleBg, bubbleText]);
    bubbleContainer.setVisible(false);

    state.zone = this.detectZone(state.x, state.y);
    const container = this.add.container(state.x, state.y, [
      sprite,
      coffeeSprite,
      statusDot,
      nameTag,
      townBadge,
      customStatusTag,
      bubbleContainer,
    ]);
    container.setDepth(state.y + 15);

    const visual: AvatarVisual = {
      container,
      sprite,
      coffeeSprite,
      nameTag,
      townBadge,
      customStatusTag,
      statusDot,
      bubbleContainer,
      bubbleBg,
      bubbleText,
      bubbleExpiresAt: 0,
      state,
    };

    sprite.setInteractive({ useHandCursor: true });
    [sprite, nameTag, townBadge].forEach((interactiveObj) => {
      interactiveObj.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (this.isDraggingCamera || this.isPointerBlockedByUi(pointer)) return;
        setTimeout(() => this.callbacks.onAvatarClick(visual.state), 20);
      });
    });

    this.updateStatusDotColor(visual);

    if (
      state.bubbleText &&
      state.bubbleExpiresAt &&
      state.bubbleExpiresAt > Date.now()
    ) {
      this.applySpeechBubble(visual, state.bubbleText, state.bubbleExpiresAt);
    }

    return visual;
  }

  private syncOtherPlayers(players: PlayerState[]): void {
    const incomingIds = new Set(players.map((p) => p.id));

    for (const [id, vis] of this.otherVisuals.entries()) {
      if (!incomingIds.has(id)) {
        vis.container.destroy();
        this.otherVisuals.delete(id);
      }
    }

    players.forEach((p) => {
      const existing = this.otherVisuals.get(p.id);
      if (!existing) {
        const created = this.createAvatarVisual(p, false);
        this.otherVisuals.set(p.id, created);
      } else {
        const movedDist = Phaser.Math.Distance.Between(
          existing.container.x,
          existing.container.y,
          p.x,
          p.y
        );
        const isSeatedAtAnyChair = this.seats.some(
          (s) => Phaser.Math.Distance.Between(p.x, p.y, s.chairX, s.chairY) < 34
        );
        const remoteWalkFrame: 0 | 1 =
          movedDist > 2 ? ((Math.floor(Date.now() / 180) % 2) as 0 | 1) : 0;

        existing.state = {
          ...p,
          zone: this.detectZone(p.x, p.y),
        };
        existing.sprite.setTexture(
          this.getAvatarTextureKey(
            p.color,
            p.direction || 'down',
            remoteWalkFrame,
            isSeatedAtAnyChair || Boolean(p.isSeated)
          )
        );
        existing.coffeeSprite.setVisible(Boolean(p.hasCoffee));
        existing.nameTag.setText(p.name);
        existing.townBadge.setText(`📍 ${p.location}`);
        this.updateCustomStatusTag(existing);
        this.updateStatusDotColor(existing);

        this.tweens.add({
          targets: existing.container,
          x: p.x,
          y: p.y,
          duration: 240,
          ease: 'Sine.easeOut',
          onUpdate: () => {
            existing.container.setDepth(existing.container.y + 15);
          },
        });

        if (
          p.bubbleText &&
          p.bubbleExpiresAt &&
          p.bubbleExpiresAt > Date.now() &&
          p.bubbleExpiresAt !== existing.bubbleExpiresAt
        ) {
          this.applySpeechBubble(existing, p.bubbleText, p.bubbleExpiresAt);
        }
      }
    });
  }

  private updateCustomStatusTag(visual: AvatarVisual): void {
    const text = (visual.state.customStatus || '').trim();
    if (text.length > 0) {
      visual.customStatusTag.setText(text);
      visual.customStatusTag.setVisible(true);
    } else {
      visual.customStatusTag.setVisible(false);
    }
  }

  private applySpeechBubble(
    visual: AvatarVisual,
    text: string,
    expiresAt: number
  ): void {
    visual.bubbleText.setText(text);
    const w = Math.max(80, visual.bubbleText.width + 20);
    const h = visual.bubbleText.height + 14;

    visual.bubbleBg.clear();
    visual.bubbleBg.fillStyle(0xffffff, 0.97);
    visual.bubbleBg.fillRoundedRect(-w / 2, -h - 8, w, h, 8);
    visual.bubbleBg.lineStyle(2, 0x00a5b5, 1);
    visual.bubbleBg.strokeRoundedRect(-w / 2, -h - 8, w, h, 8);
    visual.bubbleBg.fillStyle(0xffffff, 0.97);
    visual.bubbleBg.fillTriangle(-6, -8, 6, -8, 0, 0);

    visual.bubbleText.setPosition(0, -14);
    visual.bubbleExpiresAt = expiresAt;
    visual.bubbleContainer.setVisible(true);
    visual.bubbleContainer.setAlpha(0);
    visual.bubbleContainer.y = -22;

    this.tweens.add({
      targets: visual.bubbleContainer,
      alpha: 1,
      y: -28,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  private checkBubbleExpiration(visual: AvatarVisual, now: number): void {
    if (
      visual.bubbleContainer.visible &&
      visual.bubbleExpiresAt > 0 &&
      now > visual.bubbleExpiresAt
    ) {
      visual.bubbleExpiresAt = 0;
      visual.bubbleContainer.setVisible(false);
    }
  }

  private updateStatusDotColor(visual: AvatarVisual): void {
    const currentZone = this.detectZone(visual.container.x, visual.container.y);
    visual.state.zone = currentZone;
    const meta = getPlayerStatusMeta({
      zone: currentZone,
      status: visual.state.status,
      x: visual.container.x,
      y: visual.container.y,
    });
    visual.statusDot.setFillStyle(meta.dotNum, 1);
  }

  private detectZone(x: number, y: number): ZoneType {
    return getZoneFromCoordinates(x, y);
  }

  private getAvatarTextureKey(
    hexColor: string,
    direction: 'up' | 'down' | 'left' | 'right' = 'down',
    walkFrame: 0 | 1 = 0,
    isSeated = false
  ): string {
    const clean = (hexColor || '#174955').replace('#', '').toLowerCase();
    if (isSeated) {
      const sitKey = `avatar-${clean}-sit`;
      if (this.textures.exists(sitKey)) return sitKey;
    }
    const dirKey = `avatar-${clean}-${direction}-${walkFrame}`;
    if (this.textures.exists(dirKey)) return dirKey;

    const fallbackKey = `avatar-${clean}`;
    return this.textures.exists(fallbackKey) ? fallbackKey : 'avatar-174955';
  }

  private isTypingInInput(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      active.closest('dialog[open]') !== null
    );
  }
}
