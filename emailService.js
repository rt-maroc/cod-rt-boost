// emailService.js - Service d'envoi d'emails multi-merchant
const nodemailer = require('nodemailer');

class EmailService {
  constructor(merchantSettings) {
    this.merchantSettings = merchantSettings;
    this.transporters = new Map(); // Cache des transporteurs par shop
  }

  // Obtenir ou créer un transporteur pour un shop
  async getTransporter(shopDomain) {
    // Vérifier le cache
    if (this.transporters.has(shopDomain)) {
      return this.transporters.get(shopDomain);
    }

    // Obtenir la configuration email du merchant
    const emailConfig = await this.merchantSettings.getEmailConfig(shopDomain);
    
    if (!emailConfig) {
      console.warn(`❌ Email non configuré pour ${shopDomain}`);
      return null;
    }

    try {
      // Créer le transporteur selon la configuration
      const transporter = nodemailer.createTransporter({
        service: emailConfig.service,
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth
      });

      // Vérifier la connexion
      await transporter.verify();
      console.log(`✅ Email configuré pour ${shopDomain}`);
      
      // Mettre en cache
      this.transporters.set(shopDomain, {
        transporter,
        from: emailConfig.from
      });
      
      return this.transporters.get(shopDomain);
    } catch (error) {
      console.error(`❌ Erreur configuration email pour ${shopDomain}:`, error.message);
      return null;
    }
  }

