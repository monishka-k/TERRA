/**
 * Procedural Earth Textures for SETU-DRR 3D WebGL Globe
 * Creates dark emerald & obsidian cartographic textures without circular artifacts
 */

export function generateProceduralEarthCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Deep Void-Ocean Base Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
  oceanGrad.addColorStop(0, '#06110a');
  oceanGrad.addColorStop(0.3, '#091810');
  oceanGrad.addColorStop(0.5, '#0c2217');
  oceanGrad.addColorStop(0.7, '#091810');
  oceanGrad.addColorStop(1, '#06110a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  // 2. High-Tech Cyber Graticule Grid
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.07)';
  ctx.lineWidth = 1;
  for (let lat = 0; lat <= 1024; lat += 64) {
    ctx.beginPath();
    ctx.moveTo(0, lat);
    ctx.lineTo(2048, lat);
    ctx.stroke();
  }
  for (let lon = 0; lon <= 2048; lon += 64) {
    ctx.beginPath();
    ctx.moveTo(lon, 0);
    ctx.lineTo(lon, 1024);
    ctx.stroke();
  }

  // Major Equator & Tropic Lines
  ctx.strokeStyle = 'rgba(212, 241, 93, 0.15)';
  ctx.lineWidth = 1.5;
  // Equator
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(2048, 512);
  ctx.stroke();

  // 3. Continent Polygons & Topographic Landmasses
  ctx.fillStyle = '#14281e';
  ctx.strokeStyle = '#27523d';
  ctx.lineWidth = 2.5;

  const drawPath = (points: [number, number][]) => {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Eurasia & India
  drawPath([
    [1050, 280], [1200, 240], [1450, 220], [1750, 250], [1850, 340],
    [1800, 480], [1650, 520], [1520, 580], [1460, 480], [1410, 520],
    [1360, 420], [1280, 480], [1200, 430], [1120, 470], [1040, 380]
  ]);

  // Indian Subcontinent Detail
  drawPath([
    [1390, 440], [1450, 440], [1460, 530], [1430, 600], [1400, 550], [1370, 490]
  ]);

  // Africa
  drawPath([
    [1020, 430], [1160, 420], [1230, 510], [1250, 620], [1190, 770],
    [1140, 830], [1100, 780], [1050, 640], [980, 550], [1000, 480]
  ]);

  // North America
  drawPath([
    [300, 220], [450, 200], [600, 250], [680, 350], [620, 440],
    [540, 480], [480, 560], [420, 520], [380, 420], [280, 340]
  ]);

  // South America
  drawPath([
    [480, 560], [560, 550], [660, 620], [680, 720], [620, 840],
    [560, 930], [520, 880], [480, 740], [460, 640]
  ]);

  // Australia
  drawPath([
    [1680, 680], [1780, 660], [1840, 720], [1830, 820], [1760, 860],
    [1690, 820], [1660, 740]
  ]);

  // 4. Subtle Golden / Citron Night Lights on Landmasses
  ctx.fillStyle = 'rgba(212, 241, 93, 0.45)';
  const lights = [
    [1420, 480], [1440, 510], [1410, 530], [1430, 560], [1450, 500],
    [1300, 360], [1320, 380], [1340, 370], [1250, 340], [1220, 330],
    [1680, 360], [1720, 380], [1750, 410], [520, 340], [560, 370],
    [580, 390], [500, 380], [460, 400], [600, 700], [620, 740]
  ];

  lights.forEach(([x, y]) => {
    ctx.fillRect(x, y, 2.5, 2.5);
    ctx.fillRect(x + 3, y + 1, 1.5, 1.5);
  });

  return canvas;
}
