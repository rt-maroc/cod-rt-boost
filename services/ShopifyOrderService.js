// web/services/ShopifyOrderService.js
// Service pour créer des commandes Shopify COD

import shopify from '../shopify.js';

export class ShopifyOrderService {
  
  // Créer une commande Shopify à partir des données COD
  static async createCODOrder(orderData, session) {
    try {
      const client = new shopify.api.clients.Rest({ session });

      // Préparer les données de la commande Shopify
      const shopifyOrder = {
        order: {
          // Informations client
          customer: {
            first_name: this.getFirstName(orderData.customerName),
            last_name: this.getLastName(orderData.customerName),
            email: orderData.customerEmail || `cod+${Date.now()}@temp.com`,
            phone: orderData.customerPhone
          },
          
          // Adresse de livraison
          shipping_address: {
            first_name: this.getFirstName(orderData.customerName),
            last_name: this.getLastName(orderData.customerName),
            address1: orderData.deliveryAddress,
            city: orderData.deliveryCity,
            zip: orderData.deliveryPostalCode,
            country: "Morocco",
            country_code: "MA",
            phone: orderData.customerPhone
          },
          
          // Adresse de facturation (même que livraison pour COD)
          billing_address: {
            first_name: this.getFirstName(orderData.customerName),
            last_name: this.getLastName(orderData.customerName),
            address1: orderData.deliveryAddress,
            city: orderData.deliveryCity,
            zip: orderData.deliveryPostalCode,
            country: "Morocco",
            country_code: "MA",
            phone: orderData.customerPhone
          },
          
          // Articles de la commande
          line_items: [
            {
              variant_id: parseInt(orderData.variantId),
              quantity: parseInt(orderData.quantity),
              price: (orderData.unitPrice / 100).toFixed(2) // Convertir centimes en dirhams
            }
          ],
          
          // Statut financier - en attente pour COD
          financial_status: "pending",
          
          // Notes et tags pour identifier les commandes COD
          note: `Commande COD - Paiement à la livraison\nAdresse: ${orderData.deliveryAddress}, ${orderData.deliveryCity}\nTéléphone: ${orderData.customerPhone}${orderData.orderNotes ? '\nNotes: ' + orderData.orderNotes : ''}`,
          
          tags: "COD,Cash-on-Delivery,Paiement-Livraison",
          
          // Pas de passerelle de paiement (COD)
          gateway: "Cash on Delivery",
          
          // Frais de livraison
          shipping_lines: orderData.deliveryFee > 0 ? [{
            title: "Livraison COD",
            price: (orderData.deliveryFee / 100).toFixed(2),
            code: "COD_DELIVERY"
          }] : [],
          
          // Attributs personnalisés
          note_attributes: [
            {
              name: "Mode de paiement",
              value: "COD (Cash on Delivery)"
            },
            {
              name: "Type de commande",
              value: "Formulaire COD"
            },
            {
              name: "Statut COD",
              value: "En attente de confirmation"
            }
          ],
          
          // Informations de traitement
          processing_method: "manual",
          source_name: "COD Form",
          
          // Désactiver les notifications automatiques
          send_receipt: false,
          send_fulfillment_receipt: false
        }
      };

      console.log('Creating Shopify order with data:', JSON.stringify(shopifyOrder, null, 2));

      // Créer la commande via l'API Shopify
      const response = await client.post({
        path: 'orders',
        data: shopifyOrder
      });

      const createdOrder = response.body.order;
      console.log(`✅ Shopify COD order created: #${createdOrder.order_number} (ID: ${createdOrder.id})`);

      // 🚀 RÉPONSE CORRIGÉE AVEC TOUTES LES CLÉS NÉCESSAIRES
      return {
        success: true,
        order_id: createdOrder.id,              // ✅ Pour la redirection JavaScript
        shopifyOrderId: createdOrder.id,        // ✅ Compatibilité arrière
        orderNumber: createdOrder.order_number, // ✅ Numéro de commande affiché
        order_number: createdOrder.order_number, // ✅ Clé alternative
        total: createdOrder.total_price,
        financial_status: createdOrder.financial_status,
        fulfillment_status: createdOrder.fulfillment_status,
        currency: createdOrder.currency,
        customer_name: `${createdOrder.customer.first_name} ${createdOrder.customer.last_name}`,
        shopifyOrder: createdOrder               // ✅ Données complètes pour debug
      };

    } catch (error) {
      console.error('Error creating Shopify COD order:', error);
      
      // Log détaillé de l'erreur
      if (error.response) {
        console.error('Shopify API Error Response:', error.response.body);
      }
      
      throw new Error(`Failed to create Shopify order: ${error.message}`);
    }
  }

  // Mettre à jour le statut d'une commande COD
  static async updateCODOrderStatus(orderId, status, session) {
    try {
      const client = new shopify.api.clients.Rest({ session });

      let updateData = {};

      switch (status) {
        case 'confirmed':
          updateData = {
            note_attributes: [
              { name: "Statut COD", value: "Confirmée - En préparation" }
            ]
          };
          break;
          
        case 'shipped':
          updateData = {
            fulfillment_status: "fulfilled",
            note_attributes: [
              { name: "Statut COD", value: "Expédiée - En livraison" }
            ]
          };
          break;
          
        case 'delivered':
          updateData = {
            financial_status: "paid", // Marquer comme payée à la livraison
            fulfillment_status: "fulfilled",
            note_attributes: [
              { name: "Statut COD", value: "Livrée et payée" },
              { name: "Date de paiement", value: new Date().toLocaleDateString('fr-FR') }
            ]
          };
          break;
          
        case 'cancelled':
          updateData = {
            cancelled_at: new Date().toISOString(),
            cancel_reason: "customer",
            note_attributes: [
              { name: "Statut COD", value: "Annulée" }
            ]
          };
          break;
      }

      const response = await client.put({
        path: `orders/${orderId}`,
        data: { order: updateData }
      });

      return response.body.order;

    } catch (error) {
      console.error('Error updating Shopify COD order status:', error);
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  // Utilitaires pour parser le nom
  static getFirstName(fullName) {
    return fullName.split(' ')[0] || 'Client';
  }

  static getLastName(fullName) {
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : 'COD';
  }

  // Rechercher les commandes COD
  static async getCODOrders(session, options = {}) {
    try {
      const client = new shopify.api.clients.Rest({ session });

      const queryParams = {
        status: 'any',
        limit: options.limit || 50,
        fields: 'id,order_number,created_at,customer,total_price,financial_status,fulfillment_status,tags,note'
      };

      const response = await client.get({
        path: 'orders',
        query: queryParams
      });

      // Filtrer les commandes COD
      const codOrders = response.body.orders.filter(order => 
        order.tags && order.tags.includes('COD')
      );

      return codOrders;

    } catch (error) {
      console.error('Error fetching COD orders:', error);
      throw new Error(`Failed to fetch COD orders: ${error.message}`);
    }
  }
}