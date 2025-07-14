from pathlib import Path

server_js_code = """
import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import mammoth from 'mammoth';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'Public')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

async function extractPdfText(filePath) {
  const rawData = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data: rawData }).promise;

  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\\n';
  }

  return text;
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractCsvText(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(parse({ delimiter: ',', from_line: 1 }))
      .on('data', (row) => records.push(row.join(' ')))
      .on('end', () => resolve(records.join('\\n')))
      .on('error', (error) => reject(error));
  });
}

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.file;
  const uploadPath = path.join(uploadsDir, file.name);

  try {
    await file.mv(uploadPath);
    console.log(`Uploaded file: ${file.name}`);

    let fileText = '';

    if (file.name.endsWith('.pdf')) {
      fileText = await extractPdfText(uploadPath);
    } else if (file.name.endsWith('.docx')) {
      fileText = await extractDocxText(uploadPath);
    } else if (file.name.endsWith('.csv')) {
      fileText = await extractCsvText(uploadPath);
    } else if (file.name.endsWith('.txt')) {
      fileText = fs.readFileSync(uploadPath, 'utf8');
    } else {
      return res.status(400).send('Unsupported file type.');
    }

    req.session = req.session || {};
    req.session.lastUploadedText = fileText;

    res.send('Datei erfolgreich hochgeladen.');
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Upload failed.');
  }
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  const fileText = req.session?.lastUploadedText || '';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Du bist Lena, eine freundliche KI-Analystin. Antworte hilfreich auf Fragen zu Dokumenten und gib klare Auskünfte.' },
        { role: 'user', content: fileText + '\\n\\n' + message },
      ],
    });

    res.json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).send('Chat error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
"""

# Save to file and return path
server_js_path = Path("/mnt/data/server.js")
server_js_path.write_text(server_js_code)
server_js_path
