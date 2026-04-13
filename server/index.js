require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "bank_inventory_secret_2024";

app.use(cors());
app.use(express.json());

// ── Auth middleware ─────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const token = header.replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── Database initialization ─────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50),
        dept VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        asset_id VARCHAR(50),
        name VARCHAR(255),
        hostname VARCHAR(255),
        ip VARCHAR(50),
        subnet VARCHAR(50),
        gateway VARCHAR(50),
        mac VARCHAR(50),
        usb VARCHAR(10),
        floor VARCHAR(100),
        ext VARCHAR(50),
        internet VARCHAR(10),
        faceplate VARCHAR(100),
        port_number VARCHAR(100),
        switch_name VARCHAR(100),
        department VARCHAR(255),
        updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ip_history (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(50),
        inventory_id INTEGER,
        action VARCHAR(20) NOT NULL,
        hostname VARCHAR(255),
        name VARCHAR(255),
        department VARCHAR(255),
        floor VARCHAR(100),
        mac VARCHAR(50),
        usb VARCHAR(10),
        internet VARCHAR(10),
        changed_by VARCHAR(100),
        changed_by_name VARCHAR(255),
        old_data JSONB,
        new_data JSONB,
        changed_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ip_history_ip ON ip_history(ip);
      CREATE INDEX IF NOT EXISTS idx_ip_history_changed_at ON ip_history(changed_at DESC);
    `);

    // Seed default users if none exist
    const { rowCount } = await client.query("SELECT 1 FROM users LIMIT 1");
    if (rowCount === 0) {
      const adminHash = await bcrypt.hash("admin123", 10);
      const staffHash = await bcrypt.hash("bank2024", 10);
      await client.query(
        `INSERT INTO users (username, password, name, role, dept) VALUES
         ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)`,
        [
          "admin", adminHash, "System Administrator", "Admin", "IT Division",
          "itdiv", staffHash, "IT Division User", "Staff", "IT Division",
        ]
      );
      console.log("Default users seeded.");
    }

    console.log("Database initialized.");
  } finally {
    client.release();
  }
}

// ── History logger helper ───────────────────────────────────────────────────
async function logHistory(client, { ip, inventoryId, action, record, oldRecord, changedBy, changedByName }) {
  await client.query(
    `INSERT INTO ip_history
       (ip, inventory_id, action, hostname, name, department, floor, mac, usb, internet,
        changed_by, changed_by_name, old_data, new_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      ip || record?.ip,
      inventoryId,
      action,
      record?.hostname || null,
      record?.name || null,
      record?.department || null,
      record?.floor || null,
      record?.mac || null,
      record?.usb || null,
      record?.internet || null,
      changedBy,
      changedByName,
      oldRecord ? JSON.stringify(oldRecord) : null,
      record ? JSON.stringify(record) : null,
    ]
  );
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rowCount === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, dept: user.dept },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({
      token,
      user: { username: user.username, name: user.name, role: user.role, dept: user.dept },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/inventory ──────────────────────────────────────────────────────
app.get("/api/inventory", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, asset_id AS "assetId", name, hostname, ip, subnet, gateway,
              mac, usb, floor, ext, internet, faceplate,
              port_number AS "portNumber", switch_name AS "switch",
              department,
              TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
              TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt"
       FROM inventory ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/inventory ─────────────────────────────────────────────────────
app.post("/api/inventory", authMiddleware, async (req, res) => {
  const { name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
          internet, faceplate, portNumber, switch: switchName, department } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Duplicate IP check ──────────────────────────────────────────────────
    if (ip && ip.trim()) {
      const dupCheck = await client.query(
        "SELECT id, hostname, name, department FROM inventory WHERE TRIM(ip) = TRIM($1) LIMIT 1",
        [ip]
      );
      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        const existing = dupCheck.rows[0];
        return res.status(409).json({
          error: "DUPLICATE_IP",
          message: `IP address ${ip} is already assigned.`,
          existing: {
            id: existing.id,
            hostname: existing.hostname,
            name: existing.name,
            department: existing.department,
          },
        });
      }
    }

    const result = await client.query(
      `INSERT INTO inventory
         (name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
          internet, faceplate, port_number, switch_name, department, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
       RETURNING id, id::text AS asset_id, name, hostname, ip, subnet, gateway,
                 mac, usb, floor, ext, internet, faceplate,
                 port_number AS "portNumber", switch_name AS "switch",
                 department,
                 TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
                 TO_CHAR(created_at,'YYYY-MM-DD HH24:MI:SS') AS "createdAt"`,
      [name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
       internet, faceplate, portNumber, switchName, department]
    );
    const created = result.rows[0];
    await logHistory(client, {
      ip: created.ip,
      inventoryId: created.id,
      action: "ASSIGNED",
      record: created,
      oldRecord: null,
      changedBy: req.user.username,
      changedByName: req.user.name,
    });
    await client.query("COMMIT");
    res.status(201).json(created);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── PUT /api/inventory/:id ──────────────────────────────────────────────────
app.put("/api/inventory/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
          internet, faceplate, portNumber, switch: switchName, department } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Fetch old record before update
    const oldResult = await client.query("SELECT * FROM inventory WHERE id=$1", [id]);
    if (oldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    const oldRecord = oldResult.rows[0];

    const result = await client.query(
      `UPDATE inventory
       SET name=$1, hostname=$2, ip=$3, subnet=$4, gateway=$5, mac=$6,
           usb=$7, floor=$8, ext=$9, internet=$10, faceplate=$11,
           port_number=$12, switch_name=$13, department=$14, updated_at=NOW()
       WHERE id=$15
       RETURNING id, id::text AS asset_id, name, hostname, ip, subnet, gateway,
                 mac, usb, floor, ext, internet, faceplate,
                 port_number AS "portNumber", switch_name AS "switch",
                 department,
                 TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
                 TO_CHAR(created_at,'YYYY-MM-DD HH24:MI:SS') AS "createdAt"`,
      [name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
       internet, faceplate, portNumber, switchName, department, id]
    );
    const updated = result.rows[0];

    // Log history for the new IP (if IP changed, also log RELEASED on old IP)
    if (oldRecord.ip && oldRecord.ip !== ip) {
      await logHistory(client, {
        ip: oldRecord.ip,
        inventoryId: parseInt(id),
        action: "IP_CHANGED",
        record: updated,
        oldRecord,
        changedBy: req.user.username,
        changedByName: req.user.name,
      });
    }
    await logHistory(client, {
      ip: ip || oldRecord.ip,
      inventoryId: parseInt(id),
      action: "UPDATED",
      record: updated,
      oldRecord,
      changedBy: req.user.username,
      changedByName: req.user.name,
    });

    await client.query("COMMIT");
    res.json(updated);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── DELETE /api/inventory/:id ───────────────────────────────────────────────
app.delete("/api/inventory/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const oldResult = await client.query("SELECT * FROM inventory WHERE id=$1", [id]);
    if (oldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    const oldRecord = oldResult.rows[0];
    await client.query("DELETE FROM inventory WHERE id=$1", [id]);
    await logHistory(client, {
      ip: oldRecord.ip,
      inventoryId: parseInt(id),
      action: "RELEASED",
      record: null,
      oldRecord,
      changedBy: req.user.username,
      changedByName: req.user.name,
    });
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── GET /api/history ────────────────────────────────────────────────────────
app.get("/api/history", authMiddleware, async (req, res) => {
  const { ip, action, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (ip) { params.push(`%${ip}%`); conditions.push(`ip ILIKE $${params.length}`); }
  if (action) { params.push(action); conditions.push(`action = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(parseInt(limit), offset);

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ip_history ${where}`,
      params.slice(0, params.length - 2)
    );
    const result = await pool.query(
      `SELECT id, ip, inventory_id AS "inventoryId", action, hostname, name,
              department, floor, mac, usb, internet,
              changed_by AS "changedBy", changed_by_name AS "changedByName",
              old_data AS "oldData", new_data AS "newData",
              TO_CHAR(changed_at, 'YYYY-MM-DD HH24:MI:SS') AS "changedAt"
       FROM ip_history ${where}
       ORDER BY changed_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      rows: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/history/export ─────────────────────────────────────────────────
app.get("/api/history/export", authMiddleware, async (req, res) => {
  const { ip, action } = req.query;
  const conditions = [];
  const params = [];

  if (ip) { params.push(`%${ip}%`); conditions.push(`ip ILIKE $${params.length}`); }
  if (action) { params.push(action); conditions.push(`action = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT ip, action, hostname, name, department, floor, mac, usb, internet,
              changed_by, changed_by_name,
              TO_CHAR(changed_at, 'YYYY-MM-DD HH24:MI:SS') AS changed_at
       FROM ip_history ${where}
       ORDER BY changed_at DESC`,
      params
    );

    const headers = ["IP Address","Action","Hostname","User/Device","Department","Floor","MAC Address","USB","Internet","Changed By","Changed By Name","Date & Time"];
    const rows = result.rows.map(r => [
      r.ip, r.action, r.hostname, r.name, r.department, r.floor,
      r.mac, r.usb, r.internet, r.changed_by, r.changed_by_name, r.changed_at,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const filename = ip ? `ip_history_${ip.replace(/\./g, "_")}.csv` : `ip_history_all.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ── Start ───────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
