import Phaser from 'phaser';
import { AVATAR_PALETTE } from '../types';

/**
 * Generates all 2.5D Gather.town-style RPG textures procedurally using Phaser Graphics,
 * strictly adhering to the Untertaunus Digital Business Hub color system:
 * - 3/4 perspective furniture with front thickness, legs, shadows, and desk lamps
 * - 4-directional RPG/Chibi character sprites (down, up, left, right) with 2 walk frames + seated pose
 * - Outdoor Taunus trees & park elements
 */
export function generateHubTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // 1A. Coworking Desk - FREE (Unoccupied: Crisp 2.5D desk with standby monitors & lamp off)
  drawCoworkingDesk(g, false);
  g.generateTexture('desk-cowork-off', 124, 78);

  // 1B. Coworking Desk - OCCUPIED (Illuminated Warm-Amber tabletop, glowing monitors & lamp cone ON)
  drawCoworkingDesk(g, true);
  g.generateTexture('desk-cowork-on', 124, 78);

  // Alias 'desk-cowork'
  drawCoworkingDesk(g, false);
  g.generateTexture('desk-cowork', 124, 78);

  // 2A. 2.5D Ergonomic Office Chair (Free)
  drawOfficeChair(g, false);
  g.generateTexture('chair-office', 40, 42);

  // 2B. 2.5D Ergonomic Office Chair (Occupied highlight)
  drawOfficeChair(g, true);
  g.generateTexture('chair-office-active', 40, 42);

  // 3. 2.5D Lounge Round Table (Warm-Amber wood with pedestal leg & coffee cups)
  g.clear();
  // Floor shadow
  g.fillStyle(0x151718, 0.24);
  g.fillEllipse(40, 56, 62, 26);
  // Central pedestal leg & base
  g.fillStyle(0x2a2e30, 1);
  g.fillEllipse(38, 54, 28, 12);
  g.fillRect(34, 34, 8, 20);
  // 3D front rim thickness of round table
  g.fillStyle(0xb86518, 1);
  g.fillEllipse(38, 35, 66, 46);
  // Tabletop surface
  g.fillStyle(0xfdf5ee, 1);
  g.fillEllipse(38, 30, 66, 46);
  g.lineStyle(3, 0xe68a36, 1);
  g.strokeEllipse(38, 30, 64, 44);
  // Subtle wood-grain lines on tabletop
  g.lineStyle(1, 0xe68a36, 0.25);
  g.lineBetween(16, 26, 60, 26);
  g.lineBetween(14, 32, 62, 32);
  // Center decorative coaster & two espresso cups
  g.fillStyle(0x8eae9d, 0.45);
  g.fillEllipse(38, 30, 20, 14);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(26, 25, 5);
  g.fillStyle(0xb86518, 1);
  g.fillCircle(26, 25, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(49, 34, 5);
  g.fillStyle(0xb86518, 1);
  g.fillCircle(49, 34, 3);
  g.generateTexture('table-lounge', 78, 72);

  // 4. 2.5D Upholstered Lounge Stool / Pouf (Warm-Amber with wooden legs)
  g.clear();
  g.fillStyle(0x151718, 0.22);
  g.fillEllipse(18, 28, 26, 12);
  // Wooden stool legs
  g.fillStyle(0x580e30, 1);
  g.fillRect(8, 20, 3, 8);
  g.fillRect(25, 20, 3, 8);
  g.fillRect(16, 22, 3, 8);
  // Cushion 3D side cylinder
  g.fillStyle(0xb86518, 1);
  g.fillRoundedRect(5, 10, 26, 14, 6);
  // Cushion top
  g.fillStyle(0xe68a36, 1);
  g.fillEllipse(18, 12, 26, 16);
  g.lineStyle(2, 0x151718, 0.8);
  g.strokeEllipse(18, 12, 26, 16);
  // Button tuft in center
  g.fillStyle(0xfdf5ee, 0.65);
  g.fillCircle(18, 11, 2.5);
  g.generateTexture('stool-lounge', 36, 34);

  // 5. 2.5D Fun Room Beanbag (Plush quilted Sitzsack in Cyan/Petrol)
  g.clear();
  g.fillStyle(0x151718, 0.24);
  g.fillEllipse(22, 31, 36, 18);
  // Lower plush body
  g.fillStyle(0x007a87, 1);
  g.fillEllipse(22, 24, 34, 24);
  // Upper seat indentation
  g.fillStyle(0x00a5b5, 1);
  g.fillEllipse(22, 19, 30, 20);
  g.lineStyle(2, 0x0f323a, 0.9);
  g.strokeEllipse(22, 22, 34, 24);
  // Highlight fold
  g.fillStyle(0xebf9fb, 0.45);
  g.fillEllipse(17, 15, 14, 8);
  g.generateTexture('beanbag-seat', 44, 42);

  // 6. 2.5D Foosball / Tischkicker Table with 3D Cabinet & Legs
  g.clear();
  // Floor shadow
  g.fillStyle(0x151718, 0.28);
  g.fillRoundedRect(4, 18, 126, 64, 8);
  // Table legs
  g.fillStyle(0x151718, 1);
  g.fillRect(10, 62, 8, 16);
  g.fillRect(112, 62, 8, 16);
  // 3D front cabinet side wall
  g.fillStyle(0x0f323a, 1);
  g.fillRoundedRect(2, 46, 126, 20, 4);
  g.lineStyle(2, 0xe68a36, 0.9);
  g.lineBetween(8, 55, 122, 55);
  // Top cabinet rim
  g.fillStyle(0x174955, 1);
  g.fillRoundedRect(2, 4, 126, 50, 6);
  g.lineStyle(2.5, 0x091f24, 1);
  g.strokeRoundedRect(2, 4, 126, 50, 6);
  // Green pitch inside foosball table
  g.fillStyle(0x5f7f6e, 1);
  g.fillRect(12, 10, 106, 38);
  // Pitch markings
  g.lineStyle(1.5, 0xffffff, 0.85);
  g.strokeRect(14, 12, 102, 34);
  g.lineBetween(65, 12, 65, 46);
  g.strokeCircle(65, 29, 8);
  // Chrome rods, handles & player figures
  [28, 46, 65, 84, 102].forEach((rx, idx) => {
    g.lineStyle(2, 0xe2e8f0, 0.95);
    g.lineBetween(rx, 0, rx, 58);
    // Black rubber handle on alternating side
    g.fillStyle(0x151718, 1);
    if (idx % 2 === 0) {
      g.fillRect(rx - 2, 54, 4, 7);
    } else {
      g.fillRect(rx - 2, 0, 4, 6);
    }
    g.fillStyle(idx % 2 === 0 ? 0xe68a36 : 0x00a5b5, 1);
    g.fillCircle(rx, 20, 3.5);
    g.fillCircle(rx, 37, 3.5);
  });
  g.generateTexture('foosball-table', 134, 82);

  // 7. 2.5D Retro Arcade Cabinet (Tall 3/4 view with Marquee, Bezel & Joystick Deck)
  g.clear();
  g.fillStyle(0x151718, 0.3);
  g.fillRoundedRect(4, 14, 56, 52, 6);
  // Cabinet side/base
  g.fillStyle(0x0f323a, 1);
  g.fillRoundedRect(2, 2, 54, 58, 5);
  // Lower coin-door front panel
  g.fillStyle(0x151718, 1);
  g.fillRect(8, 40, 42, 18);
  g.fillStyle(0xe68a36, 1);
  g.fillRect(18, 45, 6, 8);
  g.fillRect(34, 45, 6, 8);
  // Illuminated top marquee ("TAUNUS")
  g.fillStyle(0xe68a36, 1);
  g.fillRoundedRect(6, 4, 46, 9, 2);
  // Glowing CRT screen
  g.fillStyle(0x007a87, 1);
  g.fillRoundedRect(8, 15, 42, 16, 3);
  g.fillStyle(0x00a5b5, 1);
  g.fillRoundedRect(10, 17, 38, 12, 2);
  // Pixel spaceship / blocks on screen
  g.fillStyle(0xfdf5ee, 1);
  g.fillRect(26, 21, 6, 4);
  g.fillStyle(0xe68a36, 1);
  g.fillRect(16, 19, 4, 3);
  g.fillRect(36, 24, 4, 3);
  // Control deck ledge
  g.fillStyle(0x334e54, 1);
  g.fillRect(6, 32, 46, 8);
  g.fillStyle(0xe68a36, 1);
  g.fillCircle(16, 36, 3);
  g.fillStyle(0x7e1946, 1);
  g.fillCircle(34, 35, 2.5);
  g.fillStyle(0x00a5b5, 1);
  g.fillCircle(41, 36, 2.5);
  g.lineStyle(2, 0x00a5b5, 0.9);
  g.strokeRoundedRect(2, 2, 54, 58, 5);
  g.generateTexture('arcade-machine', 62, 66);

  // 8. 2.5D Barista Kitchen Counter + Portafilter Machine + Glowing Drinks Fridge
  g.clear();
  // Shadow
  g.fillStyle(0x151718, 0.26);
  g.fillRoundedRect(4, 14, 192, 54, 8);
  // Front cabinet face (3/4 perspective cabinetry with doors)
  g.fillStyle(0x0f323a, 1);
  g.fillRoundedRect(2, 26, 190, 36, 6);
  // Cabinet door panels & brass handles
  [12, 56, 100].forEach((dx) => {
    g.fillStyle(0x174955, 1);
    g.fillRoundedRect(dx, 32, 38, 24, 3);
    g.fillStyle(0xe68a36, 1);
    g.fillRect(dx + 14, 36, 10, 2.5);
  });
  // Glowing Glass Beverage Fridge built into right side of counter
  g.fillStyle(0xebf9fb, 0.9);
  g.fillRoundedRect(146, 30, 38, 28, 3);
  g.lineStyle(2, 0x00a5b5, 1);
  g.strokeRoundedRect(146, 30, 38, 28, 3);
  // Colorful bottles inside fridge
  [152, 160, 168, 176].forEach((bx, i) => {
    g.fillStyle(i % 2 === 0 ? 0xe68a36 : 0x5f7f6e, 1);
    g.fillRect(bx, 35, 4, 9);
    g.fillStyle(0x7e1946, 1);
    g.fillRect(bx, 47, 4, 9);
  });
  // Warm butcher-block wooden countertop overhang
  g.fillStyle(0xb86518, 1);
  g.fillRoundedRect(0, 6, 194, 28, 6);
  g.fillStyle(0xfdf5ee, 1);
  g.fillRoundedRect(3, 8, 188, 22, 5);
  g.lineStyle(2, 0xb86518, 1);
  g.strokeRoundedRect(1, 6, 192, 26, 6);
  // Commercial 2-Group Italian Portafilter Espresso Machine on left
  g.fillStyle(0x2a2e30, 1);
  g.fillRoundedRect(16, 2, 58, 22, 4);
  g.fillStyle(0xe68a36, 1);
  g.fillRect(20, 5, 50, 5);
  // Espresso group heads & cups
  g.fillStyle(0xffffff, 1);
  g.fillCircle(32, 19, 3.5);
  g.fillCircle(56, 19, 3.5);
  // Bean Grinder next to machine
  g.fillStyle(0x151718, 1);
  g.fillRoundedRect(82, 4, 16, 18, 3);
  g.fillStyle(0xb86518, 0.85);
  g.fillCircle(90, 8, 5);
  // Stainless steel sink & tap on right
  g.fillStyle(0xcbd5e1, 1);
  g.fillRoundedRect(112, 10, 32, 16, 3);
  g.fillStyle(0x64748b, 1);
  g.fillRoundedRect(115, 12, 26, 12, 2);
  g.generateTexture('coffee-counter', 198, 68);

  // 9. 2.5D Conference Table I (Edles Beerenrot & Walnut with Speakerphone & Laptops)
  g.clear();
  // Floor shadow
  g.fillStyle(0x151718, 0.26);
  g.fillRoundedRect(6, 14, 204, 90, 16);
  // Table legs visible at bottom corners
  g.fillStyle(0x2a2e30, 1);
  g.fillRect(24, 84, 10, 16);
  g.fillRect(180, 84, 10, 16);
  // 3D front table edge thickness
  g.fillStyle(0x580e30, 1);
  g.fillRoundedRect(2, 10, 204, 82, 14);
  // Main tabletop surface
  g.fillStyle(0x7e1946, 1);
  g.fillRoundedRect(2, 2, 204, 78, 14);
  g.lineStyle(2.5, 0x580e30, 1);
  g.strokeRoundedRect(2, 2, 204, 78, 14);
  // Inlaid conference media runner in center
  g.fillStyle(0x3b0920, 0.85);
  g.fillRoundedRect(38, 28, 132, 26, 6);
  g.lineStyle(1, 0xe68a36, 0.6);
  g.strokeRoundedRect(38, 28, 132, 26, 6);
  // Conference Spider Speakerphone in center
  g.fillStyle(0x151718, 1);
  g.fillCircle(104, 41, 10);
  g.fillStyle(0x00a5b5, 1);
  g.fillCircle(104, 41, 3.5);
  // Presentation notepads at seats
  [-58, 0, 58].forEach((ox) => {
    g.fillStyle(0xfbf0f4, 0.85);
    g.fillRoundedRect(104 + ox - 10, 8, 20, 12, 2);
    g.fillRoundedRect(104 + ox - 10, 62, 20, 12, 2);
  });
  g.generateTexture('conference-table', 212, 106);

  // 10. 2.5D Networking Round Table (Warm-Amber & Taunus-Petrol with 3D base)
  g.clear();
  g.fillStyle(0x151718, 0.25);
  g.fillCircle(74, 80, 64);
  // 3D rim thickness
  g.fillStyle(0x0f323a, 1);
  g.fillCircle(72, 74, 62);
  // Tabletop
  g.fillStyle(0x174955, 1);
  g.fillCircle(72, 68, 62);
  g.lineStyle(4, 0xe68a36, 1);
  g.strokeCircle(72, 68, 60);
  // Inner interactive B2B lighting ring
  g.fillStyle(0x00a5b5, 0.25);
  g.fillCircle(72, 68, 28);
  g.lineStyle(2, 0x00a5b5, 1);
  g.strokeCircle(72, 68, 28);
  g.fillStyle(0xe68a36, 1);
  g.fillCircle(72, 68, 8);
  g.generateTexture('networking-table', 148, 148);

  // 11. 2.5D Lush Indoor Monstera / Ficus Plant in Ceramic Planter
  g.clear();
  g.fillStyle(0x151718, 0.22);
  g.fillEllipse(24, 38, 30, 14);
  // Ceramic pot body (3/4 view)
  g.fillStyle(0x334e54, 1);
  g.fillRoundedRect(11, 22, 26, 16, 5);
  g.fillStyle(0x4b6f77, 1);
  g.fillEllipse(24, 23, 28, 10);
  // Soil
  g.fillStyle(0x2a2e30, 1);
  g.fillEllipse(24, 23, 22, 7);
  // Lush layered foliage leaves
  g.fillStyle(0x5f7f6e, 1);
  g.fillCircle(15, 16, 9);
  g.fillCircle(33, 16, 9);
  g.fillCircle(24, 10, 10);
  g.fillStyle(0x8eae9d, 1);
  g.fillCircle(18, 13, 7);
  g.fillCircle(30, 14, 7);
  g.fillCircle(24, 18, 8);
  g.fillStyle(0xf2f7f4, 0.55);
  g.fillCircle(21, 10, 3);
  g.generateTexture('plant-pot', 48, 44);

  // 12A. 2.5D Outdoor Taunus Deciduous Tree (Oak / Beech)
  g.clear();
  // Ground shadow
  g.fillStyle(0x091f24, 0.32);
  g.fillEllipse(42, 74, 58, 24);
  // Tree trunk
  g.fillStyle(0x583118, 1);
  g.fillRoundedRect(35, 48, 14, 26, 3);
  // 3-tier lush canopy
  g.fillStyle(0x334e54, 1);
  g.fillCircle(26, 44, 20);
  g.fillCircle(58, 44, 20);
  g.fillCircle(42, 38, 24);
  g.fillStyle(0x5f7f6e, 1);
  g.fillCircle(30, 36, 18);
  g.fillCircle(54, 36, 18);
  g.fillCircle(42, 24, 22);
  g.fillStyle(0x8eae9d, 1);
  g.fillCircle(38, 20, 14);
  g.fillCircle(48, 26, 12);
  g.generateTexture('tree-taunus', 84, 88);

  // 12B. 2.5D Taunus Conifer / Spruce Tree (Fichte / Tanne)
  g.clear();
  g.fillStyle(0x091f24, 0.34);
  g.fillEllipse(39, 82, 54, 22);
  g.fillStyle(0x4a2812, 1);
  g.fillRoundedRect(33, 62, 12, 22, 3);
  // Layered evergreen tiers
  g.fillStyle(0x1b3f2b, 1);
  g.fillTriangle(39, 26, 10, 68, 68, 68);
  g.fillStyle(0x28583e, 1);
  g.fillTriangle(39, 16, 14, 54, 64, 54);
  g.fillStyle(0x3a7052, 1);
  g.fillTriangle(39, 6, 20, 38, 58, 38);
  g.fillStyle(0x6c9e82, 0.75);
  g.fillTriangle(39, 6, 28, 24, 44, 24);
  g.generateTexture('tree-pine', 78, 92);

  // 12C. 2.5D Lush Taunus Shrub / Berry Bush (Strauch)
  g.clear();
  g.fillStyle(0x091f24, 0.26);
  g.fillEllipse(26, 33, 42, 14);
  g.fillStyle(0x28543c, 1);
  g.fillCircle(16, 24, 12);
  g.fillCircle(36, 24, 12);
  g.fillCircle(26, 20, 14);
  g.fillStyle(0x4d7c60, 1);
  g.fillCircle(19, 20, 10);
  g.fillCircle(33, 21, 10);
  g.fillCircle(26, 15, 11);
  g.fillStyle(0x7ca98e, 0.9);
  g.fillCircle(24, 13, 6);
  // Wild Taunus berries
  g.fillStyle(0x7e1946, 1);
  g.fillCircle(15, 22, 2.2);
  g.fillCircle(29, 24, 2.2);
  g.fillCircle(35, 18, 2.2);
  g.fillStyle(0xe68a36, 1);
  g.fillCircle(22, 18, 2);
  g.generateTexture('bush-taunus', 52, 42);

  // 12D. 2.5D Flowering Shrub (Blütenstrauch)
  g.clear();
  g.fillStyle(0x091f24, 0.24);
  g.fillEllipse(24, 30, 38, 12);
  g.fillStyle(0x356349, 1);
  g.fillCircle(15, 21, 10);
  g.fillCircle(33, 21, 10);
  g.fillCircle(24, 17, 12);
  g.fillStyle(0x5b8c6f, 1);
  g.fillCircle(20, 16, 8);
  g.fillCircle(29, 17, 8);
  // Blossoms
  g.fillStyle(0xfdf5ee, 1);
  g.fillCircle(16, 17, 2.5);
  g.fillCircle(26, 13, 2.5);
  g.fillCircle(32, 20, 2.5);
  g.fillStyle(0xe68a36, 1);
  g.fillCircle(21, 22, 2.3);
  g.fillCircle(28, 17, 2);
  g.generateTexture('bush-flower', 48, 38);

  // 12E. 2.5D Taunus Quartzite Rock / Boulder (Felsen)
  g.clear();
  g.fillStyle(0x091f24, 0.28);
  g.fillEllipse(28, 31, 46, 14);
  g.fillStyle(0x4b6f77, 1);
  g.fillRoundedRect(7, 14, 42, 18, 7);
  g.fillStyle(0x64878f, 1);
  g.fillRoundedRect(10, 10, 34, 16, 6);
  g.fillStyle(0x94b0b7, 0.8);
  g.fillRoundedRect(14, 11, 20, 8, 3);
  // Moss patch
  g.fillStyle(0x5f7f6e, 0.9);
  g.fillEllipse(34, 22, 12, 6);
  g.generateTexture('rock-taunus', 56, 40);

  // 12F. 2.5D Wooden Trail Bench (Wanderbank) & Signpost (Wegweiser)
  g.clear();
  g.fillStyle(0x091f24, 0.26);
  g.fillEllipse(32, 29, 54, 12);
  g.fillStyle(0x2a2e30, 1);
  g.fillRect(10, 18, 5, 11);
  g.fillRect(49, 18, 5, 11);
  g.fillStyle(0xb86518, 1);
  g.fillRoundedRect(6, 15, 52, 8, 3);
  g.fillStyle(0xe68a36, 1);
  g.fillRoundedRect(6, 7, 52, 7, 2);
  g.lineStyle(1.5, 0x583118, 0.85);
  g.strokeRoundedRect(6, 7, 52, 7, 2);
  g.strokeRoundedRect(6, 15, 52, 8, 3);
  g.generateTexture('park-bench', 64, 36);

  g.clear();
  g.fillStyle(0x091f24, 0.28);
  g.fillEllipse(22, 54, 26, 10);
  g.fillStyle(0x583118, 1);
  g.fillRoundedRect(19, 10, 6, 45, 2);
  // Directional sign boards
  g.fillStyle(0xe68a36, 1);
  g.fillRoundedRect(4, 14, 34, 9, 2);
  g.fillStyle(0x5f7f6e, 1);
  g.fillRoundedRect(6, 26, 32, 9, 2);
  g.generateTexture('trail-signpost', 44, 62);

  // 12G. Animated Taunus Wildlife (Deer, Fox, Rabbit - 2 frames each)
  [0, 1].forEach((frame) => {
    const stride = frame === 1 ? 3 : -2;

    // Roe Deer (Taunus-Reh)
    g.clear();
    g.fillStyle(0x091f24, 0.25);
    g.fillEllipse(24, 38, 30, 10);
    // Legs
    g.lineStyle(2.5, 0x7c3f18, 1);
    g.lineBetween(15, 26, 15 + stride, 37);
    g.lineBetween(20, 26, 20 - stride, 37);
    g.lineBetween(30, 26, 30 - stride, 37);
    g.lineBetween(34, 26, 34 + stride, 37);
    // Body
    g.fillStyle(0xb86518, 1);
    g.fillEllipse(24, 23, 24, 13);
    // White fawn spots & tail
    g.fillStyle(0xfdf5ee, 0.9);
    g.fillCircle(12, 21, 3.5);
    g.fillCircle(20, 21, 1.5);
    g.fillCircle(25, 23, 1.5);
    // Neck & Head (facing right)
    g.fillStyle(0xb86518, 1);
    g.fillRoundedRect(30, 11, 6, 12, 3);
    g.fillEllipse(36, 12, 11, 8);
    // Ears & small antlers
    g.fillEllipse(33, 6, 4, 7);
    g.lineStyle(1.5, 0x583118, 1);
    g.lineBetween(35, 8, 37, 2);
    g.lineBetween(37, 4, 40, 3);
    // Eye & Nose
    g.fillStyle(0x151718, 1);
    g.fillCircle(38, 11, 1.4);
    g.fillCircle(41, 12, 1.6);
    g.generateTexture(`animal-deer-${frame}`, 48, 44);

    // Red Fox (Rotfuchs)
    g.clear();
    g.fillStyle(0x091f24, 0.24);
    g.fillEllipse(22, 29, 26, 8);
    // Legs
    g.lineStyle(2.2, 0x2a2e30, 1);
    g.lineBetween(15, 21, 15 + stride, 28);
    g.lineBetween(29, 21, 29 - stride, 28);
    // Bushy Tail with white tip
    g.fillStyle(0xd96b27, 1);
    g.fillEllipse(8, 19, 13, 7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 19, 3);
    // Fox Body & Head
    g.fillStyle(0xe68a36, 1);
    g.fillEllipse(22, 19, 20, 10);
    g.fillEllipse(33, 14, 11, 8);
    // Pointed Ears
    g.fillTriangle(30, 10, 32, 4, 35, 10);
    g.fillTriangle(34, 10, 36, 4, 38, 10);
    // White chest & snout
    g.fillStyle(0xffffff, 0.95);
    g.fillEllipse(31, 20, 7, 5);
    g.fillEllipse(36, 16, 6, 3.5);
    g.fillStyle(0x151718, 1);
    g.fillCircle(35, 13, 1.3);
    g.fillCircle(39, 15, 1.5);
    g.generateTexture(`animal-fox-${frame}`, 44, 34);

    // Wild Rabbit (Feldhase)
    g.clear();
    const hopY = frame === 1 ? -3 : 0;
    g.fillStyle(0x091f24, 0.22);
    g.fillEllipse(16, 25, 18, 7);
    // Cotton tail
    g.fillStyle(0xffffff, 1);
    g.fillCircle(7, 18 + hopY, 3);
    // Body & Head
    g.fillStyle(0x94765e, 1);
    g.fillEllipse(15, 18 + hopY, 14, 10);
    g.fillCircle(22, 14 + hopY, 5);
    // Long rabbit ears
    g.fillEllipse(20, 6 + hopY, 3.5, 9);
    g.fillEllipse(23, 7 + hopY, 3.5, 8);
    g.fillStyle(0xfbf0f4, 0.8);
    g.fillEllipse(20, 6 + hopY, 1.5, 6);
    // Eye
    g.fillStyle(0x151718, 1);
    g.fillCircle(24, 13 + hopY, 1.2);
    g.generateTexture(`animal-rabbit-${frame}`, 32, 30);
  });

  // 12H. Animated Taunus Hikers (Wanderer mit Rucksack, Hut & Wanderstock)
  const hikerConfigs = [
    { key: 'hiker-a', jacket: 0xe68a36, pack: 0x174955, hat: 0x5f7f6e },
    { key: 'hiker-b', jacket: 0x00a5b5, pack: 0xb86518, hat: 0x334e54 },
    { key: 'hiker-c', jacket: 0x5f7f6e, pack: 0x7e1946, hat: 0xb86518 },
  ];
  hikerConfigs.forEach((hc) => {
    [0, 1].forEach((frame) => {
      g.clear();
      const cx = 24;
      const stride = frame === 1 ? 3.5 : -3.5;
      // Ground shadow
      g.fillStyle(0x091f24, 0.28);
      g.fillEllipse(cx, 49, 28, 10);
      // Hiking Backpack (Wanderrucksack) visible on back/shoulder
      g.fillStyle(hc.pack, 1);
      g.fillRoundedRect(cx - 15, 18, 10, 18, 4);
      g.lineStyle(1.5, 0x151718, 0.8);
      g.strokeRoundedRect(cx - 15, 18, 10, 18, 4);
      // Sleeping mat roll on top of backpack
      g.fillStyle(0xfdf5ee, 0.9);
      g.fillRoundedRect(cx - 14, 15, 8, 4, 2);

      // Legs & Hiking Boots
      g.fillStyle(0x334e54, 1);
      g.fillRoundedRect(cx - 8, 36 + stride * 0.6, 7, 10, 3);
      g.fillRoundedRect(cx + 1, 36 - stride * 0.6, 7, 10, 3);
      g.fillStyle(0x583118, 1);
      g.fillRoundedRect(cx - 9, 44 + stride * 0.6, 9, 5, 2);
      g.fillRoundedRect(cx + 1, 44 - stride * 0.6, 9, 5, 2);

      // Outdoor Jacket
      g.fillStyle(hc.jacket, 1);
      g.fillRoundedRect(cx - 10, 22, 20, 16, 5);
      g.lineStyle(1.8, 0x151718, 0.85);
      g.strokeRoundedRect(cx - 10, 22, 20, 16, 5);

      // Head & Friendly Face
      g.fillStyle(0xfde4cf, 1);
      g.fillCircle(cx, 14, 10.5);
      g.lineStyle(1.8, 0x151718, 0.85);
      g.strokeCircle(cx, 14, 10.5);
      g.fillStyle(0x151718, 1);
      g.fillCircle(cx - 3.5, 14.5, 1.8);
      g.fillCircle(cx + 4, 14.5, 1.8);

      // Outdoor Hiking Hat / Sun Hat with brim
      g.fillStyle(hc.hat, 1);
      g.fillEllipse(cx, 6, 26, 7);
      g.fillRoundedRect(cx - 8, 1, 16, 6, 3);
      g.lineStyle(1.2, 0xfdf5ee, 0.8);
      g.lineBetween(cx - 7, 6, cx + 7, 6);

      // Wooden Trekking Pole / Walking Stick in right hand
      const stickX = cx + 13 + (frame === 1 ? 2 : -1);
      g.lineStyle(2.5, 0x7c3f18, 1);
      g.lineBetween(stickX, 16, stickX + 2, 48);
      g.fillStyle(0xfde4cf, 1);
      g.fillCircle(stickX, 29, 3);

      g.generateTexture(`${hc.key}-${frame}`, 48, 54);
    });
  });

  // 13. 2.5D Digitales Schwarzes Brett (Interactive Kiosk Stele with Pin Cards)
  g.clear();
  g.fillStyle(0x00a5b5, 0.22);
  g.fillEllipse(48, 56, 86, 26);
  // Base pedestal
  g.fillStyle(0x0f323a, 1);
  g.fillRoundedRect(14, 44, 68, 16, 4);
  // Main upright board frame
  g.fillStyle(0x174955, 1);
  g.fillRoundedRect(8, 4, 80, 46, 6);
  g.lineStyle(3, 0x00a5b5, 1);
  g.strokeRoundedRect(8, 4, 80, 46, 6);
  // Cork / digital screen interior
  g.fillStyle(0x0f323a, 1);
  g.fillRect(13, 9, 70, 36);
  // Pinned B2B cards
  g.fillStyle(0xe68a36, 1);
  g.fillRoundedRect(17, 13, 18, 14, 2);
  g.fillStyle(0x00a5b5, 1);
  g.fillRoundedRect(39, 13, 18, 14, 2);
  g.fillStyle(0x8eae9d, 1);
  g.fillRoundedRect(61, 13, 18, 14, 2);
  g.fillStyle(0xedf5f7, 0.9);
  g.fillRoundedRect(17, 31, 62, 10, 2);
  g.generateTexture('schwarzes-brett-stele', 96, 66);

  // 14. 2.5D Interactive Team Whiteboard Easel
  g.clear();
  g.fillStyle(0x151718, 0.22);
  g.fillEllipse(61, 52, 104, 20);
  // Easel legs
  g.fillStyle(0x2a2e30, 1);
  g.fillRect(20, 40, 6, 14);
  g.fillRect(96, 40, 6, 14);
  // Frame & magnetic tray
  g.fillStyle(0x334e54, 1);
  g.fillRoundedRect(6, 4, 110, 42, 5);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(11, 8, 100, 32, 3);
  // Sticky notes & diagram on whiteboard
  g.fillStyle(0xe68a36, 1);
  g.fillRect(17, 13, 13, 12);
  g.fillStyle(0x00a5b5, 1);
  g.fillRect(34, 13, 13, 12);
  g.fillStyle(0x8eae9d, 1);
  g.fillRect(51, 13, 13, 12);
  g.lineStyle(2.5, 0x7e1946, 0.9);
  g.lineBetween(72, 30, 98, 14);
  g.generateTexture('whiteboard-easel', 122, 58);

  // 15. Steaming Coffee Cup Icon (held in hand)
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(2, 6, 12, 13, 3);
  g.lineStyle(2, 0xb86518, 1);
  g.strokeRoundedRect(2, 6, 12, 13, 3);
  g.fillStyle(0xe68a36, 1);
  g.fillRect(4, 9, 8, 5);
  g.lineStyle(1.5, 0xffffff, 0.9);
  g.lineBetween(5, 4, 6, 1);
  g.lineBetween(10, 4, 11, 1);
  g.generateTexture('coffee-cup-hand', 18, 22);

  // 16. Generate Gather.town-style 4-Directional + Animated + Seated RPG Avatars!
  const directions: Array<'down' | 'up' | 'left' | 'right'> = [
    'down',
    'up',
    'left',
    'right',
  ];

  AVATAR_PALETTE.forEach((swatch) => {
    const colorNum = Phaser.Display.Color.HexStringToColor(swatch.hex).color;
    const darkNum = Phaser.Display.Color.HexStringToColor(swatch.dark).color;
    const hexClean = swatch.hex.replace('#', '').toLowerCase();

    directions.forEach((dir) => {
      // Frame 0 (Idle / Walk step A)
      drawGatherCharacter(g, colorNum, darkNum, dir, 0, false);
      g.generateTexture(`avatar-${hexClean}-${dir}-0`, 48, 54);

      // Frame 1 (Walk step B with alternating legs & swinging arms)
      drawGatherCharacter(g, colorNum, darkNum, dir, 1, false);
      g.generateTexture(`avatar-${hexClean}-${dir}-1`, 48, 54);
    });

    // Seated Pose (when sitting at a desk or chair)
    drawGatherCharacter(g, colorNum, darkNum, 'up', 0, true);
    g.generateTexture(`avatar-${hexClean}-sit`, 48, 54);

    // Default fallback key
    drawGatherCharacter(g, colorNum, darkNum, 'down', 0, false);
    g.generateTexture(`avatar-${hexClean}`, 48, 54);
  });

  g.destroy();
}

