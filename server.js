// server.js - Backend pentru jocul Gotcha

import express from 'express';
import cors from 'cors';

// Importăm SDK-urile CommonJS corect în context ESM
import sdkCore from '@multiversx/sdk-core';
import sdkWallet from '@multiversx/sdk-wallet';

const { HDKey } = sdkCore;
const { Mnemonic } = HDKey;
const { UserSigner } = sdkWallet;

// Dacă rulezi local, poți activa dotenv:
// import dotenv from 'dotenv';
// dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURARE ---
const signerMnemonic = process.env.SIGNER_MNEMONIC;
if (!signerMnemonic) {
  console.error("EROARE: Variabila SIGNER_MNEMONIC nu este setată!");
  process.exit(1);
}

const mnemonic = Mnemonic.fromString(signerMnemonic);
const secretKey = mnemonic.deriveKey(0);
const signer = new UserSigner(secretKey);

console.log(`Adresa publică a robotului (signer): ${signer.getAddress().bech32()}`);

// --- MEMORIE SIMULATĂ ---
const gameSessions = {};
const dailyClaims = {};
const TREASURES = ['💎', '🪨'];

app.post("/start-game", (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "Adresa jucătorului lipsește" });

  const sessionId = `session_${address}_${Date.now()}`;
  const board = Array.from({ length: 12 }, () => TREASURES[Math.floor(Math.random() * TREASURES.length)]);

  gameSessions[sessionId] = {
    player: address,
    board,
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
  if (result === '💎') session.score += 1;

  console.log(`Sesiunea ${sessionId}: minat la index ${spotIndex}, găsit ${result}. Scor: ${session.score}`);
  res.json({ result, newScore: session.score });
});

app.post("/request-claim", (req, res) => {
  const { sessionId } = req.body;
  const session = gameSessions[sessionId];
  if (!session) return res.status(404).json({ error: "Sesiune invalidă" });

  const { player, score } = session;
  const today = new Date().toISOString().slice(0, 10);
  if (dailyClaims[player] === today) {
    return res.status(403).json({ error: "Ai revendicat deja recompensa azi." });
  }

  const messageToSign = Buffer.from(`${player};${score}`);
  const signature = signer.sign(messageToSign);
  dailyClaims[player] = today;

  console.log(`Revendicare acceptată pentru ${player}, scor: ${score}`);
  res.json({ score, signature: signature.toString("hex") });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Robotul tău de joc este activ pe portul ${port}`);
});
