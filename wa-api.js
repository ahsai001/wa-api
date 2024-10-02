const express = require("express");
const venom = require("venom-bot");
const yargs = require("yargs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
const wabotName = process.env.WABOT_NAME;
const wabotSuffix = process.env.WABOT_SUFFIX;

const app = express();
const argv = yargs.argv;
const port = argv.port;
const wa_number = "no" + argv.wanumber;

// Middleware untuk parsing JSON
app.use(express.json());

// Middleware untuk parsing form input
app.use(express.urlencoded({ extended: true }));

// Set static folder untuk menyajikan file HTML dan aset lainnya
app.use(express.static("public"));

//destination uploaded file
// Konfigurasi multer untuk menyimpan file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const fsp = require("fs").promises;

// Nama folder tempat menyimpan history user
const userHistoryDir = path.join(__dirname, "user_history");

// Fungsi untuk membuat folder jika belum ada
async function ensureUserHistoryDir() {
  try {
    await fsp.mkdir(userHistoryDir, { recursive: true });
    console.log("Folder 'user_history' siap.");
  } catch (err) {
    console.error("Gagal membuat folder 'user_history':", err);
  }
}

// Fungsi async untuk menyimpan pesan per user di folder user_history
async function saveMessageToFile(userId, sender, message) {
  await ensureUserHistoryDir(); // Pastikan folder sudah ada

  const fileName = `chat_history_${userId.replace(/[@.]/g, "_")}.txt`; // Ganti karakter yang tidak valid dalam nama file
  const filePath = path.join(userHistoryDir, fileName); // Simpan file di dalam folder user_history
  const formattedMessage = `${sender}: ${message}\n`;

  try {
    await fsp.appendFile(filePath, formattedMessage);
    console.log(`Percakapan berhasil disimpan untuk user ${userId}.`);
  } catch (err) {
    console.error(`Gagal menyimpan percakapan untuk user ${userId}:`, err);
  }
}

// Fungsi async untuk membaca history dari file per user di folder user_history
async function getChatHistoryFromFile(userId) {
  //await ensureUserHistoryDir(); // Pastikan folder sudah ada

  const fileName = `chat_history_${userId.replace(/[@.]/g, "_")}.txt`; // Ganti karakter yang tidak valid dalam nama file
  const filePath = path.join(userHistoryDir, fileName); // Arahkan ke folder user_history

  try {
    const data = await fsp.readFile(filePath, "utf8");
    return data;
  } catch (err) {
    console.error(`Gagal membaca file untuk user ${userId}:`, err);
    return null;
  }
}

// Inisialisasi Venom.js
venom
  .create({
    session: wa_number, //name of session
  })
  .then((client) => {
    // Inisialisasi  Gemini api
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Handle message from user
    client.onMessage(async (message) => {
      //  Welcome message
      if (message.body === "Hi" && message.isGroupMsg === false) {
        client
          .sendText(
            message.from,
            `Welcome friends, you can call me ${wabotName}`
          )
          .then((result) => {
            console.log("Result: ", result); //return object success
          })
          .catch((erro) => {
            console.error("Error when sending: ", erro); //return object error
          });
      } else {
        const firstWord = message.body.split(" ")[0];
        //  Chat with keyword
        if (firstWord.toLowerCase() === wabotName.toLowerCase()) {
          const prompt = message.body.replace(`${firstWord} `, "");

          await saveMessageToFile(
            message.from,
            "User",
            prompt + " " + wabotSuffix
          );
          const history = await getChatHistoryFromFile(message.from);
          const result = await model.generateContent(history);
          await saveMessageToFile(message.from, "Bot", result.response.text());

          //Send response
          client
            .sendText(message.from, result.response.text())
            .then((result) => {
              console.log("Result: ", result); //return object success
            })
            .catch((erro) => {
              console.error("Error when sending: ", erro); //return object error
            });
        }
      }
    });

    // Format Group
    const formatGroup = (group) => {
      if (group.endsWith('@g.us')) {
          return group
      }
      let formatted = group.replace(/[^\d-]/g, '')
      return (formatted += '@g.us')
    }

    // Formated
    const formatPhone = (phone) => {
      if (phone.endsWith('@c.us')) {
          return phone
      }
      let formatted = phone.replace(/\D/g, '')
      return (formatted += '@c.us')
    }

    // Route untuk mengirim pesan
    app.post("/send-text", async (req, res) => {

      /*
       * number string
       * message string
       * isGroup boolean
       */

      const { message, number, isGroup } = req.body;
      const numberFormat = isGroup ? formatGroup(number) : formatPhone(number);

      if (!number || !message) {
        return res.status(400).json({ error: "Nomor dan pesan diperlukan" });
      }

      try {
        // Kirim pesan menggunakan Venom
        await client.sendText(numberFormat, message);
        res.json({ success: true, message: "Pesan berhasil dikirim!" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Gagal mengirim pesan" });
      }
    });
    // Route untuk mengirim gambar
    app.post("/send-image", upload.single("image"), async (req, res) => {
      const { number, caption } = req.body;
      const imagePath = req.file.path;

      if (!number || !req.file) {
        return res.status(400).json({ error: "Nomor dan gambar diperlukan" });
      }

      try {
        // Kirim gambar menggunakan Venom
        await client.sendImage(
          formatPhone(number),
          imagePath,
          req.file.originalname,
          caption || ""
        );
        res.json({
          success: true,
          message: "Image sent successfully",
          originalFileName: req.file.originalname,
          number: number,
          caption: caption,
        });

        // Hapus file setelah dikirim
        fs.unlinkSync(imagePath);
      } catch (error) {
        console.error("Gagal mengirim gambar:", error);
        res
          .status(500)
          .json({ success: false, message: "Gagal mengirim gambar" });
      }
    });
    // Route untuk mengirim file
    app.post("/send-file", upload.single("document"), async (req, res) => {
      const { number, caption } = req.body;
      const filePath = req.file.path;

      if (!number || !req.file) {
        return res.status(400).json({ error: "Nomor dan document diperlukan" });
      }

      try {
        // Kirim file menggunakan Venom
        await client.sendFile(
          formatPhone(number),
          filePath,
          req.file.originalname,
          caption || ""
        );
        res.json({
          success: true,
          message: "File sent successfully",
          originalFileName: req.file.originalname,
          number: number,
          caption: caption,
        });

        // Hapus file setelah dikirim
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error("Gagal mengirim file:", error);
        res
          .status(500)
          .json({ success: false, message: "Gagal mengirim file" });
      }
    });

    // Start server
    app.listen(port, () => {
      console.log(`Server berjalan di http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.log("Gagal memulai Venom:", error);
  });
