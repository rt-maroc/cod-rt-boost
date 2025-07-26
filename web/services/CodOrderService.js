// web/services/CODOrderService.js - Version PostgreSQL
import { pool } from './DatabaseService.js';

export class CODOrderService {
  
  // Sauvegarder une commande COD
  static async saveOrder(orderData) {
    try {
      const query = `
        INSERT INTO cod_orders (
          shop_domain,
          shopify_order_id,
          order_number,
          product_id,
          variant_id,
          product_title,
          product_image,
          quantity,
          unit_price,
          total,
          delivery_fee,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          delivery_city,
          delivery_postal_code,
          order_notes,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
        RETURNING *
      `;

      const values = [
        orderData.shopDomain,
        orderData.shopifyOrderId,
        orderData.orderNumber,
        orderData.productId,
        orderData.variantId,
        orderData.productTitle,
        orderData.productImage,
        orderData.quantity,
        orderData.unitPrice,
        orderData.total,
        orderData.deliveryFee || 0,
        orderData.customerName,
        orderData.customerPhone,
        orderData.customerEmail,
        orderData.deliveryAddress,
        orderData.deliveryCity,
        orderData.deliveryPostalCode,
        orderData.orderNotes,
        orderData.status || 'pending'
      ];

      const client = await pool.connect();
      const result = await client.query(query, values);
      client.release();
      
      console.log('✅ Commande COD sauvegardée en PostgreSQL avec ID:', result.rows[0].id);
      
      return result.rows[0];

    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde en PostgreSQL:', error);
      throw new Error(`Erreur base de données: ${error.message}`);
    }
  }

  // Récupérer toutes les commandes COD
  static async getAllOrders(shopDomain) {
    try {
      const query = `
        SELECT * FROM cod_orders 
        WHERE shop_domain = $1 
        ORDER BY created_at DESC
      `;

      const client = await pool.connect();
      const result = await client.query(query, [shopDomain]);
      client.release();

      return result.rows;

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des commandes:', error);
      throw new Error(`Erreur base de données: ${error.message}`);
    }
  }

  // Récupérer une commande par ID Shopify
  static async getOrderByShopifyId(shopifyOrderId) {
    try {
      const query = `
        SELECT * FROM cod_orders 
        WHERE shopify_order_id = $1
      `;

      const client = await pool.connect();
      const result = await client.query(query, [shopifyOrderId]);
      client.release();

      return result.rows[0];

    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la commande:', error);
      throw new Error(`Erreur base de données: ${error.message}`);
    }
  }

  // Mettre à jour le statut d'une commande
  static async updateOrderStatus(shopifyOrderId, status, notes = null) {
    try {
      let query = `
        UPDATE cod_orders 
        SET status = $1, updated_at = NOW()
      `;
      let values = [status];

      if (notes) {
        query += `, order_notes = $2 WHERE shopify_order_id = $3`;
        values = [status, notes, shopifyOrderId];
      } else {
        query += ` WHERE shopify_order_id = $2`;
        values = [status, shopifyOrderId];
      }

      const client = await pool.connect();
      const result = await client.query(query, values);
      client.release();
      
      if (result.rowCount === 0) {
        throw new Error('Commande non trouvée');
      }

      console.log('✅ Statut de la commande mis à jour:', shopifyOrderId, 'vers', status);
      return true;

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut:', error);
      throw new Error(`Erreur base de données: ${error.message}`);
    }
  }

  // Obtenir des statistiques sur les commandes COD
  static async getOrderStats(shopDomain) {
    try {
      const queries = {
        total: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = $1`,
        pending: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = $1 AND status = 'pending'`,
        confirmed: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = $1 AND status = 'confirmed'`,
        delivered: `SELECT COUNT(*) as count FROM cod_orders WHERE shop_domain = $1 AND status = 'delivered'`,
        totalRevenue: `SELECT SUM(total) as revenue FROM cod_orders WHERE shop_domain = $1 AND status IN ('delivered', 'confirmed')`
      };

      const client = await pool.connect();
      const stats = {};

      for (const [key, query] of Object.entries(queries)) {
        const result = await client.query(query, [shopDomain]);
        stats[key] = result.rows[0].count || result.rows[0].revenue || 0;
      }

      client.release();
      return stats;

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error);
      throw new Error(`Erreur base de données: ${error.message}`);
    }
  }

  // Rechercher des commandes par critères
  static async searchOrders(shopDomain, criteria) {
    try {
      let query = `SELECT * FROM cod_orders WHERE shop_domain = $1`;
      let values = [shopDomain];
      let paramIndex = 2;

      if (criteria.customerName) {
        query += ` AND customer_name ILIKE $${paramIndex}`;
        values.push(`%${criteria.customerName}%`);
        paramIndex++;
      }

      if (criteria.customerPhone) {
        query += ` AND customer_phone LIKE $${paramIndex}`;
        values.push(`%${criteria.customerPhone}%`);
        paramIndex++;
      }

      if (criteria.status) {
        query += ` AND status = $${paramIndex}`;
        values.push(criteria.status);
        paramIndex++;
      }

      if (criteria.dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        values.push(criteria.dateFrom);
        paramIndex++;
      }

      if (criteria.dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        values.push(criteria.dateTo);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC`;

      if (criteria.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(criteria.limit);
      }

      const client = await pool.connect();
      const result = await client.query(query, values);
      client.release();

      return result.rows;

    } catch (error) {
      console.error('❌ Erreur lors de la recherche de commandes:', error);
      throw new Error(`Erreur base de données: ${error.message}`);
    }
  }

  // Méthode compatible pour le service existant
  static async create(orderData) {
    return this.saveOrder(orderData);
  }

  // Notification de commande (placeholder)
  static async sendOrderNotification(order) {
    try {
      console.log('📧 Notification pour commande:', order.id);
      // TODO: Implémenter l'envoi d'email/SMS
      return true;
    } catch (error) {
      console.warn('⚠️ Erreur lors de l\'envoi de notification:', error.message);
      return false;
    }
  }
}