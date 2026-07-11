const CARD_ALBUM_ID = "카드";

const homeView = document.getElementById("home-view");
const albumView = document.getElementById("album-view");
const app = document.querySelector(".app");
const galleryTitle = document.querySelector(".gallery-title");
const masonry = document.querySelector(".masonry");
const cardGrid = document.querySelector(".card-grid");
const backBtn = document.querySelector(".gallery-back");
const galleryAddBtn = document.querySelector(".gallery-add");
const addPhotoMenu = document.querySelector(".add-photo-menu");
const addCardMenu = document.querySelector(".add-card-menu");
const cameraInput = document.getElementById("camera-input");
const galleryInput = document.getElementById("gallery-input");
const galleryScroll = document.querySelector(".gallery-scroll");
const photoDetail = document.querySelector(".photo-detail");
const photoDetailImg = document.querySelector(".photo-detail-img");
const photoSaveBtn = document.querySelector(".photo-save-btn");
const photoDeleteBtn = document.querySelector(".photo-delete-btn");
const letterCompose = document.querySelector(".letter-compose");
const letterToInput = document.getElementById("letter-to-input");
const letterInput = document.getElementById("letter-input");
const letterFromInput = document.getElementById("letter-from-input");
const letterCreateBtn = document.getElementById("letter-create-btn");
const letterRead = document.querySelector(".letter-read");
const letterReadTo = document.querySelector(".letter-read-to");
const letterReadText = document.querySelector(".letter-read-text");
const letterReadFrom = document.querySelector(".letter-read-from");
const letterDeleteBtn = document.querySelector(".letter-delete-btn");

const DB_NAME = "photoalbum";
const DB_VERSION = 2;
const LETTER_STORE = "letters";
const HIDDEN_PHOTOS_KEY = "hiddenPhotos";

let photoData = null;
let activeAlbumId = "";
let activePhotos = [];
let albumStaticPhotos = [];
let sharedPhotosUnsubscribe = null;
let activeLetters = [];
let activeLetter = null;
let currentPhotoIndex = -1;
let galleryScrollTop = 0;
let isPhotoDetailOpen = false;
let isLetterComposeOpen = false;
let isLetterReadOpen = false;
let touchStartX = 0;
let touchStartY = 0;

async function loadPhotos() {
  const res = await fetch("photos.json");
  photoData = await res.json();
}

function isCardMode() {
  return activeAlbumId === CARD_ALBUM_ID;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(LETTER_STORE)) {
        const store = db.createObjectStore(LETTER_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getHiddenPhotos(albumId) {
  const all = JSON.parse(localStorage.getItem(HIDDEN_PHOTOS_KEY) || "{}");
  return new Set(all[albumId] || []);
}

function hideAlbumPhoto(albumId, src) {
  const all = JSON.parse(localStorage.getItem(HIDDEN_PHOTOS_KEY) || "{}");
  if (!all[albumId]) all[albumId] = [];
  if (!all[albumId].includes(src)) all[albumId].push(src);
  localStorage.setItem(HIDDEN_PHOTOS_KEY, JSON.stringify(all));
}

function filterHiddenPhotos(albumId, photos) {
  const hidden = getHiddenPhotos(albumId);
  return photos.filter((photo) => !hidden.has(photo.src));
}

function stopSharedPhotosListener() {
  if (sharedPhotosUnsubscribe) {
    sharedPhotosUnsubscribe();
    sharedPhotosUnsubscribe = null;
  }
}

function mergeAlbumPhotos(albumId, sharedPhotos) {
  return sortPhotosNewestFirst([...sharedPhotos, ...albumStaticPhotos].filter(
    (photo) => !getHiddenPhotos(albumId).has(photo.src)
  ));
}

function refreshSharedGallery(sharedPhotos) {
  activePhotos = mergeAlbumPhotos(activeAlbumId, sharedPhotos);
  renderGallery(activePhotos);

  if (!isPhotoDetailOpen) return;

  if (activePhotos.length === 0) {
    closePhotoDetail();
    return;
  }

  showPhotoAtIndex(Math.min(currentPhotoIndex, activePhotos.length - 1));
}

async function loadLetters() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LETTER_STORE, "readonly");
    const store = tx.objectStore(LETTER_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearAllLetters() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LETTER_STORE, "readwrite");
    const store = tx.objectStore(LETTER_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveLetter(letter) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LETTER_STORE, "readwrite");
    const store = tx.objectStore(LETTER_STORE);
    const request = store.add({
      to: letter.to,
      from: letter.from,
      content: letter.content,
      createdAt: Date.now(),
    });

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteLetter(id) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LETTER_STORE, "readwrite");
    const request = tx.objectStore(LETTER_STORE).delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getRatio(width, height) {
  if (width > height * 1.15) return "wide";
  if (height > width * 1.15) return "tall";
  return "square";
}

