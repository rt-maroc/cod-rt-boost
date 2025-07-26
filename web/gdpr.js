// web/gdpr.js
// Handlers pour les webhooks GDPR

export default {
  CUSTOMERS_DATA_REQUEST: {
    deliveryMethod: "http",
    callbackUrl: "/api/webhooks",
  },
  CUSTOMERS_REDACT: {
    deliveryMethod: "http", 
    callbackUrl: "/api/webhooks",
  },
  SHOP_REDACT: {
    deliveryMethod: "http",
    callbackUrl: "/api/webhooks", 
  },
};