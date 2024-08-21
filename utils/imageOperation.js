const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} = require("firebase/storage");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const firebaseApp = require("../config/firebase");

const storage = getStorage(firebaseApp);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB limit
  fileFilter: (req, file, cb) => {
    // TODO: Confirm final decision for checking the file  size for input
    if (file.size > 1 * 1024 * 1024) {
      // Check if file size exceeds 1 MB
      cb(new Error("File size exceeds 1 MB"), false);
    } else {
      cb(null, true);
    }
  },
});

const uploadToFirebase = async (file, folderName) => {
  if (!file) {
    throw new Error("File not found");
  }

  const uniqueName = uuidv4();

  const storageRef = ref(
    storage,
    `${folderName}/${uniqueName}-${file.originalname}`
  );
  await uploadBytes(storageRef, file.buffer);
  const downloadURL = await getDownloadURL(storageRef);

  return downloadURL;
};

const deleteFromFirebase = async (fileUrl) => {
  const storageRef = ref(storage, fileUrl);
  await deleteObject(storageRef);
};

module.exports = { upload, uploadToFirebase, deleteFromFirebase };