function isImageFile(file) {
  if (file.type.startsWith("image/")) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

function isHeicFile(file) {
  return (
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name) ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

async function normalizeImageFile(file) {
  if (!isHeicFile(file) || typeof heic2any === "undefined") return file;

  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const jpegBlob = Array.isArray(blob) ? blob[0] : blob;
  const name = file.name.replace(/\.heif?$/i, ".jpg");

  return new File([jpegBlob], name, { type: "image/jpeg" });
}

function readImageMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        name: file.name,
        src: url,
        ratio: getRatio(img.naturalWidth, img.naturalHeight),
        width: img.naturalWidth,
        height: img.naturalHeight,
        userAdded: true,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };

    img.src = url;
  });
}

function formatLetterDate(createdAt) {
  const date = new Date(createdAt);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatLetterTitle(letter) {
  const to = letter.to || "받는 사람";
  const from = letter.from || "보내는 사람";
  return `To. ${to} From. ${from} ${formatLetterDate(letter.createdAt)}`;
}

function getPhotoSortKey(photo) {
  const label = photo.name || photo.src || "";
  const yearMatch = label.match(/(\d{4})/);
  return yearMatch ? Number(yearMatch[1]) : 0;
}

function sortPhotosNewestFirst(photos) {
  const userAdded = photos.filter((photo) => photo.userAdded);
  const albumPhotos = photos.filter((photo) => !photo.userAdded);

  albumPhotos.sort((a, b) => {
    const yearDiff = getPhotoSortKey(b) - getPhotoSortKey(a);
    if (yearDiff !== 0) return yearDiff;
    return (b.name || b.src).localeCompare(a.name || a.src, "ko");
  });

  return [...userAdded, ...albumPhotos];
}

function createEnvelopeIcon() {
  const icon = document.createElement("div");
  icon.className = "card-envelope-icon";
  icon.innerHTML = `
    <div class="card-envelope-flap" aria-hidden="true"></div>
    <div class="card-envelope-fold-left" aria-hidden="true"></div>
    <div class="card-envelope-fold-right" aria-hidden="true"></div>
    <span class="card-envelope-heart" aria-hidden="true">♥</span>
  `;
  return icon;
}

function renderGallery(photos) {
  masonry.classList.remove("view--hidden");
  cardGrid.classList.add("view--hidden");
  cardGrid.replaceChildren();
  const fragment = document.createDocumentFragment();

  photos.forEach((photo, i) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `masonry-item masonry-item--${photo.ratio || "square"}`;

    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.name || `${activeAlbumId} 사진 ${i + 1}`;
    img.loading = i < 6 ? "eager" : "lazy";
    img.decoding = "async";
    img.fetchPriority = i < 4 ? "auto" : "low";

    if (photo.width && photo.height) {
      img.width = photo.width;
      img.height = photo.height;
    }

    img.addEventListener("error", () => item.remove());
    item.addEventListener("click", () => openPhoto(i));
    item.appendChild(img);
    fragment.appendChild(item);
  });

  masonry.replaceChildren(fragment);
}

