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

// ── POST /api/auth/login ────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
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
       FROM inventory
       ORDER BY id ASC`
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

  try {
    const result = await pool.query(
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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PUT /api/inventory/:id ──────────────────────────────────────────────────
app.put("/api/inventory/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, hostname, ip, subnet, gateway, mac, usb, floor, ext,
          internet, faceplate, portNumber, switch: switchName, department } = req.body;

  try {
    const result = await pool.query(
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
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/inventory/:id ───────────────────────────────────────────────
app.delete("/api/inventory/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM inventory WHERE id=$1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
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
