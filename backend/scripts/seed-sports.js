// Seeds the "sports" collection with a starter set of sports.
// Usage (PowerShell):
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "<path to service account json>"
//   node scripts/seed-sports.js
// Existing docs with the same id are overwritten, other docs are left alone.

const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault() });

const db = admin.firestore();

const SPORTS = [
  { id: "futebol", name: "Futebol", description: "Jogos de futebol e futsal", category: "team" },
  { id: "basquetebol", name: "Basquetebol", description: "Jogos de basquetebol", category: "team" },
  { id: "voleibol", name: "Voleibol", description: "Voleibol indoor e de praia", category: "team" },
  { id: "tenis", name: "Ténis", description: "Singulares e pares", category: "individual" },
  { id: "padel", name: "Padel", description: "Jogos de padel", category: "team" },
  { id: "corrida", name: "Corrida", description: "Corridas e treinos de running", category: "individual" },
  { id: "ciclismo", name: "Ciclismo", description: "Passeios e treinos de bicicleta", category: "individual" },
  { id: "natacao", name: "Natação", description: "Treinos de natação", category: "individual" },
];

async function main() {
  const batch = db.batch();

  for (const sport of SPORTS) {
    batch.set(db.collection("sports").doc(sport.id), sport);
  }

  await batch.commit();
  console.log(`Seeded ${SPORTS.length} sports.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