  // Envoyer l'email de confirmation au client
  async sendCustomerConfirmation(shopDomain, order) {
    try {
      // Vérifier si les emails sont activés pour ce merchant
      const settings = await this.merchantSettings.getSettings(shopDomain);
      if (!settings.notifications.customerConfirmation) {
        console.log('📧 Email client désactivé pour', shopDomain);
        return;
      }

      // Obtenir le transporteur
      const transporterConfig = await this.getTransporter(shopDomain);
      if (!transporterConfig) {
        console.error('❌ Pas de configuration email pour', shopDomain);
        return;
      }

      const { transporter, from } = transporterConfig;
      const orderData = this.formatOrderData(order, settings);
      const emailHTML = this.generateCustomerEmailHTML(orderData, settings);

      const mailOptions = {
        from: from,
        to: orderData.customerEmail,
        subject: `Confirmation de commande #${orderData.orderNumber} - ${settings.general.companyName}`,
        html: emailHTML,
        text: this.generateTextVersion(orderData, settings)
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email client envoyé pour ${shopDomain}:`, info.messageId);
      return info;

    } catch (error) {
      console.error(`❌ Erreur envoi email client pour ${shopDomain}:`, error);
      throw error;
    }
  }

  // Envoyer une notification aux admins
  async sendAdminNotification(shopDomain, order) {
    try {
      const settings = await this.merchantSettings.getSettings(shopDomain);
      if (!settings.notifications.adminNotification || !settings.notifications.adminEmails?.length) {
        console.log('📧 Notification admin désactivée ou pas d\'emails configurés pour', shopDomain);
        return;
      }

      const transporterConfig = await this.getTransporter(shopDomain);
      if (!transporterConfig) return;

      const { transporter, from } = transporterConfig;
      const orderData = this.formatOrderData(order, settings);

      const mailOptions = {
        from: from,
        to: settings.notifications.adminEmails.join(', '),
        subject: `🆕 Nouvelle commande COD #${orderData.orderNumber}`,
        html: this.generateAdminEmailHTML(orderData, settings)
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email admin envoyé pour ${shopDomain}:`, info.messageId);
      return info;

    } catch (error) {
      console.error(`❌ Erreur envoi email admin pour ${shopDomain}:`, error);
      // Ne pas faire échouer la commande si l'email admin échoue
      return null;
    }
  }

  // Envoyer un email de test
  async sendTestEmail(shopDomain, testEmail) {
    try {
      const transporterConfig = await this.getTransporter(shopDomain);
      if (!transporterConfig) {
        throw new Error('Configuration email non trouvée');
      }

      const { transporter, from } = transporterConfig;
      const settings = await this.merchantSettings.getSettings(shopDomain);

      const mailOptions = {
        from: from,
        to: testEmail,
        subject: `Test email - ${settings.general.companyName}`,
        html: `
          <h2>Test de configuration email</h2>
          <p>Félicitations ! Votre configuration email fonctionne correctement.</p>
          <p>Cet email a été envoyé depuis : ${from}</p>
          <hr>
          <p><strong>${settings.general.companyName}</strong></p>
        `
      };

      await transporter.sendMail(mailOptions);
      return { success: true, message: 'Email de test envoyé avec succès' };

    } catch (error) {
      console.error('Erreur test email:', error);
      return { success: false, message: error.message };
    }
  }

  // Formater les données de commande
  formatOrderData(order, settings) {
    const orderNumber = order.name || order.order_number || `COD-${Date.now()}`;
    const orderDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subtotal = order.subtotal_price || order.line_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = order.shipping_lines?.[0]?.price || settings.delivery.deliveryFee || 30;
    const total = order.total_price || (subtotal + shipping);

    const orderItems = order.line_items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.name || item.title}
          ${item.variant_title ? `<br><small style="color: #666;">${item.variant_title}</small>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ${(item.price || 0).toFixed(2)} DH
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ${((item.price || 0) * item.quantity).toFixed(2)} DH
        </td>
      </tr>
    `).join('');

    return {
      orderNumber,
      orderDate,
      orderItems,
      subtotal: subtotal.toFixed(2),
      shipping: shipping.toFixed(2),
      total: total.toFixed(2),
      customerName: `${order.customer.first_name} ${order.customer.last_name}`,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone || order.customer.default_address?.phone || 'Non fourni',
      shippingAddress: order.shipping_address?.address1 || order.customer.default_address?.address1 || '',
      shippingCity: order.shipping_address?.city || order.customer.default_address?.city || '',
      orderStatusUrl: order.order_status_url || `https://${order.shop_domain}/pages/order-tracking?order=${orderNumber}`,
      companyName: settings.general.companyName,
      contactPhone: settings.general.contactPhone,
      contactEmail: settings.general.contactEmail,
      confirmationMessage: settings.notifications.confirmationMessage,
      paymentInstructions: settings.notifications.paymentInstructions
    };
  }

  // Générer l'email HTML pour le client
  generateCustomerEmailHTML(orderData, settings) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmation de commande COD</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e5e5; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #000; }
        h1 { color: #000; font-size: 24px; margin: 20px 0; }
        .order-info { background-color: #f8f8f8; border-radius: 6px; padding: 20px; margin: 20px 0; }
        .order-number { font-size: 18px; font-weight: bold; color: #000; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background-color: #f8f8f8; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5; }
        .items-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .total-row { font-weight: bold; font-size: 18px; background-color: #f8f8f8; }
        .shipping-info { background-color: #fff8e1; border-radius: 6px; padding: 20px; margin: 20px 0; border: 1px solid #ffd54f; }
        .payment-notice { background-color: #e8f5e9; border-radius: 6px; padding: 20px; margin: 20px 0; border: 1px solid #81c784; text-align: center; }
        .cta-button { display: inline-block; background-color: #000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 600; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">${orderData.companyName}</div>
            <h1>Confirmation de votre commande</h1>
        </div>

        <div class="order-info">
            <div class="order-number">Commande #${orderData.orderNumber}</div>
            <p>Date: ${orderData.orderDate}</p>
            <p>Mode de paiement: Paiement à la livraison (COD)</p>
        </div>

        <p>${orderData.confirmationMessage}</p>

        <h2>Détails de la commande</h2>
        <table class="items-table">
            <thead>
                <tr>
                    <th>Article</th>
                    <th>Quantité</th>
                    <th>Prix</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${orderData.orderItems}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="text-align: right;">Sous-total:</td>
                    <td>${orderData.subtotal} DH</td>
                </tr>
                <tr>
                    <td colspan="3" style="text-align: right;">Livraison:</td>
                    <td>${orderData.shipping} DH</td>
                </tr>
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">Total à payer:</td>
                    <td>${orderData.total} DH</td>
                </tr>
            </tfoot>
        </table>

        <div class="shipping-info">
            <h3>Adresse de livraison</h3>
            <p>
                <strong>${orderData.customerName}</strong><br>
                ${orderData.shippingAddress}<br>
                ${orderData.shippingCity}<br>
                Téléphone: ${orderData.customerPhone}
            </p>
        </div>

        <div class="payment-notice">
            <h3>💳 Paiement à la livraison</h3>
            <p>${orderData.paymentInstructions}</p>
            <p><strong>Montant à préparer: ${orderData.total} DH</strong></p>
        </div>

        <div style="text-align: center;">
            <a href="${orderData.orderStatusUrl}" class="cta-button">Suivre ma commande</a>
        </div>

        <div class="footer">
            <p>Des questions? Contactez-nous:</p>
            <p>📞 ${orderData.contactPhone} | ✉️ ${orderData.contactEmail}</p>
            <p>Merci de votre confiance!</p>
            <p>${orderData.companyName}</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Générer l'email HTML pour l'admin
  generateAdminEmailHTML(orderData, settings) {
    return `
      <h2>Nouvelle commande COD reçue</h2>
      <h3>Informations de la commande:</h3>
      <ul>
        <li><strong>Numéro:</strong> #${orderData.orderNumber}</li>
        <li><strong>Date:</strong> ${orderData.orderDate}</li>
        <li><strong>Total:</strong> ${orderData.total} DH</li>
        <li><strong>Client:</strong> ${orderData.customerName}</li>
        <li><strong>Téléphone:</strong> ${orderData.customerPhone}</li>
        <li><strong>Email:</strong> ${orderData.customerEmail}</li>
        <li><strong>Ville:</strong> ${orderData.shippingCity}</li>
      </ul>
      
      <h3>Articles commandés:</h3>
      <table border="1" cellpadding="10" cellspacing="0">
        <tr>
          <th>Article</th>
          <th>Quantité</th>
          <th>Prix unitaire</th>
          <th>Total</th>
        </tr>
        ${orderData.orderItems}
      </table>
      
      <p><a href="${orderData.orderStatusUrl}" style="background: #000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voir la commande</a></p>
    `;
  }

  // Générer une version texte de l'email
  generateTextVersion(orderData, settings) {
    return `
Confirmation de votre commande

Commande: #${orderData.orderNumber}
Date: ${orderData.orderDate}
Total: ${orderData.total} DH

Mode de paiement: Paiement à la livraison (COD)

Adresse de livraison:
${orderData.customerName}
${orderData.shippingAddress}
${orderData.shippingCity}
Téléphone: ${orderData.customerPhone}

${orderData.confirmationMessage}

Merci pour votre commande!
${orderData.companyName}
    `;
  }

  // Nettoyer le cache des transporteurs (appeler périodiquement)
  clearCache() {
    this.transporters.clear();
    console.log('📧 Cache des transporteurs email nettoyé');
  }
}

module.exports = EmailService;