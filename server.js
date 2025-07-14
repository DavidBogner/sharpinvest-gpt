import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { OpenAI } from 'openai';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
const sessions = {};

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use(express.static('Public'));
app.use(express.json());
app.use(fileUpload());

// Initialisiere OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Dateiupload + automatische Analyse
app.post('/upload', async (req, res) => {
  try {
    const file = req.files?.file;
    const sessionId = req.body.sessionId;
    if (!file || !sessionId) return res.status(400).send('No file or sessionId provided.');

    const filePath = path.join(uploadsDir, file.name);
    await file.mv(filePath);

    let content = '';
    const ext = path.extname(file.name).toLowerCase();

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(dataBuffer);
      content = parsed.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      content = result.value;
    } else if (ext === '.txt') {
      content = fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.csv') {
      const csvText = fs.readFileSync(filePath, 'utf8');
      const records = csvParse(csvText, { columns: true });
      content = JSON.stringify(records, null, 2);
    } else {
      return res.status(400).send('Unsupported file type.');
    }

    sessions[sessionId] = { fileContent: content };

    res.json({ message: 'Upload erfolgreich und analysiert.' });
  } catch (err) {
    console.error('Upload/Parsing Fehler:', err);
    res.status(500).send('Fehler beim Hochladen oder Analysieren.');
  }
});

// Chatfrage an GPT
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) return res.status(400).send('Missing message or sessionId');

    const session = sessions[sessionId];
    const systemPrompt = session?.fileContent
      ? `Du bist eine freundliche KI-Analystin namens Lena. Analysiere die hochgeladene Datei mit folgendem Inhalt:\n\n${session.fileContent}`
      : `Du bist Lena, eine hilfreiche KI-Analystin.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('Chat Fehler:', err);
    res.status(500).send('Fehler beim Generieren der Antwort.');
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