function renderCardGrid(letters) {
  masonry.classList.add("view--hidden");
  masonry.replaceChildren();
  cardGrid.classList.remove("view--hidden");
  const fragment = document.createDocumentFragment();

  letters.forEach((letter, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "card-item";
    item.appendChild(createEnvelopeIcon());

    const label = document.createElement("span");
    label.className = "card-item-label";
    label.textContent = formatLetterTitle(letter);
    item.appendChild(label);

    item.addEventListener("click", () => openLetterRead(letter));
    fragment.appendChild(item);
  });

  cardGrid.replaceChildren(fragment);
}

function setAlbumMode(cardMode) {
  albumView.classList.toggle("album-view--cards", cardMode);
}

async function openAlbum(albumId) {
  const album = photoData?.albums?.[albumId];
  if (!album) return;

  stopSharedPhotosListener();
  activeAlbumId = albumId;
  galleryTitle.textContent = albumId;
  closePhotoDetail();
  closeLetterCompose();
  closeLetterRead();
  closeAddMenu();

  if (albumId === CARD_ALBUM_ID) {
    albumStaticPhotos = [];
    activeLetters = await loadLetters();
    activePhotos = [];
    setAlbumMode(true);
    renderCardGrid(activeLetters);
  } else {
    albumStaticPhotos = album.photos;
    activeLetters = [];
    setAlbumMode(false);

    if (SharedPhotos.isEnabled()) {
      activePhotos = mergeAlbumPhotos(albumId, []);
      renderGallery(activePhotos);
      sharedPhotosUnsubscribe = SharedPhotos.subscribe(albumId, refreshSharedGallery);
    } else {
      activePhotos = mergeAlbumPhotos(albumId, []);
      renderGallery(activePhotos);
    }
  }

  homeView.classList.add("view--hidden");
  albumView.classList.remove("view--hidden");
  app.classList.add("app--album");
  galleryScroll.scrollTop = 0;
  galleryScroll.classList.remove("view--hidden");
}

function closeAlbum() {
  stopSharedPhotosListener();
  closePhotoDetail();
  closeLetterCompose();
  closeLetterRead();
  closeAddMenu();
  masonry.replaceChildren();
  cardGrid.replaceChildren();
  cardGrid.classList.add("view--hidden");
  masonry.classList.remove("view--hidden");
  albumView.classList.add("view--hidden");
  homeView.classList.remove("view--hidden");
  app.classList.remove("app--album");
  setAlbumMode(false);
  activeAlbumId = "";
  activePhotos = [];
  albumStaticPhotos = [];
  activeLetters = [];
}

function setDetailMode(isOpen) {
  isPhotoDetailOpen = isOpen;
  albumView.classList.toggle("album-view--detail", isOpen || isLetterReadOpen);
}

function showPhotoAtIndex(index) {
  if (index < 0 || index >= activePhotos.length) return;

  const photo = activePhotos[index];
  currentPhotoIndex = index;
  galleryTitle.textContent = photo.name || activeAlbumId;
  photoDetailImg.src = photo.src;
  photoDetailImg.alt = photo.name || activeAlbumId;
}

function openPhoto(index) {
  galleryScrollTop = galleryScroll.scrollTop;
  setDetailMode(true);
  showPhotoAtIndex(index);
  galleryScroll.classList.add("view--hidden");
  photoDetail.classList.remove("view--hidden");
}

function closePhotoDetail() {
  if (!isPhotoDetailOpen) return;

  isPhotoDetailOpen = false;
  if (!isLetterReadOpen) {
    albumView.classList.remove("album-view--detail");
  }
  currentPhotoIndex = -1;
  galleryTitle.textContent = activeAlbumId;
  photoDetail.classList.add("view--hidden");
  galleryScroll.classList.remove("view--hidden");
  photoDetailImg.removeAttribute("src");
  photoDetailImg.alt = "";
  galleryScroll.scrollTop = galleryScrollTop;
}

function resetLetterCompose() {
  letterToInput.value = "";
  letterInput.value = "";
  letterFromInput.value = "";
}

function openLetterCompose() {
  closeAddMenu();
  isLetterComposeOpen = true;
  albumView.classList.add("album-view--detail");
  galleryScrollTop = galleryScroll.scrollTop;
  galleryTitle.textContent = "편지 쓰기";
  resetLetterCompose();
  galleryScroll.classList.add("view--hidden");
  letterCompose.classList.remove("view--hidden");
}

