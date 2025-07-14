from pathlib import Path
code = """
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static('Public'));

const uploadedContents = {};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, 'uploads', file.name);

  try {
    await file.mv(uploadPath);
    console.log(`Uploaded file: ${file.name}`);

    const ext = path.extname(file.name).toLowerCase();
    let content = '';

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(uploadPath);
      const data = await pdfParse(dataBuffer);
      content = data.text;
    } else if (ext === '.txt') {
      content = fs.readFileSync(uploadPath, 'utf-8');
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: uploadPath });
      content = result.value;
    } else if (ext === '.csv') {
      const csvData = fs.readFileSync(uploadPath, 'utf-8');
      const records = csvParse(csvData, { columns: false });
      content = records.map(row => row.join(', ')).join('\\n');
    } else {
      return res.status(400).send('Unsupported file format.');
    }

    uploadedContents[file.name] = content;
    res.json({ message: 'Erfolgreich hochgeladen', filename: file.name });
  } catch (err) {
    console.error(err);
    res.status(500).send('File processing failed.');
  }
});

app.post('/ask', async (req, res) => {
  const { question, filename } = req.body;
  const content = uploadedContents[filename];

  if (!content) {
    return res.status(400).send('Document not found or not yet uploaded.');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful startup analyst.',
        },
        {
          role: 'user',
          content: `Here is the document content:\n\n${content}\n\nNow answer this question: ${question}`,
        },
      ],
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating answer.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
"""

# Save the fixed version to share
output_path = Path("/mnt/data/server.js")
output_path.write_text(code)
output_path.name
