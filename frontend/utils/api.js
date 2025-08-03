// frontend/utils/api.js
const API_BASE_URL = 'http://localhost:3000';

class APIService {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // Obtenir les commandes COD
  async getCODOrders() {
    return this.request('/orders');
  }

  // Créer une commande COD
  async createCODOrder(orderData) {
    return this.request('/api/cod-order', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  // Statistiques COD (à implémenter côté backend)
  async getCODStats() {
    // Pour l'instant, retourner des données de test
    return {
      totalOrders: 156,
      successfulDeliveries: 142,
      pendingOrders: 14,
      cancelledOrders: 8,
      totalRevenue: 45620,
      averageOrderValue: 293,
    };
  }

  // Récupérer les informations du shop
  async getShopInfo() {
    return this.request('/api/shop');
  }
}

export const apiService = new APIService();