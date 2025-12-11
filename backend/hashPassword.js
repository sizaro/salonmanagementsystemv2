// hashPassword.js
import bcrypt from "bcrypt";

const saltRounds = 10;

// Ask for password from the console
const password = process.argv[2];

if (!password) {
  console.log("❌ Please provide a password. Example:");
  console.log("   node hashPassword.js mypassword123");
  process.exit(1);
}

async function generateHash() {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log("🔐 Hashed Password:");
    console.log(hash);
  } catch (error) {
    console.error("Error hashing password:", error);
  }
}

generateHash();
