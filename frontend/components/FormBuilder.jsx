import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";

const FormBuilder = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger la liste des champs depuis le backend
  useEffect(() => {
    fetch("/api/fields")
      .then((res) => res.json())
      .then((data) => {
        setFields(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur lors du chargement des champs :", err);
        setLoading(false);
      });
  }, []);

  // Gestion du changement d'état d'un champ
  const toggleField = (index) => {
    const updated = [...fields];
    updated[index].active = !updated[index].active;
    setFields(updated);
  };

  // Sauvegarder la configuration des champs
  const saveFields = () => {
    setSaving(true);
    fetch("/api/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert("✅ Configuration enregistrée avec succès !");
        } else {
          alert("❌ Erreur lors de la sauvegarde.");
        }
        setSaving(false);
      })
      .catch((err) => {
        console.error("Erreur :", err);
        setSaving(false);
      });
  };

  if (loading) return <p>⏳ Chargement des champs...</p>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">⚙️ Configuration des champs du formulaire COD</h2>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <label key={field.key} className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={field.active}
              onChange={() => toggleField(index)}
              className="w-5 h-5"
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>

      <Button
        onClick={saveFields}
        disabled={saving}
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
      >
        {saving ? "💾 Sauvegarde..." : "💾 Enregistrer"}
      </Button>
    </div>
  );
};

export default FormBuilder;
