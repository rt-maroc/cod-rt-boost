const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const fieldsFile = path.join(__dirname, "../../data/fields.json");

// GET - Lire les champs
router.get("/api/fields", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(fieldsFile, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Erreur lecture fields.json :", error);
    res.json([]);
  }
});

// POST - Sauvegarder les champs
router.post("/api/fields", (req, res) => {
  try {
    fs.writeFileSync(fieldsFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur écriture fields.json :", error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
