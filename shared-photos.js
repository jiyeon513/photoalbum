const SharedPhotos = (() => {
  const COLLECTION = "sharedPhotos";
  let db = null;
  let storage = null;
  let enabled = false;

  function init() {
    if (typeof firebase === "undefined") return false;
    if (!window.firebaseConfig?.projectId) return false;

    if (!firebase.apps.length) {
      firebase.initializeApp(window.firebaseConfig);
    }

    db = firebase.firestore();
    storage = firebase.storage();
    enabled = true;
    return true;
  }

  function isEnabled() {
    return enabled;
  }

  function mapDoc(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      src: data.downloadUrl,
      ratio: data.ratio,
      width: data.width,
      height: data.height,
      addedAt: data.addedAt,
      userAdded: true,
      shared: true,
      storagePath: data.storagePath,
    };
  }

  function subscribe(albumId, callback) {
    if (!enabled) {
      callback([]);
      return () => {};
    }

    return db
      .collection(COLLECTION)
      .where("albumId", "==", albumId)
      .onSnapshot(
        (snapshot) => {
          const photos = snapshot.docs
            .map(mapDoc)
            .sort((a, b) => b.addedAt - a.addedAt);
          callback(photos);
        },
        () => callback([])
      );
  }

  async function upload(albumId, file, meta) {
    if (!enabled) {
      throw new Error("Firebase가 설정되지 않았습니다.");
    }

    const safeName = meta.name.replace(/[^\w.\-()\uAC00-\uD7A3 ]+/g, "_");
    const storagePath = `shared/${albumId}/${Date.now()}_${safeName}`;
    const storageRef = storage.ref(storagePath);

    await storageRef.put(file, { contentType: file.type || "image/jpeg" });
    const downloadUrl = await storageRef.getDownloadURL();

    const docRef = await db.collection(COLLECTION).add({
      albumId,
      name: meta.name,
      storagePath,
      downloadUrl,
      ratio: meta.ratio,
      width: meta.width,
      height: meta.height,
      addedAt: Date.now(),
    });

    return {
      id: docRef.id,
      name: meta.name,
      src: downloadUrl,
      ratio: meta.ratio,
      width: meta.width,
      height: meta.height,
      userAdded: true,
      shared: true,
      storagePath,
      addedAt: Date.now(),
    };
  }

  async function remove(photo) {
    if (!enabled || !photo?.id) return;

    if (photo.storagePath) {
      try {
        await storage.ref(photo.storagePath).delete();
      } catch {
        // Storage file may already be gone.
      }
    }

    await db.collection(COLLECTION).doc(photo.id).delete();
  }

  return { init, isEnabled, subscribe, upload, remove };
})();

SharedPhotos.init();
