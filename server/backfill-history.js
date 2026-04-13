/**
 * Backfill history for all existing inventory records that have no history entry.
 * Run once: node backfill-history.js
 */
require("dotenv").config();
const pool = require("./db");

async function backfill() {
  const client = await pool.connect();
  try {
    // Find all inventory records that have no history entry
    const { rows } = await client.query(`
      SELECT i.*
      FROM inventory i
      WHERE NOT EXISTS (
        SELECT 1 FROM ip_history h WHERE h.inventory_id = i.id
      )
      ORDER BY i.id ASC
    `);

    if (rows.length === 0) {
      console.log("No records to backfill. All inventory items already have history.");
      return;
    }

    console.log(`Backfilling history for ${rows.length} records...`);

    let count = 0;
    for (const item of rows) {
      await client.query(
        `INSERT INTO ip_history
           (ip, inventory_id, action, hostname, name, department, floor,
            mac, usb, internet, changed_by, changed_by_name, old_data, new_data, changed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          item.ip,
          item.id,
          "ASSIGNED",
          item.hostname,
          item.name,
          item.department,
          item.floor,
          item.mac,
          item.usb,
          item.internet,
          "system",
          "System (Initial Record)",
          null,
          JSON.stringify(item),
          item.created_at || new Date(),
        ]
      );
      count++;
    }

    console.log(`Done. Backfilled history for ${count} records.`);
  } catch (err) {
    console.error("Backfill error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();
