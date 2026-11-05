import { deflateRawSync, deflateSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "teams");
const outputDir = join(root, "dist", "teams");
const packageDir = join(outputDir, "ProjectDashboard");
const packagePath = join(outputDir, "project-dashboard-teams.zip");

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function createPng(width, height, pixel) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) pixel(x, y).copy(row, 1 + x * 4);
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(Buffer.concat(rows))), pngChunk("IEND", Buffer.alloc(0))]);
}

function createZip(entries) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const { name, contents } of entries) {
    const fileName = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(contents);
    const checksum = crc32(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, fileName, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, fileName);
    offset += local.length + fileName.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

function insideRoundedRect(x, y, size, margin, radius) {
  const left = margin;
  const right = size - margin - 1;
  const top = margin;
  const bottom = size - margin - 1;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function colorIcon() {
  const teal = Buffer.from([15, 118, 110, 255]);
  const mint = Buffer.from([94, 234, 212, 255]);
  const white = Buffer.from([255, 255, 255, 255]);
  const transparent = Buffer.from([0, 0, 0, 0]);
  return createPng(192, 192, (x, y) => {
    if (!insideRoundedRect(x, y, 192, 0, 36)) return transparent;
    if (x > 45 && x < 147 && y > 45 && y < 147 && ((x - 96) ** 2 + (y - 96) ** 2) < 48 ** 2) return mint;
    if ((x > 68 && x < 124 && y > 76 && y < 88) || (x > 68 && x < 112 && y > 100 && y < 112)) return white;
    return teal;
  });
}

function outlineIcon() {
  const white = Buffer.from([255, 255, 255, 255]);
  const transparent = Buffer.from([0, 0, 0, 0]);
  return createPng(32, 32, (x, y) => {
    const frame = x >= 4 && x <= 27 && y >= 4 && y <= 27 && (x <= 6 || x >= 25 || y <= 6 || y >= 25);
    const lineOne = x >= 10 && x <= 23 && y >= 11 && y <= 13;
    const lineTwo = x >= 10 && x <= 19 && y >= 17 && y <= 19;
    return frame || lineOne || lineTwo ? white : transparent;
  });
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(packageDir, { recursive: true });
cpSync(join(sourceDir, "manifest.json"), join(packageDir, "manifest.json"));
writeFileSync(join(packageDir, "icon-color.png"), colorIcon());
writeFileSync(join(packageDir, "icon-outline.png"), outlineIcon());
writeFileSync(packagePath, createZip([
  { name: "manifest.json", contents: readFileSync(join(packageDir, "manifest.json")) },
  { name: "icon-color.png", contents: readFileSync(join(packageDir, "icon-color.png")) },
  { name: "icon-outline.png", contents: readFileSync(join(packageDir, "icon-outline.png")) },
]));

if (!existsSync(packagePath) || readFileSync(packagePath).length === 0) throw new Error("Teams package was not created.");
console.log(packagePath);
