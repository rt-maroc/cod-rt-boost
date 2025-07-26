// web/models/CodOrder.js
// Modèle pour les commandes COD

export class CodOrder {
  constructor(data) {
    this.id = data.id || null;
    this.shopDomain = data.shopDomain;
    this.orderNumber = data.orderNumber || this.generateOrderNumber();
    
    // Informations produit
    this.productId = data.productId;
    this.variantId = data.variantId;
    this.productTitle = data.productTitle;
    this.productImage = data.productImage;
    this.quantity = parseInt(data.quantity) || 1;
    this.unitPrice = parseFloat(data.unitPrice) || 0;
    this.subtotal = parseFloat(data.subtotal) || 0;
    this.deliveryFee = parseFloat(data.deliveryFee) || 0;
    this.total = parseFloat(data.total) || 0;
    
    // Informations client
    this.customerName = data.customerName;
    this.customerPhone = data.customerPhone;
    this.customerEmail = data.customerEmail || null;
    
    // Adresse de livraison
    this.deliveryAddress = data.deliveryAddress;
    this.deliveryCity = data.deliveryCity;
    this.deliveryPostalCode = data.deliveryPostalCode || null;
    this.orderNotes = data.orderNotes || null;
    
    // Statut et métadonnées
    this.status = data.status || 'pending'; // pending, confirmed, delivered, cancelled
    this.paymentStatus = data.paymentStatus || 'pending'; // pending, paid
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.confirmedAt = data.confirmedAt || null;
    this.deliveredAt = data.deliveredAt || null;
    
    // Métadonnées Shopify
    this.shopifyOrderId = data.shopifyOrderId || null; // ID de la commande Shopify créée
    this.trackingNumber = data.trackingNumber || null;
  }

  generateOrderNumber() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `COD${timestamp}${random}`;
  }

  // Validation des données
  validate() {
    const errors = [];

    if (!this.shopDomain) errors.push('Shop domain is required');
    if (!this.productId) errors.push('Product ID is required');
    if (!this.customerName?.trim()) errors.push('Customer name is required');
    if (!this.customerPhone?.trim()) errors.push('Customer phone is required');
    if (!this.deliveryAddress?.trim()) errors.push('Delivery address is required');
    if (!this.deliveryCity?.trim()) errors.push('Delivery city is required');
    if (this.quantity < 1) errors.push('Quantity must be at least 1');
    if (this.total < 0) errors.push('Total cannot be negative');

    // Validation téléphone (format basique)
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{9,}$/;
    if (this.customerPhone && !phoneRegex.test(this.customerPhone)) {
      errors.push('Invalid phone number format');
    }

    // Validation email si fourni
    if (this.customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.customerEmail)) {
        errors.push('Invalid email format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Conversion pour sauvegarde en base
  toDatabase() {
    return {
      shop_domain: this.shopDomain,
      order_number: this.orderNumber,
      product_id: this.productId,
      variant_id: this.variantId,
      product_title: this.productTitle,
      product_image: this.productImage,
      quantity: this.quantity,
      unit_price: this.unitPrice,
      subtotal: this.subtotal,
      delivery_fee: this.deliveryFee,
      total: this.total,
      customer_name: this.customerName,
      customer_phone: this.customerPhone,
      customer_email: this.customerEmail,
      delivery_address: this.deliveryAddress,
      delivery_city: this.deliveryCity,
      delivery_postal_code: this.deliveryPostalCode,
      order_notes: this.orderNotes,
      status: this.status,
      payment_status: this.paymentStatus,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      confirmed_at: this.confirmedAt,
      delivered_at: this.deliveredAt,
      shopify_order_id: this.shopifyOrderId,
      tracking_number: this.trackingNumber
    };
  }

  // Création depuis données de base
  static fromDatabase(dbData) {
    return new CodOrder({
      id: dbData.id,
      shopDomain: dbData.shop_domain,
      orderNumber: dbData.order_number,
      productId: dbData.product_id,
      variantId: dbData.variant_id,
      productTitle: dbData.product_title,
      productImage: dbData.product_image,
      quantity: dbData.quantity,
      unitPrice: dbData.unit_price,
      subtotal: dbData.subtotal,
      deliveryFee: dbData.delivery_fee,
      total: dbData.total,
      customerName: dbData.customer_name,
      customerPhone: dbData.customer_phone,
      customerEmail: dbData.customer_email,
      deliveryAddress: dbData.delivery_address,
      deliveryCity: dbData.delivery_city,
      deliveryPostalCode: dbData.delivery_postal_code,
      orderNotes: dbData.order_notes,
      status: dbData.status,
      paymentStatus: dbData.payment_status,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at,
      confirmedAt: dbData.confirmed_at,
      deliveredAt: dbData.delivered_at,
      shopifyOrderId: dbData.shopify_order_id,
      trackingNumber: dbData.tracking_number
    });
  }

  // Méthodes utilitaires
  getStatusText() {
    const statusMap = {
      'pending': 'En attente',
      'confirmed': 'Confirmée',
      'delivered': 'Livrée',
      'cancelled': 'Annulée'
    };
    return statusMap[this.status] || this.status;
  }

  getPaymentStatusText() {
    const paymentMap = {
      'pending': 'En attente',
      'paid': 'Payée'
    };
    return paymentMap[this.paymentStatus] || this.paymentStatus;
  }

  canBeConfirmed() {
    return this.status === 'pending';
  }

  canBeDelivered() {
    return this.status === 'confirmed';
  }

  canBeCancelled() {
    return ['pending', 'confirmed'].includes(this.status);
  }

  // Mise à jour du statut
  updateStatus(newStatus, updatedBy = null) {
    const validStatuses = ['pending', 'confirmed', 'delivered', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    this.status = newStatus;
    this.updatedAt = new Date();

    if (newStatus === 'confirmed') {
      this.confirmedAt = new Date();
    } else if (newStatus === 'delivered') {
      this.deliveredAt = new Date();
      this.paymentStatus = 'paid'; // Automatiquement payé à la livraison
    }
  }
}