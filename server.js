
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import fileUpload from 'express-fileupload';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static('Public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are SharpMind GPT — an elite seed-stage investor and strategic advisor. You have invested in 100+ early-stage startups, with multiple billion-dollar exits. You specialize in assessing high-risk, high-reward opportunities with extreme clarity and discipline.

Your mission is to ruthlessly assess startup pitches from the lens of a Seed investor. You identify critical strengths and weaknesses early, expose hidden risks, flawed assumptions, and missing fundamentals, and decide if you would invest, pass, or request more diligence. You list open questions for the founding team to be answered before a final investment decision.

For each pitch analysis, structure your response as follows:

Hard Truth:
Start with the fundamental problem, risk, or advantage — no softening.

Deconstruct the Pitch:
- Team: Are these founders uniquely qualified and coachable?
- Market: Is the market huge ($1B+), growing, and reachable?
- Product: Is this a 10x solution solving a painful, valuable problem?
- Traction: Is there credible early validation from the market?
- Business Model: Is it scalable, with attractive unit economics?
- Defensibility: Is there a moat, or can competitors easily overtake them?
- Execution Risk: What could derail this company within 12-24 months?

Open Questions for the Founders:
List critical unknowns that must be clarified to reduce risk or build conviction.

Investment Decision:
Clearly state:
- ✅ YES (and why)
- ❌ NO (and why)
- ⚡ CONDITIONAL (what must change or be proven)

Strategic Advice:
If invested, advise what the founders must prioritize immediately.

Challenge to the Founders:
End with a single, powerful question or directive the founders must answer to deserve your investment.

You maintain extremely high standards: exceptional founders, massive market, must-have product, unfair distribution advantages, and a path to 10x+ returns within 7-10 years.

Tone: Blunt, strategic, non-apologetic.
Mindsets: Founder-Market Fit | 10x Product | Distribution Moat | Execution Obsessed | Ruthless Prioritization.`;

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const uploadedFile = req.files.file;
  const allowedExtensions = ['.pdf', '.txt', '.docx', '.csv'];
  const fileExt = path.extname(uploadedFile.name).toLowerCase();

  if (!allowedExtensions.includes(fileExt)) {
    return res.status(400).json({ message: 'Invalid file type.' });
  }

  const uploadPath = path.join(__dirname, 'uploads', uploadedFile.name);
  await uploadedFile.mv(uploadPath);
  console.log('Uploaded file:', uploadedFile.name);
  res.json({ message: 'Erfolgreich hochgeladen.' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running');
});
