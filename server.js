import express from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import mammoth from "mammoth";
import { parse } from "csv-parse/sync";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static("Public"));
app.use(fileUpload());
app.use(express.json());

let lastUploadedContent = "";

app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send("No file uploaded.");
  }

  const uploadedFile = req.files.file;
  const uploadPath = path.join(__dirname, "uploads", uploadedFile.name);

  // Stelle sicher, dass der Ordner existiert
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

  try {
    await uploadedFile.mv(uploadPath);

    const ext = path.extname(uploadedFile.name).toLowerCase();
    let content = "";

    if (ext === ".pdf") {
      const pdfData = new Uint8Array(fs.readFileSync(uploadPath));
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        content += pageText + "\n";
      }
    } else if (ext === ".txt") {
      content = fs.readFileSync(uploadPath, "utf8");
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: uploadPath });
      content = result.value;
    } else if (ext === ".csv") {
      const csv = fs.readFileSync(uploadPath, "utf8");
      const records = parse(csv, { columns: true });
      content = JSON.stringify(records, null, 2);
    } else {
      return res.status(400).send("Unsupported file type.");
    }

    lastUploadedContent = content;
    res.send("Erfolgreich hochgeladen.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Verarbeiten der Datei.");
  }
});

app.post("/ask", async (req, res) => {
  const question = req.body.question;

  if (!question) {
    return res.status(400).send("Frage fehlt.");
  }

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Du bist ein hilfsbereiter AI-Analyst." },
        { role: "user", content: `Dokumentinhalt:\n${lastUploadedContent}\n\nFrage: ${question}` }
      ]
    });

    res.send(chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error("Fehler bei OpenAI:", error);
    res.status(500).send("Fehler bei der Anfrage an OpenAI.");
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
