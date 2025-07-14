import os

# Erstellen der server.js-Datei mit allen gewünschten Funktionen
server_js_content = """
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import readline from 'readline';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static('Public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let lastUploadedContent = ''; // Wird genutzt, um den Text zu speichern

async function extractText(filePath, mimetype) {
  const data = fs.readFileSync(filePath);

  if (mimetype === 'application/pdf') {
    const pdfData = await pdfParse(data);
    return pdfData.text;
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value;
  }

  if (mimetype === 'text/plain') {
    return data.toString();
  }

  if (mimetype === 'text/csv') {
    const parsed = parse(data, { columns: false });
    return parsed.map(row => row.join(',')).join('\\n');
  }

  return 'Dateiformat nicht unterstützt.';
}

app.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).send('Keine Datei hochgeladen.');
    }

    const uploadedFile = req.files.file;
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'];

    if (!allowedTypes.includes(uploadedFile.mimetype)) {
      return res.status(400).send('Nicht unterstütztes Dateiformat.');
    }

    const uploadPath = path.join('uploads', uploadedFile.name);
    await uploadedFile.mv(uploadPath);

    const extractedText = await extractText(uploadPath, uploadedFile.mimetype);
    lastUploadedContent = extractedText;

    res.send('Datei erfolgreich hochgeladen.');
    console.log('Uploaded file:', uploadedFile.name);
  } catch (err) {
    console.error(err);
    res.status(500).send('Fehler beim Hochladen der Datei.');
  }
});

const SYSTEM_PROMPT = `You are SharpMind GPT — an elite seed-stage investor and strategic advisor...`;

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Hier ist ein hochgeladenes Dokument:\n${lastUploadedContent}\n\nFrage: ${message}` }
      ]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler bei der Chat-Antwort.' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running');
});
"""

# Speichern
output_path = "/mnt/data/server.js"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(server_js_content)

output_path
