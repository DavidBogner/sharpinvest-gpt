from pathlib import Path

server_js_code = '''
import express from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { parse } from "csv-parse/sync";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(express.static("Public"));
app.use(fileUpload());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let uploadedContent = "";

app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send("No file uploaded.");
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, "uploads", file.name);

  try {
    await file.mv(uploadPath);

    const mimetype = file.mimetype;
    let content = "";

    if (mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(uploadPath);
      const data = await pdfParse(dataBuffer);
      content = data.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: uploadPath });
      content = result.value;
    } else if (mimetype === "text/plain") {
      content = fs.readFileSync(uploadPath, "utf8");
    } else if (mimetype === "text/csv") {
      const csvText = fs.readFileSync(uploadPath, "utf8");
      const records = parse(csvText, { columns: true });
      content = JSON.stringify(records, null, 2);
    } else {
      return res.status(400).send("Unsupported file type.");
    }

    uploadedContent = content;
    res.send("Datei erfolgreich hochgeladen.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Hochladen oder Verarbeiten der Datei.");
  }
});

app.post("/chat", express.json(), async (req, res) => {
  const userMessage = req.body.message;

  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are Lena, a sharp-minded AI startup analyst. You are helpful, strategic, and know how to turn complex documents into valuable insights.",
        },
        {
          role: "user",
          content: `Uploaded Content: ${uploadedContent}\\n\\nUser Question: ${userMessage}`,
        },
      ],
      model: "gpt-4",
    });

    const response = chatCompletion.choices[0].message.content;
    res.send({ reply: response });
  } catch (err) {
    console.error(err);
    res.status(500).send({ reply: "Fehler bei der Anfrage an OpenAI." });
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
'''

path = Path("/mnt/data/server.js")
path.write_text(server_js_code.strip(), encoding="utf-8")
path
