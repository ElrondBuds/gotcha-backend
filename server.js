// server.js - Backend pentru jocul Gotcha

import express from 'express';
import cors from 'cors';
import { Mnemonic } from '@multiversx/sdk-core';
import { UserSigner } from '@multiversx/sdk-wallet';

// Dacă rulezi local și ai fișier .env, decomentează liniile de mai jos:
// import dotenv from 'dotenv';
// dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Permitem cereri de la orice origine

// --- CONFIGURARE ---
// Preluăm fraza secretă din variabila de mediu
const signerMnemonic = process.env.SIGNER_MNEMONIC;
if (!signerMnemonic) {
  console.error("EROARE: Cheia de semnare (SIGNER_MNEMONIC) nu este setată în fișierul .env sau în variabilele de mediu!");
  process.exit(1);
}

// Creăm semnatarul
const mnemonic = Mnemonic.fromString(signerMnemonic);
const secretKey = mnemonic.deriveKey(0); // Derivăm cheia pentru primul cont (index 0)
const signer = new UserSigner(secretKey);

console.log(`Adresa publică a robotului (signer): ${signer.getAddress().bech32()}`);

// --- BAZA DE DATE SIMULATĂ ---
const gameSessions = {};
const dailyClaims = {};

// --- LOGICA JOCULUI ---
const TREASURES = ['💎', '🪨']; // Probabilitate 50%

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

app.post("/request-claim", (req, res) => {
  const { sessionId } = req.body;
  const session = gameSessions[sessionId];

  if (!session) return res.status(404).json({ error: "Sesiune invalidă" });

  const { player, score } = session;

  const today = new Date().toISOString().slice(0, 10);
  if (dailyClaims[player] === today) {
    return res.status(403).json({ error: "Ai revendicat deja recompensa pentru ziua de azi." });
  }

  const messageToSign = Buffer.from(`${player};${score}`);
  const signature = signer.sign(messageToSign);

  dailyClaims[player] = today;

  console.log(`Cerere de revendicare validată pentru ${player} cu scorul ${score}.`);
  res.json({
    score: score,
    signature: signature.toString("hex")
  });
});

const port = process.env.PORT || 3000;
const listener = app.listen(port, () => {
  console.log("Robotul tău de joc este activ pe portul " + listener.address().port);
});