/**
 * Draws a Gather.town 2.5D RPG/Chibi character sprite with:
 * - Ground drop shadow
 * - Animated legs & shoes (or seated pose)
 * - Branded jacket/sweater with collar & swinging arms
 * - 3/4 RPG head with hair, ears, and directional face (down, up, left, right)
 */
function drawGatherCharacter(
  g: Phaser.GameObjects.Graphics,
  shirtColor: number,
  darkBorder: number,
  dir: 'down' | 'up' | 'left' | 'right',
  walkFrame: 0 | 1,
  isSeated: boolean
): void {
  g.clear();

  const cx = 24;
  // Ground shadow
  g.fillStyle(0x091f24, 0.28);
  g.fillEllipse(cx, 48, 28, 10);

  // Leg swing offsets during walk animation
  const legOffsetLeft = walkFrame === 1 ? -3 : 0;
  const legOffsetRight = walkFrame === 1 ? 3 : 0;
  const armSwing = walkFrame === 1 ? 2.5 : 0;

  if (isSeated) {
    // Seated legs (tucked onto chair cushion)
    g.fillStyle(0x1e293b, 1);
    g.fillRoundedRect(cx - 10, 36, 8, 9, 3);
    g.fillRoundedRect(cx + 2, 36, 8, 9, 3);
  } else if (dir === 'left' || dir === 'right') {
    // Side profile legs & shoes
    const stride = walkFrame === 1 ? 4 : 0;
    // Back leg
    g.fillStyle(0x1e293b, 1);
    g.fillRoundedRect(cx - 4 - stride, 36, 8, 10, 3);
    g.fillStyle(0x151718, 1);
    g.fillRoundedRect(cx - 5 - stride, 44, 9, 5, 2);
    // Front leg
    g.fillStyle(0x334e54, 1);
    g.fillRoundedRect(cx - 3 + stride, 36, 8, 10, 3);
    g.fillStyle(0x151718, 1);
    g.fillRoundedRect(cx - 4 + stride, 44, 9, 5, 2);
  } else {
    // Front/Back trousers & shoes
    g.fillStyle(0x1e293b, 1);
    g.fillRoundedRect(cx - 10, 36 + legOffsetLeft, 8, 10, 3);
    g.fillRoundedRect(cx + 2, 36 + legOffsetRight, 8, 10, 3);
    // Shoes
    g.fillStyle(0x151718, 1);
    g.fillRoundedRect(cx - 11, 44 + legOffsetLeft, 9, 5, 2.5);
    g.fillRoundedRect(cx + 2, 44 + legOffsetRight, 9, 5, 2.5);
  }

  // Torso / Jacket in chosen Untertaunus brand color
  g.fillStyle(shirtColor, 1);
  g.fillRoundedRect(cx - 12, 22, 24, 17, 6);
  g.lineStyle(2, darkBorder, 1);
  g.strokeRoundedRect(cx - 12, 22, 24, 17, 6);

  // Shirt / Collar detail on front view
  if (dir === 'down') {
    g.fillStyle(0xffffff, 0.92);
    g.fillTriangle(cx - 5, 22, cx + 5, 22, cx, 30);
    // Subtle lanyard / badge on chest
    g.fillStyle(0xe68a36, 1);
    g.fillRoundedRect(cx + 3, 28, 5, 6, 1);
  } else if (dir === 'up') {
    // Hoodie/jacket back seam
    g.lineStyle(1.5, darkBorder, 0.65);
    g.lineBetween(cx, 23, cx, 38);
  }

  // Arms & Hands
  if (dir === 'left') {
    g.fillStyle(shirtColor, 1);
    g.fillRoundedRect(cx - 4 - armSwing, 24, 8, 12, 4);
    g.lineStyle(1.5, darkBorder, 1);
    g.strokeRoundedRect(cx - 4 - armSwing, 24, 8, 12, 4);
    g.fillStyle(0xfde4cf, 1);
    g.fillCircle(cx - armSwing, 36, 3.2);
  } else if (dir === 'right') {
    g.fillStyle(shirtColor, 1);
    g.fillRoundedRect(cx - 4 + armSwing, 24, 8, 12, 4);
    g.lineStyle(1.5, darkBorder, 1);
    g.strokeRoundedRect(cx - 4 + armSwing, 24, 8, 12, 4);
    g.fillStyle(0xfde4cf, 1);
    g.fillCircle(cx + armSwing, 36, 3.2);
  } else {
    // Left & Right arms
    g.fillStyle(shirtColor, 1);
    g.fillRoundedRect(cx - 16, 23 - armSwing, 6, 12, 3);
    g.fillRoundedRect(cx + 10, 23 + armSwing, 6, 12, 3);
    g.lineStyle(1.5, darkBorder, 1);
    g.strokeRoundedRect(cx - 16, 23 - armSwing, 6, 12, 3);
    g.strokeRoundedRect(cx + 10, 23 + armSwing, 6, 12, 3);
    // Hands
    g.fillStyle(0xfde4cf, 1);
    g.fillCircle(cx - 13, 35 - armSwing, 3);
    g.fillCircle(cx + 13, 35 + armSwing, 3);
  }

  // Head (3/4 RPG Chibi proportion)
  const headY = 14;
  // Ears (front/up)
  if (dir === 'down' || dir === 'up') {
    g.fillStyle(0xfde4cf, 1);
    g.fillCircle(cx - 12, headY + 1, 3.2);
    g.fillCircle(cx + 12, headY + 1, 3.2);
  }

  // Skin head base
  g.fillStyle(0xfde4cf, 1);
  g.fillCircle(cx, headY, 11.5);
  g.lineStyle(2, 0x151718, 0.85);
  g.strokeCircle(cx, headY, 11.5);

  // Hair & Facial Features by Direction
  if (dir === 'up') {
    // Full back of hair covering the head when walking up or seated facing north
    g.fillStyle(darkBorder, 1);
    g.fillCircle(cx, headY - 1, 11.5);
    g.fillRoundedRect(cx - 11, headY - 4, 22, 12, 5);
    g.lineStyle(2, 0x151718, 0.85);
    g.strokeCircle(cx, headY - 1, 11.5);
  } else if (dir === 'left') {
    // Hair cap facing left
    g.fillStyle(darkBorder, 1);
    g.slice(
      cx,
      headY - 1,
      11.8,
      Phaser.Math.DegToRad(160),
      Phaser.Math.DegToRad(30),
      false
    );
    g.fillPath();
    // Sideburns / back hair
    g.fillRoundedRect(cx + 1, headY - 6, 10, 14, 4);
    // Left-facing eye & eyebrow
    g.fillStyle(0x151718, 1);
    g.fillCircle(cx - 6, headY + 1, 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 6.6, headY + 0.4, 0.7);
  } else if (dir === 'right') {
    // Hair cap facing right
    g.fillStyle(darkBorder, 1);
    g.slice(
      cx,
      headY - 1,
      11.8,
      Phaser.Math.DegToRad(150),
      Phaser.Math.DegToRad(20),
      false
    );
    g.fillPath();
    g.fillRoundedRect(cx - 11, headY - 6, 10, 14, 4);
    // Right-facing eye
    g.fillStyle(0x151718, 1);
    g.fillCircle(cx + 6, headY + 1, 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + 6.6, headY + 0.4, 0.7);
  } else {
    // Front ('down') hair & friendly RPG face
    g.fillStyle(darkBorder, 1);
    g.slice(
      cx,
      headY - 2,
      11.8,
      Phaser.Math.DegToRad(185),
      Phaser.Math.DegToRad(355),
      false
    );
    g.fillPath();
    // Expressive eyes with white catchlights
    g.fillStyle(0x151718, 1);
    g.fillCircle(cx - 4.5, headY + 1.5, 2.1);
    g.fillCircle(cx + 4.5, headY + 1.5, 2.1);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 5.1, headY + 0.8, 0.8);
    g.fillCircle(cx + 3.9, headY + 0.8, 0.8);
    // Subtle warm cheeks & smile
    g.fillStyle(0xe68a36, 0.35);
    g.fillCircle(cx - 7.5, headY + 4, 2);
    g.fillCircle(cx + 7.5, headY + 4, 2);
    g.lineStyle(1.4, 0x151718, 0.75);
    g.lineBetween(cx - 2.5, headY + 5.5, cx + 2.5, headY + 5.5);
  }
}

