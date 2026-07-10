const fs = require('fs');
const path = require('path');
const Jimp = require(require.resolve('jimp-compact', {
  paths: [require.resolve('@expo/image-utils')],
}));

const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'assets', 'adaptive-icon.png');
const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

// Fracción del lienzo (108dp) que ocupa el contenido por su lado mayor.
// OJO: el launcher solo muestra el centro (~72dp de los 108) y le hace zoom,
// así que el tamaño VISIBLE es ~contenido/0.66. Para que se vea pequeño con
// aire, el contenido debe ser ~0.40 del lienzo (no 0.66, que llenaba el
// viewport borde a borde).
const SCALE = 0.52;

// El check amarillo sobresale por encima de la pesa, así que centrar la caja
// del contenido dejaría la pesa baja. En su lugar centramos la PESA (los
// píxeles blancos): se calcula la franja vertical blanca y se coloca su centro
// en el centro del lienzo.
function whiteVerticalCenter(img) {
  const { data, width, height } = img.bitmap;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      // Blanco de la pesa: alfa alto y RGB altos (excluye el check amarillo, B bajo).
      if (a > 128 && r > 180 && g > 180 && b > 180) {
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (minY === Infinity) return height / 2; // fallback: centro de la caja
  return (minY + maxY) / 2;
}

// Dimensiones actuales por densidad (px del lienzo completo).
const densities = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const BLACK = 0x000000ff;
const TRANSPARENT = 0x00000000;

(async () => {
  // Contenido recortado a su caja real (quita el margen transparente del asset).
  const base = await Jimp.read(src);
  base.autocrop();

  for (const [d, size] of Object.entries(densities)) {
    const dir = path.join(resDir, `mipmap-${d}`);

    // Escalar el contenido a SCALE del lienzo por su lado mayor, manteniendo aspecto.
    const target = Math.round(size * SCALE);
    const content = base.clone();
    if (content.bitmap.width >= content.bitmap.height) {
      content.resize(target, Jimp.AUTO);
    } else {
      content.resize(Jimp.AUTO, target);
    }
    const x = Math.round((size - content.bitmap.width) / 2);
    // Centrar la pesa (blanco), no la caja: su centro vertical va al centro.
    const y = Math.round(size / 2 - whiteVerticalCenter(content));

    // Foreground adaptativo: contenido centrado sobre lienzo transparente.
    const fg = new Jimp(size, size, TRANSPARENT);
    fg.composite(content, x, y);
    fs.writeFileSync(
      path.join(dir, 'ic_launcher_foreground.png'),
      await fg.getBufferAsync(Jimp.MIME_PNG)
    );

    // Icono legacy (pre-Android 8): mismo contenido sobre negro.
    const legacy = new Jimp(size, size, BLACK);
    legacy.composite(content, x, y);
    fs.writeFileSync(
      path.join(dir, 'ic_launcher.png'),
      await legacy.getBufferAsync(Jimp.MIME_PNG)
    );

    console.log(`mipmap-${d}: lienzo ${size}, contenido ${content.bitmap.width}x${content.bitmap.height}`);
  }
  console.log(`Iconos regenerados (SCALE=${SCALE}) desde assets/adaptive-icon.png`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
