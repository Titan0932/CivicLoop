import { getDb } from "../src/lib/db";
import { seedDatabase } from "../src/lib/seed";

const result = seedDatabase(getDb(), process.argv.includes("--reset"));
console.log(`Seed complete: ${result.consultations} consultations, ${result.sources} sources, ${result.events} events.`);
