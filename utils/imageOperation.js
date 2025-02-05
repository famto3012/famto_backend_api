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

  fileFilter: (req, file, cb) => {
    // Allow CSV files of any size
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true); // Accept CSV files without size limitation
    } else {
      cb(null, true); // Accept other files below 1 MB
    }
  },
});

const uploadToFirebase = async (file, folderName, originalQuality = false) => {
  if (!file) {
    throw new Error("File not found");
  }
  const uniqueName = uuidv4();
  const storageRef = ref(
    storage,
    `${folderName}/${uniqueName}-${file.originalname || file.name}`
  );

  let fileBuffer;

  if (file?.mimetype?.startsWith("image/")) {
    // If it's an image, process it with sharp

    try {
      if (originalQuality) {
        fileBuffer = file.buffer;
      } else {
        fileBuffer = await sharp(file.buffer)
          .resize({ width: 800 })
          .jpeg({ quality: 100 })
          .toBuffer();
      }
    } catch (err) {
      throw new Error("Image processing failed");
    }
  } else if (
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype.startsWith("audio/") ||
    file.mimetype.startsWith("application/pdf")
  ) {
    // If it's a CSV, skip sharp and use the original buffer
    fileBuffer = file.buffer;
  } else {
    // For unsupported file types, log and throw an error
    throw new Error("Unsupported file format");
  }

  // Upload file to Firebase
  await uploadBytes(storageRef, fileBuffer);
  const downloadURL = await getDownloadURL(storageRef);

  return downloadURL;
};

const deleteFromFirebase = async (fileUrl) => {
  const storageRef = ref(storage, fileUrl);
  try {
    await deleteObject(storageRef);
  } catch (error) {
    if (error.code === "storage/object-not-found") return;
    throw error;
  }
};

const changeBufferToImage = async (buffer, outputPath, newFormat) => {
  try {
    // Process the buffer and convert it to the new format
    const image = await sharp(buffer)
      .toFormat(newFormat) // Change the image format
      .toFile(outputPath); // Save the converted image to a file

    // Determine the MIME type based on the new format
    image.mimetype = `image/${newFormat}`;
    image.buffer = buffer;

    return image;
  } catch (error) {
    console.error("Error converting image format:", error);
    throw error;
  }
};

module.exports = {
  upload,
  uploadToFirebase,
  deleteFromFirebase,
  changeBufferToImage,
};
