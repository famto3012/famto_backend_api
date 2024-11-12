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
const sharp = require("sharp");

const storage = getStorage(firebaseApp);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Set a higher limit globally, but enforce limits conditionally
  fileFilter: (req, file, cb) => {
    // Allow CSV files of any size
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true); // Accept CSV files without size limitation
    } else if (file.size > 1 * 1024 * 1024) {
      // Check file size for non-CSV files
      cb(new Error("File size exceeds 1 MB for non-CSV files"), false);
    } else {
      cb(null, true); // Accept other files below 1 MB
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
  const compressedImageBuffer = await sharp(file.buffer)
    .resize({ width: 800 })
    .jpeg({ quality: 80 })
    .toBuffer();

  await uploadBytes(storageRef, compressedImageBuffer);
  const downloadURL = await getDownloadURL(storageRef);

  return downloadURL;
};

const deleteFromFirebase = async (fileUrl) => {
  const storageRef = ref(storage, fileUrl);
  try {
    await deleteObject(storageRef);
  } catch (error) {
    if (error.code === "storage/object-not-found") {
      console.log("File not found in Firebase, no action needed.");
      return;
    }
    throw error;
  }
};

module.exports = { upload, uploadToFirebase, deleteFromFirebase };