function closeLetterCompose() {
  if (!isLetterComposeOpen) return;

  isLetterComposeOpen = false;
  if (!isPhotoDetailOpen && !isLetterReadOpen) {
    albumView.classList.remove("album-view--detail");
  }
  galleryTitle.textContent = activeAlbumId;
  letterCompose.classList.add("view--hidden");
  galleryScroll.classList.remove("view--hidden");
  resetLetterCompose();
  galleryScroll.scrollTop = galleryScrollTop;
}

function openLetterRead(letter) {
  galleryScrollTop = galleryScroll.scrollTop;
  activeLetter = letter;
  isLetterReadOpen = true;
  albumView.classList.add("album-view--detail");
  galleryTitle.textContent = formatLetterTitle(letter);
  letterReadTo.textContent = `To. ${letter.to || ""}`;
  letterReadText.textContent = letter.content;
  letterReadFrom.textContent = `From. ${letter.from || ""}`;
  galleryScroll.classList.add("view--hidden");
  letterRead.classList.remove("view--hidden");
}

function closeLetterRead() {
  if (!isLetterReadOpen) return;

  isLetterReadOpen = false;
  activeLetter = null;
  if (!isPhotoDetailOpen) {
    albumView.classList.remove("album-view--detail");
  }
  galleryTitle.textContent = activeAlbumId;
  letterRead.classList.add("view--hidden");
  galleryScroll.classList.remove("view--hidden");
  letterReadTo.textContent = "";
  letterReadText.textContent = "";
  letterReadFrom.textContent = "";
  galleryScroll.scrollTop = galleryScrollTop;
}

function navigatePhoto(delta) {
  if (!isPhotoDetailOpen) return;
  showPhotoAtIndex(currentPhotoIndex + delta);
}

async function downloadCurrentPhoto() {
  if (!isPhotoDetailOpen || currentPhotoIndex < 0) return;

  const photo = activePhotos[currentPhotoIndex];
  const filename = photo.name || `${activeAlbumId}.jpg`;

  try {
    const response = await fetch(photo.src);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    const link = document.createElement("a");
    link.href = photo.src;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }
}

async function deleteCurrentPhoto() {
  if (!isPhotoDetailOpen || currentPhotoIndex < 0) return;

  const photo = activePhotos[currentPhotoIndex];
  if (!confirm("이 사진을 삭제할까요?")) return;

  if (photo.shared && photo.id) {
    await SharedPhotos.remove(photo);
  } else {
    hideAlbumPhoto(activeAlbumId, photo.src);
    activePhotos.splice(currentPhotoIndex, 1);
    renderGallery(activePhotos);

    if (activePhotos.length === 0) {
      closePhotoDetail();
      return;
    }

    const nextIndex = Math.min(currentPhotoIndex, activePhotos.length - 1);
    showPhotoAtIndex(nextIndex);
  }
}

async function deleteCurrentLetter() {
  if (!isLetterReadOpen || !activeLetter) return;
  if (!confirm("이 편지를 삭제할까요?")) return;

  await deleteLetter(activeLetter.id);
  activeLetters = activeLetters.filter((letter) => letter.id !== activeLetter.id);
  renderCardGrid(activeLetters);
  closeLetterRead();
}

function closeAddMenu() {
  addPhotoMenu.classList.add("view--hidden");
  addCardMenu.classList.add("view--hidden");
  galleryAddBtn.setAttribute("aria-expanded", "false");
}

function toggleAddMenu() {
  const menu = isCardMode() ? addCardMenu : addPhotoMenu;
  const isOpen = !menu.classList.contains("view--hidden");

  closeAddMenu();
  if (isOpen) return;

  menu.classList.remove("view--hidden");
  galleryAddBtn.setAttribute("aria-expanded", "true");
}