/**
 * Draws a 2.5D Gather.town-style Ergonomic Office Chair with caster wheels, seat thickness & backrest.
 */
function drawOfficeChair(
  g: Phaser.GameObjects.Graphics,
  occupied: boolean
): void {
  g.clear();
  // Floor shadow
  g.fillStyle(0x151718, 0.24);
  g.fillEllipse(20, 35, 28, 12);
  // 5-star caster base & legs underneath
  g.lineStyle(2.5, 0x2a2e30, 1);
  g.lineBetween(20, 26, 20, 35);
  g.lineBetween(11, 35, 29, 35);
  g.fillStyle(0x151718, 1);
  g.fillCircle(11, 36, 2);
  g.fillCircle(20, 37, 2);
  g.fillCircle(29, 36, 2);
  // Seat cushion (3/4 view)
  g.fillStyle(occupied ? 0xb86518 : 0x334e54, 1);
  g.fillRoundedRect(7, 15, 26, 15, 6);
  g.fillStyle(occupied ? 0xe68a36 : 0x5f7f6e, 1);
  g.fillRoundedRect(8, 13, 24, 13, 5);
  // Armrests
  g.fillStyle(0x151718, 1);
  g.fillRoundedRect(5, 16, 4, 10, 2);
  g.fillRoundedRect(31, 16, 4, 10, 2);
  // Curved ergonomic backrest (south side of chair since chair faces north desk)
  g.fillStyle(occupied ? 0xb86518 : 0x174955, 1);
  g.fillRoundedRect(8, 24, 24, 8, 4);
  g.lineStyle(1.5, occupied ? 0xffffff : 0x0f323a, 0.9);
  g.strokeRoundedRect(8, 24, 24, 8, 4);
}

