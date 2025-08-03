import { useState, useEffect } from 'react';
import {
  Card,
  Page,
  Layout,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Banner,
  Stack,
  TextStyle
} from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';

export default function Settings() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formConfig, setFormConfig] = useState({
    buttonText: 'Order Now',
    successMessage: 'Order sent successfully!',
    errorMessage: 'Error sending order',
    formTitle: 'Cash on Delivery Order'
  });

  // Charger les champs depuis le backend
  useEffect(() => {
    fetch("/api/fields")
      .then(res => res.json())
      .then(data => {
        setFields(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur chargement fields :", err);
        setLoading(false);
      });
  }, []);

  // Toggle d'un champ actif/inactif
  const handleFieldToggle = (index) => {
    const updated = [...fields];
    updated[index].active = !updated[index].active;
    setFields(updated);
  };

  // Sauvegarder la configuration des champs
  const handleSave = async () => {
    try {
      const res = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ Configuration enregistrée avec succès !");
      } else {
        alert("❌ Erreur lors de la sauvegarde.");
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  if (loading) {
    return <p style={{ padding: '20px' }}>⏳ Chargement des champs...</p>;
  }

  return (
    <Page
      title="COD Form Configuration"
      primaryAction={{ content: 'Save Configuration', onAction: handleSave }}
    >
      <TitleBar title="Configure COD Form" />
      
      <Layout>
        {/* Sélection des champs */}
        <Layout.Section>
          <Card title="Form Fields Configuration" sectioned>
            <Stack vertical>
              <TextStyle variation="subdued">
                Select which fields to display in your COD form
              </TextStyle>

              {fields.map((field, index) => (
                <Checkbox
                  key={field.key}
                  label={field.label}
                  checked={field.active}
                  onChange={() => handleFieldToggle(index)}
                />
              ))}
            </Stack>
          </Card>
        </Layout.Section>

        {/* Personnalisation du formulaire */}
        <Layout.Section>
          <Card title="Form Customization" sectioned>
            <FormLayout>
              <TextField
                label="Form Title"
                value={formConfig.formTitle}
                onChange={(value) => setFormConfig(prev => ({...prev, formTitle: value}))}
              />
              
              <TextField
                label="Order Button Text"
                value={formConfig.buttonText}
                onChange={(value) => setFormConfig(prev => ({...prev, buttonText: value}))}
              />
              
              <TextField
                label="Success Message"
                value={formConfig.successMessage}
                onChange={(value) => setFormConfig(prev => ({...prev, successMessage: value}))}
              />
              
              <TextField
                label="Error Message"
                value={formConfig.errorMessage}
                onChange={(value) => setFormConfig(prev => ({...prev, errorMessage: value}))}
              />
            </FormLayout>
          </Card>
        </Layout.Section>

        {/* Aperçu */}
        <Layout.Section>
          <Banner title="Preview" status="info">
            Your COD form will appear on product pages with the selected fields and customization.
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
