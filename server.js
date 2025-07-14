import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(fileUpload());

// Optional: Ordner 'uploads' erstellen, falls nicht vorhanden
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
  }

  const file = req.files.file;
  const uploadPath = path.join(uploadsDir, file.name);

  try {
    await file.mv(uploadPath);
    console.log(`Uploaded file: ${file.name}`);

    let extractedText = '';

    if (file.name.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(uploadPath);
      const data = await pdf(dataBuffer);
      extractedText = data.text;
    }

    res.json({ message: 'Upload erfolgreich', content: extractedText || null });
  } catch (err) {
    console.error('Fehler beim Upload:', err);
    res.status(500).json({ error: 'Fehler beim Verarbeiten der Datei.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
