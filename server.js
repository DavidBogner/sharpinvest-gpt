import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// __dirname für ES-Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ordner 'uploads' anlegen, falls nicht vorhanden
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.static('Public'));
app.use(fileUpload());

let lastUploadedContent = ''; // Zwischenspeicher für Dateiinhalt

app.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file;
    const uploadPath = path.join(uploadsDir, file.name);

    // Datei speichern
    await file.mv(uploadPath);

    let fileText = '';

    // Dateiinhalt extrahieren
    if (file.name.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(uploadPath);
      const data = await pdfParse(dataBuffer);
      fileText = data.text;
    } else if (file.name.endsWith('.txt')) {
      fileText = fs.readFileSync(uploadPath, 'utf-8');
    } else if (file.name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ path: uploadPath });
      fileText = result.value;
    } else if (file.name.endsWith('.csv')) {
      const csvContent = fs.readFileSync(uploadPath, 'utf-8');
      const records = csvParse(csvContent, { columns: true });
      fileText = JSON.stringify(records, null, 2);
    } else {
      return res.status(400).send('Unsupported file format.');
    }

    // Inhalt merken
    lastUploadedContent = fileText;

    // Erste automatische Analyse
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a highly intelligent AI analyst. Analyze the uploaded document.'
        },
        {
          role: 'user',
          content: fileText.slice(0, 8000)
        }
      ]
    });

    res.json({
      message: 'File successfully uploaded and analyzed.',
      ai_response: completion.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error.');
  }
});

app.post('/ask', express.json(), async (req, res) => {
  try {
    const userQuestion = req.body.question;

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful and concise AI assistant. Base your answers on the document content.'
      },
      {
        role: 'user',
        content: `Here is the document:\n${lastUploadedContent.slice(0, 8000)}\n\nQuestion: ${userQuestion}`
      }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages
    });

    res.json({
      answer: completion.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing question.');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
