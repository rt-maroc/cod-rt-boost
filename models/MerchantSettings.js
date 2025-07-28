// models/MerchantSettings.js
// Gestion des paramètres par merchant/shop

class MerchantSettings {
  constructor(db) {
    this.db = db;
    this.initTable();
  }

  // Créer la table des paramètres si elle n'existe pas
  initTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS merchant_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_domain TEXT UNIQUE NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating merchant_settings table:', err);
      } else {
        console.log('Merchant settings table ready');
      }
    });
  }

  // Obtenir les paramètres d'un shop
  async getSettings(shopDomain) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT settings FROM merchant_settings WHERE shop_domain = ?',
        [shopDomain],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve(JSON.parse(row.settings));
          } else {
            // Retourner les paramètres par défaut si aucun n'existe
            resolve(this.getDefaultSettings());
          }
        }
      );
    });
  }

  // Sauvegarder les paramètres d'un shop
  async saveSettings(shopDomain, settings) {
    const settingsJson = JSON.stringify(settings);
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO merchant_settings (shop_domain, settings, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP) 
         ON CONFLICT(shop_domain) 
         DO UPDATE SET settings = ?, updated_at = CURRENT_TIMESTAMP`,
        [shopDomain, settingsJson, settingsJson],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  // Mettre à jour une section spécifique des paramètres
  async updateSettingsSection(shopDomain, section, data) {
    const currentSettings = await this.getSettings(shopDomain);
    const updatedSettings = {
      ...currentSettings,
      [section]: {
        ...currentSettings[section],
        ...data
      }
    };
    
    return this.saveSettings(shopDomain, updatedSettings);
  }

  // Paramètres par défaut pour un nouveau merchant
  getDefaultSettings() {
    return {
      general: {
        codEnabled: true,
        companyName: '',
        contactPhone: '',
        contactEmail: ''
      },
      email: {
        emailService: 'gmail',
        gmailAddress: '',
        gmailPassword: '',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
        senderEmail: '',
        senderName: ''
      },
      notifications: {
        customerConfirmation: true,
        customerShipped: false,
        adminNotification: true,
        adminEmails: [],
        confirmationMessage: 'Merci pour votre commande ! Vous serez contacté sous peu pour confirmer la livraison.',
        paymentInstructions: 'Vous paierez directement au livreur lors de la réception de votre commande. Merci de préparer le montant exact.'
      },
      delivery: {
        deliveryFee: 30,
        freeDeliveryEnabled: false,
        freeDeliveryThreshold: 500,
        deliveryCities: ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger'],
        deliveryTime: '48h'
      }
    };
  }

  // Obtenir les paramètres email d'un shop pour l'envoi
  async getEmailConfig(shopDomain) {
    const settings = await this.getSettings(shopDomain);
    const emailSettings = settings.email;
    
    // Construire la configuration selon le service choisi
    if (emailSettings.emailService === 'gmail') {
      return {
        service: 'gmail',
        auth: {
          user: emailSettings.gmailAddress,
          pass: emailSettings.gmailPassword
        },
        from: `"${emailSettings.senderName || settings.general.companyName}" <${emailSettings.senderEmail || emailSettings.gmailAddress}>`
      };
    } else if (emailSettings.emailService === 'smtp') {
      return {
        host: emailSettings.smtpHost,
        port: emailSettings.smtpPort,
        secure: emailSettings.smtpPort === 465,
        auth: {
          user: emailSettings.smtpUser,
          pass: emailSettings.smtpPass
        },
        from: `"${emailSettings.senderName || settings.general.companyName}" <${emailSettings.senderEmail}>`
      };
    }
    
    // Configuration par défaut si rien n'est configuré
    return null;
  }

  // Vérifier si les emails sont configurés pour un shop
  async isEmailConfigured(shopDomain) {
    const settings = await this.getSettings(shopDomain);
    const email = settings.email;
    
    if (email.emailService === 'gmail') {
      return !!(email.gmailAddress && email.gmailPassword);
    } else if (email.emailService === 'smtp') {
      return !!(email.smtpHost && email.smtpUser && email.smtpPass);
    }
    
    return false;
  }
}

module.exports = MerchantSettings;