/**
 * Draws a 2.5D Gather.town-style Coworking Desk with:
 * - Visible front desk thickness & dark metal legs
 * - Dual monitors on stands
 * - Desk lamp on the left that illuminates with a warm golden glow cone when `occupied === true`
 * - Keyboard, mouse, notepad, and coffee mug
 */
function drawCoworkingDesk(
  g: Phaser.GameObjects.Graphics,
  occupied: boolean
): void {
  g.clear();
  // Floor drop shadow under desk
  g.fillStyle(0x091f24, occupied ? 0.3 : 0.2);
  g.fillRoundedRect(4, 16, 116, 60, 8);

  // Desk metal legs (left & right)
  g.fillStyle(0x151718, 1);
  g.fillRect(8, 56, 7, 18);
  g.fillRect(109, 56, 7, 18);
  g.fillStyle(0x334e54, 1);
  g.fillRect(14, 56, 4, 12);
  g.fillRect(106, 56, 4, 12);

  if (occupied) {
    // 3D front edge of tabletop (Warm-Amber)
    g.fillStyle(0xb86518, 1);
    g.fillRoundedRect(2, 12, 120, 52, 7);

    // Illuminated tabletop surface
    g.fillStyle(0xfdf5ee, 1);
    g.fillRoundedRect(2, 4, 120, 50, 7);
    g.fillStyle(0xe68a36, 0.25);
    g.fillRoundedRect(4, 6, 116, 46, 6);
    g.lineStyle(3, 0xe68a36, 1);
    g.strokeRoundedRect(2, 4, 120, 50, 7);

    // Desk mat in Deep Taunus-Petrol with Cyan trim
    g.fillStyle(0x174955, 0.95);
    g.fillRoundedRect(28, 22, 68, 26, 4);
    g.lineStyle(1.5, 0x00a5b5, 1);
    g.strokeRoundedRect(28, 22, 68, 26, 4);
  } else {
    // 3D front edge of tabletop (Warm oak / slate edge)
    g.fillStyle(0x334e54, 1);
    g.fillRoundedRect(2, 12, 120, 52, 7);

    // Crisp light tabletop surface
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(2, 4, 120, 50, 7);
    g.lineStyle(2, 0x4b6f77, 1);
    g.strokeRoundedRect(2, 4, 120, 50, 7);

    // Subtle sage desk pad
    g.fillStyle(0x8eae9d, 0.28);
    g.fillRoundedRect(28, 22, 68, 26, 4);
  }

  // Dual Widescreen Monitors with stands at north edge of desk
  g.fillStyle(0x2a2e30, 1);
  g.fillRect(38, 14, 8, 5);
  g.fillRect(78, 14, 8, 5);
  g.fillStyle(0x151718, 1);
  g.fillRoundedRect(24, 5, 36, 11, 2);
  g.fillRoundedRect(64, 5, 36, 11, 2);

  if (occupied) {
    // Glowing active dual monitors (Code & Analytics)
    g.fillStyle(0x00a5b5, 1);
    g.fillRect(26, 8, 32, 6);
    g.fillStyle(0xe68a36, 1);
    g.fillRect(66, 8, 32, 6);
    // Screen glow reflection on desk
    g.fillStyle(0x00a5b5, 0.18);
    g.fillEllipse(42, 20, 30, 8);
  } else {
    // Standby dark screens
    g.fillStyle(0x334e54, 0.6);
    g.fillRect(26, 9, 32, 4);
    g.fillRect(66, 9, 32, 4);
  }

  // Desk Lamp on top-left corner (turns ON with golden light cone when occupied!)
  if (occupied) {
    g.fillStyle(0xe68a36, 0.38);
    g.fillCircle(16, 20, 14);
  }
  g.fillStyle(0x2a2e30, 1);
  g.fillCircle(12, 12, 4.5);
  g.fillStyle(occupied ? 0xe68a36 : 0x4b6f77, 1);
  g.fillCircle(14, 14, 4);

  // Mechanical Keyboard & Mouse on desk mat
  g.fillStyle(occupied ? 0xebf9fb : 0x4b6f77, 0.95);
  g.fillRoundedRect(44, 28, 28, 10, 2);
  g.fillCircle(80, 33, 3.2);

  // Small notepad & pen on right side
  g.fillStyle(0xfdf5ee, 0.95);
  g.fillRoundedRect(100, 26, 14, 18, 2);
  g.lineStyle(1, 0x4b6f77, 0.6);
  g.strokeRoundedRect(100, 26, 14, 18, 2);

  // Coffee Mug on bottom-left corner
  g.fillStyle(occupied ? 0x00a5b5 : 0xe68a36, 1);
  g.fillCircle(15, 42, 4.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(15, 42, 2.5);
}
