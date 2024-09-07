const {
  generateMapplsAuthToken,
} = require("../controllers/Token/tokenOperation");
const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const Token = require("../models/Token");

const email = process.env.SEEDER_EMAIL;
const password = process.env.SEEDER_PASSWORD;
const phoneNumber = process.env.SEEDER_PHONENUMBER;

const insertAdmin = async () => {
  try {
    const adminFound = await Admin.find({});

    if (!adminFound.length) {
      if (!email || !password || !phoneNumber) {
        throw new Error("SEEDED detail is missing");
      }

      const normalizedEmail = email.toLowerCase();

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await Admin.create({
        fullName: "Admin",
        email: normalizedEmail,
        password: hashedPassword,
        phoneNumber,
        isApproved: "Approved",
      });

      console.log("Admin created successfully.");
    } else {
      console.log("Admin already exists, skipping creation.");
    }
  } catch (error) {
    console.error("Error creating admin:", error.message);
  }
};

const insertMapplsToken = async () => {
  try {
    const tokenFound = await Token.findOne();

    if (!tokenFound) {
      generateMapplsAuthToken();
    } else {
      console.log(`Mappls token already exists`);
    }
  } catch (err) {
    console.error("Error inserting mappls token:", err.message);
  }
};

insertAdmin();
insertMapplsToken();
