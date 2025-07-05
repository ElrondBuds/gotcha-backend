// server.js - Backend pentru jocul Gotcha

// Importăm librăriile necesare
const express = require("express");
const sdkCore = require("@multiversx/sdk-core");
const sdkWallet = require("@multiversx/sdk-wallet");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // Permitem cereri de la orice origine

// --- CONFIGURARE ---
// Preluăm fraza secretă din fișierul .env (metoda sigură)
const signerMnemonic = process.env.SIGNER_MNEMONIC;
if (!signerMnemonic) {
  console.error("EROARE: Cheia de semnare (SIGNER_MNEMONIC) nu este setată în fișierul .env!");
  process.exit(1);
}

// **CORECTAT:** Modul nou și corect de a crea un signer
const mnemonic = sdkCore.Mnemonic.fromString(signerMnemonic);
const secretKey = mnemonic.deriveKey(0); // Derivăm cheia pentru primul cont (index 0)
const signer = new sdkWallet.UserSigner(secretKey);

console.log(`Adresa publică a robotului (signer): ${signer.getAddress().bech32()}`);


// --- BAZA DE DATE SIMULATĂ ---
// Într-o aplicație reală, ai folosi o bază de date persistentă (ex: Firebase, Supabase).
// Pentru acest exemplu, folosim un obiect în memorie. Datele se vor reseta la repornirea serverului.
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
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Robotul tău de joc este activ pe portul " + listener.address().port);
});
