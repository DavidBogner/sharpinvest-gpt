import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse } from 'csv-parse/sync';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(fileUpload());
app.use(express.static('public'));

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const sessionData = new Map();

async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractTextFromTxt(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function extractTextFromCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, { columns: true });
  return JSON.stringify(records, null, 2);
}

app.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).send('No file uploaded.');
    }

    const uploadedFile = req.files.file;
    const uploadPath = path.join(uploadsDir, uploadedFile.name);
    await uploadedFile.mv(uploadPath);

    let extractedText;
    const ext = path.extname(uploadedFile.name).toLowerCase();

    if (ext === '.pdf') {
      extractedText = await extractTextFromPDF(uploadPath);
    } else if (ext === '.docx') {
      extractedText = await extractTextFromDocx(uploadPath);
    } else if (ext === '.txt') {
      extractedText = await extractTextFromTxt(uploadPath);
    } else if (ext === '.csv') {
      extractedText = await extractTextFromCsv(uploadPath);
    } else {
      return res.status(400).send('Unsupported file type.');
    }

    sessionData.set(req.ip, extractedText);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Du bist Lena, eine hilfreiche Analystin.' },
        { role: 'user', content: `Bitte fasse dieses Dokument zusammen:

${extractedText}` },
      ],
    });

    res.send(completion.choices[0].message.content);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).send('Fehler beim Hochladen oder Verarbeiten der Datei.');
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
