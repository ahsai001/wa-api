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

// Inisialisasi Venom.js
venom
  .create({
    session: wa_number, //name of session
  })
  .then((client) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    client.onMessage(async (message) => {
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
        if (firstWord.toLowerCase() === wabotName.toLowerCase()) {
          const prompt = message.body.replace(`${firstWord} `, "");
          const result = await model.generateContent(
            prompt + " " + wabotSuffix
          );
          //console.log(result.response.text());
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

    // Route untuk mengirim pesan
    app.post("/send-text", async (req, res) => {
      const { number, message } = req.body;

      if (!number || !message) {
        return res.status(400).json({ error: "Nomor dan pesan diperlukan" });
      }

      try {
        // Kirim pesan menggunakan Venom
        await client.sendText(number + "@c.us", message);
        res.json({ success: true, message: "Pesan berhasil dikirim!" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Gagal mengirim pesan" });
      }
    });

    app.post("/send-image", upload.single("image"), async (req, res) => {
      const { number, caption } = req.body;
      const imagePath = req.file.path;

      if (!number || !req.file) {
        return res.status(400).json({ error: "Nomor dan gambar diperlukan" });
      }

      try {
        // Kirim gambar menggunakan Venom
        await client.sendImage(
          number + "@c.us",
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

    app.post("/send-file", upload.single("document"), async (req, res) => {
      const { number, caption } = req.body;
      const filePath = req.file.path;

      if (!number || !req.file) {
        return res.status(400).json({ error: "Nomor dan document diperlukan" });
      }

      try {
        // Kirim file menggunakan Venom
        await client.sendFile(
          number + "@c.us",
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
