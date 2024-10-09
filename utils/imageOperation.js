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
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow any size for CSV files
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true); // Accept CSV files
    } else if (file.size > 1 * 1024 * 1024) {
      // Check if file size exceeds 1 MB for other file types
      cb(new Error("File size exceeds 1 MB"), false);
    } else {
      cb(null, true); // Accept files below 1 MB
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
    `${folderName}/${uniqueName}-${file.originalname || file.name}`
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