async function handleSelectedFiles(fileList) {
  const files = Array.from(fileList).filter(isImageFile);
  if (!files.length || !activeAlbumId || isCardMode()) return;

  closeAddMenu();

  if (!SharedPhotos.isEnabled()) {
    alert(
      "올린 사진을 가족 모두에게 보여주려면 Firebase 설정이 필요합니다.\nfirebase-config.example.js 를 참고해 firebase-config.js 에 값을 입력해 주세요."
    );
    return;
  }

  for (const file of files) {
    try {
      const normalized = await normalizeImageFile(file);
      const meta = await readImageMeta(normalized);
      if (meta.src.startsWith("blob:")) URL.revokeObjectURL(meta.src);
      await SharedPhotos.upload(activeAlbumId, normalized, meta);
    } catch {
      // Skip unreadable images.
    }
  }
}

async function createLetter() {
  const to = letterToInput.value.trim();
  const from = letterFromInput.value.trim();
  const content = letterInput.value.trim();
  if (!to || !from || !content) return;

  const id = await saveLetter({ to, from, content });
  const letter = { id, to, from, content, createdAt: Date.now() };
  activeLetters.unshift(letter);
  renderCardGrid(activeLetters);
  closeLetterCompose();
}

function onTouchStart(event) {
  if (!isPhotoDetailOpen || event.touches.length !== 1) return;
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}

function onTouchEnd(event) {
  if (!isPhotoDetailOpen || event.changedTouches.length !== 1) return;

  const deltaX = event.changedTouches[0].clientX - touchStartX;
  const deltaY = event.changedTouches[0].clientY - touchStartY;

  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return;

  if (deltaX < 0) {
    navigatePhoto(1);
  } else {
    navigatePhoto(-1);
  }
}

document.querySelectorAll(".book-cover, .envelope-cover").forEach((btn) => {
  btn.addEventListener("click", () => {
    const albumId = btn.dataset.album;
    if (albumId) openAlbum(albumId);
  });
});

backBtn.addEventListener("click", () => {
  if (isPhotoDetailOpen) {
    closePhotoDetail();
    return;
  }

  if (isLetterReadOpen) {
    closeLetterRead();
    return;
  }

  if (isLetterComposeOpen) {
    closeLetterCompose();
    return;
  }

  closeAlbum();
});

galleryAddBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  if (isPhotoDetailOpen || isLetterReadOpen || isLetterComposeOpen) return;
  toggleAddMenu();
});

addPhotoMenu.querySelectorAll(".add-photo-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    const source = btn.dataset.source;
    if (source === "camera") {
      cameraInput.click();
    } else {
      galleryInput.click();
    }
  });
});

addCardMenu.querySelector(".add-card-option")?.addEventListener("click", () => {
  openLetterCompose();
});

letterCreateBtn.addEventListener("click", () => {
  createLetter();
});

photoSaveBtn.addEventListener("click", () => {
  downloadCurrentPhoto();
});

photoDeleteBtn.addEventListener("click", () => {
  deleteCurrentPhoto();
});

letterDeleteBtn.addEventListener("click", () => {
  deleteCurrentLetter();
});

cameraInput.addEventListener("change", () => {
  handleSelectedFiles(cameraInput.files);
  cameraInput.value = "";
});

galleryInput.addEventListener("change", () => {
  handleSelectedFiles(galleryInput.files);
  galleryInput.value = "";
});

photoDetail.addEventListener("touchstart", onTouchStart, { passive: true });
photoDetail.addEventListener("touchend", onTouchEnd, { passive: true });

document.addEventListener("click", (event) => {
  const openMenu = isCardMode() ? addCardMenu : addPhotoMenu;
  if (
    !openMenu.classList.contains("view--hidden") &&
    !event.target.closest(".gallery-add") &&
    !event.target.closest(".add-photo-menu") &&
    !event.target.closest(".add-card-menu")
  ) {
    closeAddMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (!isPhotoDetailOpen) return;

  if (event.key === "ArrowRight") {
    navigatePhoto(1);
  } else if (event.key === "ArrowLeft") {
    navigatePhoto(-1);
  }
});

async function init() {
  await loadPhotos();

  if (!localStorage.getItem("lettersCleared20250712")) {
    await clearAllLetters();
    localStorage.setItem("lettersCleared20250712", "1");
  }
}

init();
