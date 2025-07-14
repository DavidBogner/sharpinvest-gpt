
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const pdfParse = pkg.default || pkg;
import mammoth from 'mammoth';
import csvParser from 'csv-parser';
import pkg from 'pdf-parse';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let uploadedContent = '';

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, 'uploads', file.name);

  try {
    await file.mv(uploadPath);
    let content = '';

    if (file.name.endsWith('.pdf')) {
      const data = await pdfParse(fs.readFileSync(uploadPath));
      content = data.text;
    } else if (file.name.endsWith('.txt')) {
      content = fs.readFileSync(uploadPath, 'utf8');
    } else if (file.name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ path: uploadPath });
      content = result.value;
    } else if (file.name.endsWith('.csv')) {
      content = '';
      const rows = [];
      fs.createReadStream(uploadPath)
        .pipe(csvParser())
        .on('data', row => rows.push(row))
        .on('end', () => {
          content = JSON.stringify(rows);
          uploadedContent = content;
          res.send('Erfolgreich hochgeladen');
        });
      return;
    }

    uploadedContent = content;
    res.send('Erfolgreich hochgeladen');
  } catch (err) {
    console.error(err);
    res.status(500).send('Fehler beim Verarbeiten der Datei.');
  }
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are Lena, a strategic AI analyst. Always consider this document context when responding:
${uploadedContent}`
        },
        { role: 'user', content: message }
      ]
    });

    res.json({ reply: chatCompletion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send('Fehler bei der Anfrage an OpenAI.');
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server läuft auf Port 3000');
});
