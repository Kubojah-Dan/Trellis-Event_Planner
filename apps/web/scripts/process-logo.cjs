const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inputPath = path.resolve(__dirname, '../public/assets/img/logo.png');
const outputPath = path.resolve(__dirname, '../public/assets/img/logo.png');
const backupPath = path.resolve(__dirname, '../public/assets/img/logo-original.png');

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(inputPath, backupPath);
}

fs.createReadStream(backupPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    let minX = this.width, minY = this.height, maxX = 0, maxY = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        // Max color component
        const maxVal = Math.max(r, g, b);

        if (maxVal < 18) {
          // Pure or near-pure black
          this.data[idx + 3] = 0;
        } else if (maxVal < 45) {
          // Feathered edge: compute alpha from 0 to 1
          const alpha = (maxVal - 18) / (45 - 18);
          this.data[idx + 3] = Math.round(alpha * 255);
          // De-halo: boost color values back up so edge isn't dark
          const factor = Math.max(1, 1 / Math.max(0.2, alpha));
          this.data[idx] = Math.min(255, Math.round(r * factor));
          this.data[idx + 1] = Math.min(255, Math.round(g * factor));
          this.data[idx + 2] = Math.min(255, Math.round(b * factor));
        }

        if (this.data[idx + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    console.log(`Bounding box: x=${minX}..${maxX}, y=${minY}..${maxY}`);
    
    // Crop to bounding box with small padding
    const pad = 12;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(this.width - cropX, (maxX - minX + 1) + pad * 2);
    const cropH = Math.min(this.height - cropY, (maxY - minY + 1) + pad * 2);

    const cropped = new PNG({ width: cropW, height: cropH });
    for (let cy = 0; cy < cropH; cy++) {
      for (let cx = 0; cx < cropW; cx++) {
        const srcIdx = (this.width * (cropY + cy) + (cropX + cx)) << 2;
        const dstIdx = (cropW * cy + cx) << 2;
        cropped.data[dstIdx] = this.data[srcIdx];
        cropped.data[dstIdx + 1] = this.data[srcIdx + 1];
        cropped.data[dstIdx + 2] = this.data[srcIdx + 2];
        cropped.data[dstIdx + 3] = this.data[srcIdx + 3];
      }
    }

    cropped.pack()
      .pipe(fs.createWriteStream(outputPath))
      .on('finish', () => {
        console.log(`Successfully saved transparent cropped logo: ${cropW}x${cropH} at ${outputPath}`);
      });
  });
