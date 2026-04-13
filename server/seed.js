/**
 * Seed script: imports all 856 records from seed-data.json into PostgreSQL.
 * Run once: node seed.js
 */
require("dotenv").config();
const pool = require("./db");
const data = require("./seed-data.json");

async function seed() {
  const client = await pool.connect();
  try {
    // Check if inventory already has data
    const { rows } = await client.query("SELECT COUNT(*) FROM inventory");
    if (parseInt(rows[0].count) > 0) {
      console.log(`Inventory already has ${rows[0].count} records. Skipping seed.`);
      console.log("To re-seed, truncate the inventory table first: TRUNCATE TABLE inventory RESTART IDENTITY;");
      return;
    }

    console.log(`Seeding ${data.length} records...`);
    let inserted = 0;

    for (const item of data) {
      const updatedAt = item.updatedAt && item.updatedAt.trim() ? item.updatedAt : null;
      const createdAt = item.createdAt && item.createdAt.trim() ? item.createdAt : null;

      await client.query(
        `INSERT INTO inventory
           (asset_id, name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
            internet, faceplate, port_number, switch_name, department, updated_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          item.id || null,
          item.name || null,
          item.hostname || null,
          item.ip || null,
          item.subnet || null,
          item.gateway || null,
          item.mac || null,
          item.usb || null,
          item.floor || null,
          item.ext || null,
          item.internet || null,
          item.faceplate || null,
          item.portNumber || null,
          item.switch || null,
          item.department || null,
          updatedAt,
          createdAt,
        ]
      );
      inserted++;
    }

    console.log(`Seeded ${inserted} records successfully.`);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
