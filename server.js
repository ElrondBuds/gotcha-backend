// server.js - Backend pentru jocul Gotcha

const express = require("express");
const cors = require("cors");
const { UserSigner } = require("@multiversx/sdk-wallet");
const { SecretKey } = require("@multiversx/sdk-core");
const bip39 = require("bip39");
const { derivePath } = require("ed25519-hd-key");

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURARE ---
const signerMnemonic = process.env.SIGNER_MNEMONIC;
if (!signerMnemonic) {
  console.error("EROARE: Cheia de semnare (SIGNER_MNEMONIC) nu este setată în fișierul .env!");
  process.exit(1);
}

// **SOLUȚIA FINALĂ ȘI CORECTĂ:**
// 1. Generează "seed"-ul din fraza mnemonică.
const seed = bip39.mnemonicToSeedSync(signerMnemonic);
// 2. Derivă cheia privată brută pentru calea standard MultiversX.
const { key } = derivePath("m/44'/508'/0'/0'/0'", seed.toString('hex'));
// 3. Creează un obiect SecretKey din cheia brută (Buffer). Acesta este obiectul pe care îl așteaptă UserSigner.
const secretKeyObject = new SecretKey(Buffer.from(key));
// 4. Creează semnatarul folosind obiectul SecretKey.
const signer = new UserSigner(secretKeyObject);

console.log(`Adresa publică a robotului (signer): ${signer.getAddress().bech32()}`);


// --- BAZA DE DATE SIMULATĂ ---
const gameSessions = {};
const dailyClaims = {};

// --- LOGICA JOCULUI ---
const TREASURES = ['💎', '🪨']; // Probabilitate 50%

// Endpoint pentru a începe un joc nou
app.post("/start-game", (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Adresa jucătorului lipsește" });
  }

  const sessionId = `session_${address}_${Date.now()}`;
  const board = Array.from({ length: 12 }, () => TREASURES[Math.floor(Math.random() * TREASURES.length)]);
  
  gameSessions[sessionId] = {
    player: address,
    board: board,
    revealed: Array(12).fill(false),
    score: 0,
    startedAt: Date.now()
  };
  
  console.log(`Sesiune nouă: ${sessionId} pentru ${address}. Tabla: ${board.join('')}`);
  res.json({ sessionId });
});

// Endpoint pentru a mina o piatră
app.post("/mine-spot", (req, res) => {
  const { sessionId, spotIndex } = req.body;
  const session = gameSessions[sessionId];

  if (!session) return res.status(404).json({ error: "Sesiune invalidă" });
  if (session.revealed[spotIndex]) return res.status(400).json({ error: "Loc deja minat" });

  session.revealed[spotIndex] = true;
  const result = session.board[spotIndex];
  
  if (result === '💎') {
    session.score += 1;
  }
  
  console.log(`Sesiunea ${sessionId}: minat la index ${spotIndex}, găsit ${result}. Scorul este acum ${session.score}`);
  res.json({ result, newScore: session.score });
});

// Endpoint pentru a cere revendicarea
app.post("/request-claim", (req, res) => {
  const { sessionId } = req.body;
  const session = gameSessions[sessionId];

  if (!session) return res.status(404).json({ error: "Sesiune invalidă" });

  const { player, score } = session;

  // Verifică revendicarea zilnică
  const today = new Date().toISOString().slice(0, 10); // Format YYYY-MM-DD
  if (dailyClaims[player] === today) {
    return res.status(403).json({ error: "Ai revendicat deja recompensa pentru ziua de azi." });
  }

  // Semnează mesajul (adresa;scor)
  const messageToSign = Buffer.from(`${player};${score}`);
  const signature = signer.sign(messageToSign);

  dailyClaims[player] = today;
  
  console.log(`Cerere de revendicare validată pentru ${player} cu scorul ${score}.`);
  res.json({
    score: score,
    signature: signature.toString("hex")
  });
});

// Pornește serverul
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Robotul tău de joc este activ pe portul " + port);
});
