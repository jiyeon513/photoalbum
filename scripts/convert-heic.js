const fs = require("fs");
const path = require("path");
const convert = require("heic-convert");
const sizeOf = require("image-size");

const ROOT = path.join(__dirname, "..");
const PHOTOS_JSON = path.join(ROOT, "photos.json");

function isHeicBuffer(buffer) {
  if (buffer.length < 12) return false;
  if (buffer.slice(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = buffer.slice(8, 12).toString("ascii");
  return ["heic", "heix", "mif1", "msf1"].some((b) => brand.startsWith(b));
}

function isHeicFile(filePath) {
  if (/\.heic$/i.test(filePath)) return true;
  const buffer = fs.readFileSync(filePath);
  return isHeicBuffer(buffer);
}

function getRatio(width, height) {
  if (width > height * 1.15) return "wide";
  if (height > width * 1.15) return "tall";
  return "square";
}

async function convertFile(filePath) {
  const input = fs.readFileSync(filePath);
  const output = await convert({ buffer: input, format: "JPEG", quality: 0.9 });
  const ext = path.extname(filePath);
  const outPath = ext ? filePath.replace(/\.heic$/i, ".jpg") : `${filePath}.jpg`;

  fs.writeFileSync(outPath, Buffer.from(output));
  fs.unlinkSync(filePath);
  return outPath;
}

function buildPhotoEntry(folder, fileName, filePath) {
  const { width, height } = sizeOf(filePath);
  const src = `${folder}/${fileName}`.replace(/\\/g, "/");
  return {
    name: fileName,
    src,
    ratio: getRatio(width, height),
    width,
    height,
  };
}

async function main() {
  const albumKey = process.argv[2] || "손주들";
  const photosJson = JSON.parse(fs.readFileSync(PHOTOS_JSON, "utf8"));
  const album = photosJson.albums[albumKey];

  if (!album) {
    console.error(`앨범을 찾을 수 없습니다: ${albumKey}`);
    process.exit(1);
  }

  const targetDir = path.join(ROOT, album.folder);
  const files = fs.readdirSync(targetDir).map((name) => path.join(targetDir, name));
  const heicFiles = files.filter((filePath) => {
    try {
      return fs.statSync(filePath).isFile() && isHeicFile(filePath);
    } catch {
      return false;
    }
  });

  console.log(`[${albumKey}] HEIC 파일 ${heicFiles.length}개 변환 시작...`);

  for (const filePath of heicFiles) {
    const outPath = await convertFile(filePath);
    console.log(`변환: ${path.basename(outPath)}`);
  }

  const jpgFiles = fs
    .readdirSync(targetDir)
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "ko"));

  album.photos = jpgFiles.map((name) =>
    buildPhotoEntry(album.folder, name, path.join(targetDir, name))
  );

  fs.writeFileSync(PHOTOS_JSON, `${JSON.stringify(photosJson, null, 2)}\n`, "utf8");
  console.log(`photos.json 업데이트: ${albumKey} 앨범 ${jpgFiles.length}장`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
