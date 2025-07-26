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
        '.rt_cod_boost_cod_order_form form',
        '#cod-form-' + this.getProductId()
      ];

      for (let selector of selectors) {
        const form = document.querySelector(selector);
        if (form) {
          console.log(`✅ COD Form trouvé avec: ${selector}`);
          return form;
        }
      }
      
      // Recherche par contenu des boutons
      const buttons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
      for (let button of buttons) {
        const text = button.textContent || button.value || '';
        if (text.toLowerCase().includes('commander') || 
            text.toLowerCase().includes('confirmer') ||
            text.toLowerCase().includes('cod')) {
          const form = button.closest('form');
          if (form && form.classList.contains('cod-order-form')) {
            console.log('✅ COD Form trouvé via bouton:', text);
            return form;
          }
        }
      }

      return null;
    }

    getProductId() {
      const productContainer = document.querySelector('[data-product-id]');
      if (productContainer) {
        return productContainer.dataset.productId;
      }
      
      const urlMatch = window.location.pathname.match(/\/products\/[\w-]+/);
      return urlMatch ? urlMatch[0].split('/').pop() : 'unknown';
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
        this.initVariantSelector();
        
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

    // 🎯 Sélecteur de variantes
    initVariantSelector() {
      if (!this.form) return;

      const variantSelect = this.form.querySelector('select[name="variant_id"]');
      if (variantSelect) {
        variantSelect.addEventListener('change', (e) => {
          const selectedOption = e.target.selectedOptions[0];
          const price = selectedOption.dataset.price;
          
          const priceInput = this.form.querySelector('input[name="product_price"]');
          if (priceInput && price) {
            priceInput.value = price;
            this.updatePriceDisplay();
          }
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

      this.observeFormChanges();
    }

    observeFormChanges() {
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              if (this.form && !this.form.dataset.codInitialized) {
                this.attachEventListeners();
                this.form.dataset.codInitialized = 'true';
              }
            }
          });
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }

    // 🔧 URL API intelligente selon l'environnement
    getApiUrl() {
      if (window.COD_CONFIG && window.COD_CONFIG.apiUrl) {
        return window.COD_CONFIG.apiUrl;
      }
      
      if (this.isDevelopment) {
        // Essayer d'utiliser le port sauvegardé qui fonctionne
        const savedPort = localStorage.getItem('cod_working_port');
        if (savedPort) {
          return `http://localhost:${savedPort}/apps/cod-boost/api/orders`;
        }
        // Port actuel détecté (change à chaque redémarrage)
        return 'http://localhost:56669/apps/cod-boost/api/orders';
      }
      
      return "/apps/cod-boost/api/orders";
    }

    // 📡 Requête avec gestion des erreurs et fallback avec plusieurs ports
    async tryRequest(url, data) {
      // Ports de développement possibles (le port change à chaque redémarrage)
      const fallbackUrls = [
        url,
        'http://localhost:56669/apps/cod-boost/api/orders', // Port actuel
        'http://localhost:55157/apps/cod-boost/api/orders', // Port précédent
        'http://localhost:56666/apps/cod-boost/api/orders', // Port proxy
        'http://localhost:3000/apps/cod-boost/api/orders',  // Port alternatif
        '/apps/cod-boost/api/orders' // Fallback vers App Proxy
      ];

      for (let testUrl of fallbackUrls) {
        try {
          console.log(`🔄 Tentative: ${testUrl}`);
          
          const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Shop-Domain': this.getShopDomain(),
              ...(this.isDevelopment ? { 'X-COD-Dev-Mode': 'true' } : {})
            },
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          console.log('✅ Requête réussie avec:', testUrl);
          
          // Sauvegarder le port qui fonctionne pour les prochaines requêtes
          if (testUrl.includes('localhost:') && this.isDevelopment) {
            const port = testUrl.match(/localhost:(\d+)/)[1];
            localStorage.setItem('cod_working_port', port);
            console.log('💾 Port sauvegardé:', port);
          }
          
          return response;
          
        } catch (error) {
          console.warn(`❌ Échec avec ${testUrl}:`, error.message);
          if (testUrl === fallbackUrls[fallbackUrls.length - 1]) {
            throw error;
          }
          // Continuer avec le prochain URL
        }
      }
    }

    getShopDomain() {
      if (window.COD_CONFIG && window.COD_CONFIG.shopDomain) {
        return window.COD_CONFIG.shopDomain;
      }
      
      if (window.location.hostname.includes('myshopify.com')) {
        return window.location.hostname;
      }
      
      return 'rt-solutions-test.myshopify.com';
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

        const response = await this.tryRequest(this.getApiUrl(), orderData);
        const result = await response.json();

        console.log('✅ Order submitted successfully:', result);
        this.showSuccess(result);

      } catch (error) {
        console.error('❌ COD Form submission error:', error);
        
        let errorMessage = 'Erreur lors de la soumission. Veuillez réessayer.';
        if (this.isDevelopment) {
          errorMessage += `\n\nDétails: ${error.message}`;
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
      
      // Récupération depuis l'URL si nécessaire
      const urlParams = new URLSearchParams(window.location.search);
      
      const requiredFields = [
        'product_id', 'variant_id', 'product_title', 
        'product_price', 'product_image', 'quantity'
      ];
      
      requiredFields.forEach(field => {
        if (!data[field] && urlParams.has(field)) {
          data[field] = urlParams.get(field);
        }
      });
      
      // Calculs
      const quantity = parseInt(data.quantity) || 1;
      const unitPrice = parseFloat(data.product_price) || 0;
      const subtotal = quantity * unitPrice;
      const deliveryFee = parseFloat(data.delivery_fee) || 0;
      const total = subtotal + deliveryFee;
      
      return {
        ...data,
        quantity: quantity.toString(),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        debug: this.isDevelopment,
        source: 'cod-form-script',
        timestamp: new Date().toISOString()
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
            <div>📦 Numéro: <strong>#${result.orderNumber || result.order_number || result.order_id || 'N/A'}</strong></div>
            ${this.isDevelopment ? '<div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">🔧 Mode développement</div>' : ''}
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

      // Redirection seulement si pas en mode développement
      if (!this.isDevelopment) {
        setTimeout(() => {
          this.redirectToThankYouPage(result);
        }, 2000);
      } else {
        console.log('🔧 Redirection désactivée en mode développement');
      }
    }

    redirectToThankYouPage(result) {
      const orderId = result.order_id || result.shopifyOrderId || result.id;
      const orderNumber = result.orderNumber || result.order_number;
      
      if (orderId) {
        const thankYouUrl = `/checkout/orders/${orderId}/thank_you`;
        console.log('🔄 Redirecting to Shopify thank you page:', thankYouUrl);
        window.location.href = thankYouUrl;
      } else if (orderNumber) {
        const confirmationUrl = `/pages/thank-you?order=${orderNumber}`;
        console.log('🔄 Redirecting to confirmation page:', confirmationUrl);
        window.location.href = confirmationUrl;
      } else {
        const fallbackUrl = '/pages/commande-confirmee';
        console.log('🔄 Redirecting to fallback page:', fallbackUrl);
        window.location.href = fallbackUrl;
      }
    }

    showError(message) {
      if (this.responseDiv) {
        this.responseDiv.innerHTML = `
          <div style="background: #f8d7da; color: #721c24; padding: 15px; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px 0; font-size: 16px;">
            <div style="font-weight: bold; margin-bottom: 10px;">❌ Erreur de commande</div>
            <div style="white-space: pre-line;">${message || 'Une erreur est survenue. Veuillez réessayer.'}</div>
            <div style="margin-top: 10px; font-size: 14px;">Si le problème persiste, contactez-nous directement.</div>
            ${this.isDevelopment ? `
              <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px; font-size: 12px;">
                🔧 Debug Info:<br>
                API URL: ${this.getApiUrl()}<br>
                Shop: ${this.getShopDomain()}<br>
                Mode: ${this.isDevelopment ? 'Développement' : 'Production'}
              </div>
            ` : ''}
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

  // Fonctions utilitaires pour les développeurs
  window.enableCODDebug = function() {
    localStorage.setItem('cod_debug', 'true');
    console.log('🔧 Mode debug COD activé');
    location.reload();
  };

  window.testCODAPI = async function() {
    const testData = {
      customer_name: 'Test Customer',
      customer_phone: '+212600000000',
      customer_email: 'test@example.com',
      delivery_address: '123 Test Street',
      delivery_city: 'Casablanca',
      delivery_postal_code: '20000',
      product_id: '123',
      variant_id: '456',
      product_title: 'Test Product',
      product_price: 10000,
      quantity: 1,
      total: 10000
    };

    // Tester le port actuel détecté
    const currentPort = 56669;
    const testUrl = `http://localhost:${currentPort}/apps/cod-boost/api/orders`;
    
    try {
      console.log('🧪 Test API avec port actuel:', testUrl);
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': 'rt-solutions-test.myshopify.com'
        },
        body: JSON.stringify(testData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Test API réussi:', result);
        return result;
      } else {
        console.error('❌ Test API échoué:', response.status, response.statusText);
        return null;
      }
    } catch (error) {
      console.error('❌ Erreur Test API:', error);
      return null;
    }
  };

  // Fonction pour découvrir le port actif
  window.findCODPort = async function() {
    const testPorts = [56669, 55157, 56666, 3000, 8080];
    
    for (let port of testPorts) {
      try {
        const response = await fetch(`http://localhost:${port}/apps/cod-boost/api/orders`, {
          method: 'GET',
          headers: { 'X-Shopify-Shop-Domain': 'rt-solutions-test.myshopify.com' }
        });
        
        console.log(`✅ Port ${port} répond:`, response.status);
        if (response.status < 500) { // Même une erreur 404 est mieux qu'une connexion refusée
          localStorage.setItem('cod_working_port', port);
          return port;
        }
      } catch (error) {
        console.log(`❌ Port ${port} non disponible`);
      }
    }
    
    console.warn('❌ Aucun port COD trouvé');
    return null;
  };

})();