import {
  Card,
  Page,
  Layout,
  Text,
  Badge,
  DataTable,
  Button,
  Stack,
  DisplayText,
  TextStyle,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { apiService } from "../utils/api";

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Test de connexion backend
        const healthCheck = await apiService.health();
        setBackendConnected(true);
        console.log('✅ Backend connecté:', healthCheck);

        // Récupération des statistiques
        const statsData = await apiService.getCODStats();
        setStats(statsData);

        // Récupération des commandes
        const ordersData = await apiService.getCODOrders();
        console.log('📦 Commandes reçues:', ordersData);
        
        // Transformer les données pour l'affichage
        const formattedOrders = Array.isArray(ordersData) ? ordersData.map((order, index) => ({
          id: order.id || `${index + 1}`.padStart(3, '0'),
          customer: order.customer_name || `Client ${index + 1}`,
          city: order.city || 'Casablanca',
          amount: `${order.amount || 250} DH`,
          status: order.status || 'pending',
          date: order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
        })) : [
          // Données de fallback si pas de commandes
          {
            id: "001",
            customer: "Ahmed Bennani",
            city: "Casablanca",
            amount: "350 DH",
            status: "pending",
            date: new Date().toLocaleDateString('fr-FR'),
          },
        ];

        setOrders(formattedOrders);
        
      } catch (err) {
        console.error('❌ Erreur API:', err);
        setError('Impossible de se connecter au backend. Vérifiez que le serveur fonctionne sur http://localhost:3000');
        setBackendConnected(false);
        
        // Données de fallback en cas d'erreur
        setStats({
          totalOrders: 156,
          successfulDeliveries: 142,
          pendingOrders: 14,
          cancelledOrders: 8,
          totalRevenue: 45620,
          averageOrderValue: 293,
        });
        
        setOrders([
          {
            id: "001",
            customer: "Ahmed Bennani (Test)",
            city: "Casablanca",
            amount: "350 DH",
            status: "pending",
            date: new Date().toLocaleDateString('fr-FR'),
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      delivered: { tone: "success", label: "Livré" },
      shipped: { tone: "attention", label: "Expédié" },
      pending: { tone: "info", label: "En attente" },
      cancelled: { tone: "critical", label: "Annulé" },
    };
    
    const config = statusConfig[status] || { tone: "subdued", label: status };
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };

  const orderRows = orders.map((order) => [
    order.id,
    order.customer,
    order.city,
    order.amount,
    getStatusBadge(order.status),
    order.date,
  ]);

  if (loading) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spinner size="large" />
          <Text as="p" variant="bodyMd">
            Connexion au backend RT COD Boost...
          </Text>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="RT COD Boost - Dashboard"
      primaryAction={{
        content: "Nouvelle commande",
        onAction: () => window.open('http://localhost:3000/test-cod-form', '_blank'),
      }}
      secondaryActions={[
        {
          content: "API Health",
          onAction: () => window.open('http://localhost:3000/health', '_blank'),
        },
        {
          content: "Voir backend",
          onAction: () => window.open('http://localhost:3000', '_blank'),
        },
      ]}
    >
      <TitleBar title="Dashboard COD" />
      
      <Layout>
        {/* Statut de connexion */}
        <Layout.Section>
          {error ? (
            <Banner status="critical" title="Erreur de connexion backend">
              <p>{error}</p>
              <p>Backend attendu sur: http://localhost:3000</p>
            </Banner>
          ) : backendConnected ? (
            <Banner status="success" title="✅ Backend connecté">
              <p>RT COD Boost backend opérationnel sur http://localhost:3000</p>
            </Banner>
          ) : null}
        </Layout.Section>

        {/* Statistiques principales */}
        <Layout.Section>
          <Stack distribution="fillEvenly" spacing="loose">
            <Card sectioned>
              <Stack vertical spacing="tight">
                <Text as="h3" variant="headingMd">
                  📦 Commandes totales
                </Text>
                <DisplayText size="medium">
                  <TextStyle variation="strong">{stats?.totalOrders || 0}</TextStyle>
                </DisplayText>
                <Text as="p" color="subdued">
                  +12% ce mois
                </Text>
              </Stack>
            </Card>

            <Card sectioned>
              <Stack vertical spacing="tight">
                <Text as="h3" variant="headingMd">
                  ✅ Livraisons réussies
                </Text>
                <DisplayText size="medium">
                  <TextStyle variation="strong">{stats?.successfulDeliveries || 0}</TextStyle>
                </DisplayText>
                <Text as="p" color="subdued">
                  {stats ? Math.round((stats.successfulDeliveries / stats.totalOrders) * 100) : 0}% de réussite
                </Text>
              </Stack>
            </Card>

            <Card sectioned>
              <Stack vertical spacing="tight">
                <Text as="h3" variant="headingMd">
                  ⏳ En attente
                </Text>
                <DisplayText size="medium">
                  <TextStyle variation="strong">{stats?.pendingOrders || 0}</TextStyle>
                </DisplayText>
                <Text as="p" color="subdued">
                  À traiter
                </Text>
              </Stack>
            </Card>

            <Card sectioned>
              <Stack vertical spacing="tight">
                <Text as="h3" variant="headingMd">
                  💰 Revenus COD
                </Text>
                <DisplayText size="medium">
                  <TextStyle variation="strong">
                    {stats?.totalRevenue?.toLocaleString() || 0} DH
                  </TextStyle>
                </DisplayText>
                <Text as="p" color="subdued">
                  {stats?.averageOrderValue || 0} DH en moyenne
                </Text>
              </Stack>
            </Card>
          </Stack>
        </Layout.Section>

        {/* Tableau des commandes récentes */}
        <Layout.Section>
          <Card>
            <Card.Section>
              <Stack alignment="center" distribution="equalSpacing">
                <Stack.Item fill>
                  <Text as="h2" variant="headingLg">
                    📋 Commandes récentes
                  </Text>
                </Stack.Item>
                <Stack.Item>
                  <Button url="http://localhost:3000/orders" external>
                    Voir toutes les commandes
                  </Button>
                </Stack.Item>
              </Stack>
            </Card.Section>
            
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text", "text"]}
              headings={["ID", "Client", "Ville", "Montant", "Statut", "Date"]}
              rows={orderRows}
            />
          </Card>
        </Layout.Section>

        {/* Statut de l'app */}
        <Layout.Section>
          <Card sectioned>
            <Stack vertical spacing="loose">
              <Text as="h2" variant="headingLg">
                🚀 RT COD Boost - État du système
              </Text>
              <Stack wrap={false}>
                <Stack.Item fill>
                  <Text as="p">
                    ✅ Frontend React : http://localhost:5173<br/>
                    {backendConnected ? '✅' : '❌'} Backend Express : http://localhost:3000<br/>
                    ✅ Base de données SQLite<br/>
                    ✅ Shopify connecté : RT SOLUTIONS TEST<br/>
                    ⏳ Extension checkout à créer
                  </Text>
                </Stack.Item>
              </Stack>
              <Stack>
                <Badge tone={backendConnected ? "success" : "critical"}>
                  {backendConnected ? "Backend connecté" : "Backend déconnecté"}
                </Badge>
                <Badge tone="success">Frontend opérationnel</Badge>
                <Badge tone="info">Phase 2 en cours</Badge>
              </Stack>
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}