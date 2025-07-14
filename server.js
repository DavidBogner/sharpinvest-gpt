
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(cors());
app.use(fileUpload());
app.use(express.static('Public'));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/upload', async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file;
    const uploadPath = path.join(__dirname, 'uploads', file.name);

    await fs.promises.mkdir(path.dirname(uploadPath), { recursive: true });
    await file.mv(uploadPath);

    let textContent = '';
    if (file.name.endsWith('.pdf')) {
        const dataBuffer = await fs.promises.readFile(uploadPath);
        const data = await pdfParse(dataBuffer);
        textContent = data.text;
    } else if (file.name.endsWith('.txt')) {
        textContent = await fs.promises.readFile(uploadPath, 'utf-8');
    } else {
        textContent = 'Dateiformat wird aktuell nicht unterstützt.';
    }

    req.session = { documentContent: textContent };
    res.send('Datei erfolgreich hochgeladen.');
});

app.post('/ask', async (req, res) => {
    const question = req.body.question;
    const documentContent = req.session?.documentContent || '';

    if (!question) return res.status(400).send('Frage fehlt.');
    if (!documentContent) return res.status(400).send('Kein Dokumentinhalt vorhanden.');

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'Du bist eine hilfreiche Analystin.' },
                { role: 'user', content: `Dokumentinhalt: ${documentContent}

Frage: ${question}` },
            ],
        });
        res.json({ answer: completion.choices[0].message.content });
    } catch (error) {
        console.error(error);
        res.status(500).send('Fehler beim Abrufen der Antwort.');
    }
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
