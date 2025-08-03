// app/services/api.server.ts
const API_BASE_URL = 'https://cod-rt-boost.onrender.com/api';

export interface CODStats {
  totalOrders: number;
  successfulDeliveries: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface CODOrder {
  id: string;
  shopifyOrderId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  region: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CODSettings {
  enabled: boolean;
  availableRegions: string[];
  minimumOrderAmount: number;
  maximumOrderAmount: number;
  shippingCost: number;
  codFee: number;
  autoConfirmation: boolean;
  smsNotifications: boolean;
}

class APIService {
  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RT_COD_API_KEY}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Statistiques COD
  async getCODStats(shopDomain: string): Promise<CODStats> {
    return this.fetchWithAuth(`/shops/${shopDomain}/stats`);
  }

  // Commandes COD
  async getCODOrders(shopDomain: string, page = 1, limit = 20): Promise<{
    orders: CODOrder[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.fetchWithAuth(`/shops/${shopDomain}/orders?page=${page}&limit=${limit}`);
  }

  async updateOrderStatus(orderId: string, status: CODOrder['status']) {
    return this.fetchWithAuth(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Configuration COD
  async getCODSettings(shopDomain: string): Promise<CODSettings> {
    return this.fetchWithAuth(`/shops/${shopDomain}/settings`);
  }

  async updateCODSettings(shopDomain: string, settings: Partial<CODSettings>) {
    return this.fetchWithAuth(`/shops/${shopDomain}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Synchronisation avec Shopify
  async syncShopifyOrder(shopDomain: string, orderData: any) {
    return this.fetchWithAuth(`/shops/${shopDomain}/sync-order`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  // Régions et zones de livraison
  async getShippingRegions(shopDomain: string) {
    return this.fetchWithAuth(`/shops/${shopDomain}/shipping-regions`);
  }

  async updateShippingRegions(shopDomain: string, regions: any[]) {
    return this.fetchWithAuth(`/shops/${shopDomain}/shipping-regions`, {
      method: 'PUT',
      body: JSON.stringify({ regions }),
    });
  }

  // Analytics
  async getCODAnalytics(shopDomain: string, period: '7d' | '30d' | '90d' = '30d') {
    return this.fetchWithAuth(`/shops/${shopDomain}/analytics?period=${period}`);
  }
}

export const apiService = new APIService();