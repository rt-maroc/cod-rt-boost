(function() {
  'use strict';

  class CODForm {
    constructor() {
      this.maxRetries = 10;
      this.currentRetry = 0;
      this.isDevelopment = this.detectDevelopmentMode();
      this.initForm();
    }

    // 🔍 Détection du mode développement
    detectDevelopmentMode() {
      return (
        window.Shopify?.designMode || 
        window.location.href.includes('preview_theme_id') ||
        window.location.href.includes('editor') ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.hostname.includes('localhost') ||
        localStorage.getItem('cod_debug') === 'true'
      );
    }

    // 🔍 Recherche intelligente du formulaire
    findForm() {
      const selectors = [
        '#cod-order-form',
        '.cod-order-form', 
        '[data-cod-form]',
        'form[action*="cod"]',
        'form.cod-form',
        '.rt_cod_boost_cod_order_form form'
      ];

      for (let selector of selectors) {
        const form = document.querySelector(selector);
        if (form) {
          console.log(`✅ COD Form trouvé avec: ${selector}`);
          return form;
        }
      }
      
      return null;
    }

    // 🔄 Initialisation avec retry
    initForm() {
      const form = this.findForm();
      
      if (form) {
        this.form = form;
        this.submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        this.responseDiv = document.querySelector('#cod-response') || 
                          document.querySelector('.cod-response') ||
                          this.createResponseDiv();
        
        this.attachEventListeners();
        this.initQuantityControls();
        
        console.log('✅ COD Form initialisé avec succès');
        
        if (this.isDevelopment) {
          console.log('🔧 Mode développement détecté');
        }
        
        return true;
      } else {
        this.currentRetry++;
        if (this.currentRetry < this.maxRetries) {
          console.log(`🔄 Retry ${this.currentRetry}/${this.maxRetries} - Recherche du formulaire...`);
          setTimeout(() => this.initForm(), 500);
        } else {
          console.warn('❌ COD Form introuvable après', this.maxRetries, 'tentatives');
        }
        return false;
      }
    }

    createResponseDiv() {
      const div = document.createElement('div');
      div.id = 'cod-response';
      div.className = 'cod-response';
      
      if (this.form) {
        this.form.parentNode.insertBefore(div, this.form.nextSibling);
      } else {
        document.body.appendChild(div);
      }
      
      return div;
    }

    // 🎯 Contrôles de quantité
    initQuantityControls() {
      if (!this.form) return;

      const qtyInput = this.form.querySelector('input[name="quantity"]');
      const plusBtn = this.form.querySelector('.cod-qty-plus');
      const minusBtn = this.form.querySelector('.cod-qty-minus');

      if (qtyInput && plusBtn && minusBtn) {
        plusBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const currentValue = parseInt(qtyInput.value) || 1;
          const maxValue = parseInt(qtyInput.getAttribute('max')) || 99;
          if (currentValue < maxValue) {
            qtyInput.value = currentValue + 1;
            this.updatePriceDisplay();
          }
        });

        minusBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const currentValue = parseInt(qtyInput.value) || 1;
          const minValue = parseInt(qtyInput.getAttribute('min')) || 1;
          if (currentValue > minValue) {
            qtyInput.value = currentValue - 1;
            this.updatePriceDisplay();
          }
        });

        qtyInput.addEventListener('change', () => {
          this.updatePriceDisplay();
        });
      }
    }

    // 💰 Mise à jour de l'affichage du prix
    updatePriceDisplay() {
      const qtyInput = this.form.querySelector('input[name="quantity"]');
      const priceInput = this.form.querySelector('input[name="product_price"]');
      const priceDisplay = document.getElementById('cod-display-price');

      if (qtyInput && priceInput && priceDisplay) {
        const quantity = parseInt(qtyInput.value) || 1;
        const unitPrice = parseFloat(priceInput.value) || 0;
        const total = quantity * unitPrice;

        const formattedPrice = new Intl.NumberFormat('fr-MA', {
          style: 'currency',
          currency: 'MAD',
          minimumFractionDigits: 0
        }).format(total / 100);

        priceDisplay.textContent = formattedPrice;
      }
    }

    attachEventListeners() {
      if (!this.form) return;

      const handleSubmit = (e) => {
        console.log('📝 Form submission intercepted');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleSubmit(e);
        return false;
      };

      this.form.addEventListener('submit', handleSubmit, true);
      this.form.onsubmit = handleSubmit;

      if (this.submitButton) {
        const handleButtonClick = (e) => {
          console.log('🔘 Button click intercepted');
          e.preventDefault();
          e.stopPropagation();
          this.handleSubmit(e);
          return false;
        };

        this.submitButton.addEventListener('click', handleButtonClick, true);
        this.submitButton.onclick = handleButtonClick;
      }
    }

    // 🔧 URL API - UTILISERA TOUJOURS L'APP PROXY
    getApiUrl() {
      // 1. Configuration prioritaire depuis le thème
      if (window.COD_CONFIG && window.COD_CONFIG.apiUrl) {
        console.log('🎯 Using configured API URL:', window.COD_CONFIG.apiUrl);
        return window.COD_CONFIG.apiUrl;
      }
      
      // 2. App Proxy par défaut (PRODUCTION)
      const appProxyUrl = `/apps/cod-boost/api/orders`;
      console.log('🌍 Using App Proxy URL:', appProxyUrl);
      return appProxyUrl;
    }

    getShopDomain() {
      // 1. Configuration explicite
      if (window.COD_CONFIG && window.COD_CONFIG.shopDomain) {
        return window.COD_CONFIG.shopDomain;
      }
      
      // 2. Variable Shopify Liquid (si disponible)
      if (window.Shopify && window.Shopify.shop) {
        return window.Shopify.shop;
      }
      
      // 3. Détection depuis l'URL
      if (window.location.hostname.includes('myshopify.com')) {
        return window.location.hostname;
      }
      
      // 4. Fallback
      return 'rt-solutions-test.myshopify.com';
    }

    // 📡 Requête simplifiée pour App Proxy
    async makeRequest(url, data) {
      console.log(`🔄 Envoi vers: ${url}`);
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Requête réussie');
      return response;
    }

    // 📋 Traitement de la soumission
    async handleSubmit(e) {
      console.log('🚀 COD Form submission started');
      
      // En mode prévisualisation, montrer une démo
      if (window.Shopify && window.Shopify.designMode && !this.isDevelopment) {
        this.showDemoSuccess();
        return;
      }

      try {
        this.setLoading(true);

        const formData = new FormData(this.form);
        const orderData = this.prepareOrderData(formData);

        console.log('📦 Order data:', orderData);
        console.log('🌐 API URL:', this.getApiUrl());

        const response = await this.makeRequest(this.getApiUrl(), orderData);
        const result = await response.json();

        console.log('✅ Order submitted successfully:', result);
        this.showSuccess(result);

      } catch (error) {
        console.error('❌ COD Form submission error:', error);
        
        let errorMessage = 'Erreur lors de la soumission. Veuillez réessayer.';
        if (this.isDevelopment) {
          errorMessage += `\n\nDétails: ${error.message}`;
          errorMessage += `\nAPI URL: ${this.getApiUrl()}`;
        }
        
        this.showError(errorMessage);
      } finally {
        this.setLoading(false);
      }
    }

    prepareOrderData(formData) {
      const data = {};
      for (let [key, value] of formData.entries()) {
        data[key] = value;
      }
      
      // Récupérer les informations produit depuis la page
      if (!data.product_id && window.ShopifyAnalytics?.meta?.product?.id) {
        data.product_id = window.ShopifyAnalytics.meta.product.id;
      }
      
      if (!data.variant_id && window.ShopifyAnalytics?.meta?.product?.variants?.[0]?.id) {
        data.variant_id = window.ShopifyAnalytics.meta.product.variants[0].id;
      }
      
      // Calculs
      const quantity = parseInt(data.quantity) || 1;
      const unitPrice = parseFloat(data.product_price) || 0;
      const subtotal = quantity * unitPrice;
      const deliveryFee = parseFloat(data.delivery_fee) || 3000; // 30 DH par défaut
      const total = subtotal + deliveryFee;
      
      return {
        ...data,
        quantity: quantity.toString(),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        source: 'cod-form-script',
        timestamp: new Date().toISOString(),
        shop_domain: this.getShopDomain(),
        page_url: window.location.href
      };
    }

    setLoading(isLoading) {
      if (this.submitButton) {
        this.submitButton.disabled = isLoading;
        const originalText = this.submitButton.dataset.originalText || 
                           this.submitButton.textContent || 
                           this.submitButton.value;
        
        if (!this.submitButton.dataset.originalText) {
          this.submitButton.dataset.originalText = originalText;
        }
        
        if (this.submitButton.tagName === 'BUTTON') {
          this.submitButton.innerHTML = isLoading ? 
            '⏳ Traitement...' : 
            '<span class="cod-btn-text">' + originalText + '</span>';
        } else {
          this.submitButton.value = isLoading ? '⏳ Traitement...' : originalText;
        }
      }
    }

    // 🎭 Succès de démo pour l'éditeur de thème
    showDemoSuccess() {
      if (this.responseDiv) {
        this.responseDiv.innerHTML = `
          <div style="background: #e0f2fe; color: #0277bd; padding: 15px; border: 1px solid #81d4fa; border-radius: 8px; margin: 20px 0; font-size: 16px; text-align: center;">
            <div style="font-weight: bold; margin-bottom: 10px;">🎭 Aperçu du formulaire COD</div>
            <div>Cette démo montre comment fonctionne le formulaire</div>
            <div style="margin-top: 10px; font-size: 14px;">Le formulaire sera fonctionnel sur votre boutique en ligne</div>
          </div>
        `;
        this.responseDiv.scrollIntoView({ behavior: 'smooth' });
      }
    }

    showSuccess(result) {
      if (this.responseDiv) {
        this.responseDiv.innerHTML = `
          <div style="background: #d4edda; color: #155724; padding: 15px; border: 1px solid #c3e6cb; border-radius: 8px; margin: 20px 0; font-size: 16px; text-align: center;">
            <div style="font-weight: bold; margin-bottom: 10px;">✅ Commande confirmée avec succès!</div>
            <div>📦 Numéro: <strong>#${result.orderNumber || result.order_number || result.order_id || 'COD-' + Date.now()}</strong></div>
            <div style="margin-top: 10px; font-size: 14px;">Merci pour votre commande ! Vous serez contacté sous peu.</div>
            <div style="margin-top: 15px;">
              <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #155724; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span style="margin-left: 10px;">Redirection vers la page de confirmation...</span>
            </div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;
        
        this.responseDiv.scrollIntoView({ behavior: 'smooth' });
      }

      // Redirection automatique après succès
      setTimeout(() => {
        this.redirectToThankYouPage(result);
      }, 2000);
    }

    redirectToThankYouPage(result) {
      const orderId = result.order_id || result.shopifyOrderId || result.id;
      const orderNumber = result.orderNumber || result.order_number;
      
      // Essayer la page de remerciement Shopify d'abord
      if (orderId && orderId !== 'COD-' + Date.now()) {
        const thankYouUrl = `/checkout/orders/${orderId}/thank_you`;
        console.log('🔄 Redirecting to Shopify thank you page:', thankYouUrl);
        window.location.href = thankYouUrl;
        return;
      }
      
      // Sinon, page de confirmation personnalisée
      if (orderNumber) {
        const confirmationUrl = `/pages/commande-confirmee?order=${orderNumber}`;
        console.log('🔄 Redirecting to confirmation page:', confirmationUrl);
        window.location.href = confirmationUrl;
        return;
      }
      
      // Fallback vers page générique
      const fallbackUrl = '/pages/merci-commande';
      console.log('🔄 Redirecting to fallback page:', fallbackUrl);
      window.location.href = fallbackUrl;
    }

    showError(message) {
      if (this.responseDiv) {
        this.responseDiv.innerHTML = `
          <div style="background: #f8d7da; color: #721c24; padding: 15px; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px 0; font-size: 16px;">
            <div style="font-weight: bold; margin-bottom: 10px;">❌ Erreur de commande</div>
            <div style="white-space: pre-line;">${message || 'Une erreur est survenue. Veuillez réessayer.'}</div>
            <div style="margin-top: 10px; font-size: 14px;">Si le problème persiste, contactez-nous directement.</div>
          </div>
        `;
        
        this.responseDiv.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // 🚀 Initialisation robuste
  function initCODForm() {
    console.log('🎯 Initialising COD Form...');
    
    if (typeof window.CODFormInstance === 'undefined') {
      window.CODFormInstance = new CODForm();
    }
  }

  // Points d'entrée multiples
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCODForm);
  } else {
    initCODForm();
  }

  setTimeout(initCODForm, 1000);

  if (window.Shopify && window.Shopify.designMode) {
    setTimeout(initCODForm, 2000);
  }

  // 🧪 Fonctions de debug
  window.enableCODDebug = function() {
    localStorage.setItem('cod_debug', 'true');
    console.log('🔧 Mode debug COD activé');
    location.reload();
  };

  window.testCODConnection = async function() {
    try {
      const response = await fetch('/apps/cod-boost/test');
      const data = await response.json();
      console.log('✅ App Proxy accessible:', data);
      return true;
    } catch (error) {
      console.error('❌ Erreur App Proxy:', error);
      return false;
    }
  };

})();