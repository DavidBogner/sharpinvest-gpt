
import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(fileUpload());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let uploadedContent = '';

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, 'uploads', file.name);

  try {
    await file.mv(uploadPath);
    console.log('Uploaded file:', file.name);

    const ext = path.extname(file.name).toLowerCase();
    const data = fs.readFileSync(uploadPath);

    if (ext === '.pdf') {
      uploadedContent = (await pdf(data)).text;
    } else if (ext === '.docx') {
      uploadedContent = (await mammoth.extractRawText({ buffer: data })).value;
    } else if (ext === '.txt') {
      uploadedContent = data.toString();
    } else if (ext === '.csv') {
      uploadedContent = parse(data, { columns: true }).map(row => JSON.stringify(row)).join('\n');
    } else {
      uploadedContent = '';
    }

    res.json({ message: 'File successfully uploaded and analyzed.' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing file.');
  }
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: "You are Lena, a highly intelligent and analytical AI. You help users assess startup pitches, analyze documents, and provide strategic insights. You will receive uploaded documents and answer user questions based on them. Be helpful, professional, and concise."
        },
        {
          role: 'user',
          content: "The uploaded document content is: " + uploadedContent
        },
        {
          role: 'user',
          content: message
        }
      ]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running');
});
