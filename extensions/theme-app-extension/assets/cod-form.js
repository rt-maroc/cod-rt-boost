// COD Form Script v3.0 - Version corrigée pour RT COD Boost
console.log('🎯 Initialising COD Form v3.0...');

// Fonction utilitaire pour récupérer les valeurs en sécurité
function safeGetValue(element) {
    if (!element) return '';
    if (typeof element === 'string') return element.trim();
    return element.value ? element.value.trim() : '';
}

// Fonction utilitaire pour récupérer un élément par sélecteur
function safeGetElement(selector) {
    try {
        return document.querySelector(selector);
    } catch (e) {
        console.warn(`⚠️ Élément non trouvé: ${selector}`);
        return null;
    }
}

// Configuration COD - MISE À JOUR pour votre serveur
const COD_CONFIG = {
    // 🔥 API URL corrigée pour votre serveur
    apiUrl: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/orders/create'
        : 'https://rt-cod-boost.onrender.com/api/orders/create',
    debug: window.COD_CONFIG?.debug || false,
    shopDomain: 'rtmaroc.myshopify.com' // Votre shop domain
};

console.log('🎯 COD Config loaded:', COD_CONFIG);

class CODForm {
    constructor() {
        this.form = null;
        this.isSubmitting = false;
        this.retryCount = 0;
        this.maxRetries = 10;
        this.currentRetry = 0;
        this.init();
    }

    init() {
        // Chercher le formulaire COD avec plusieurs méthodes
        this.form = this.findForm();
        
        if (!this.form) {
            this.currentRetry++;
            if (this.currentRetry < this.maxRetries) {
                console.log(`🔄 Retry ${this.currentRetry}/${this.maxRetries} - Recherche du formulaire...`);
                setTimeout(() => this.init(), 500);
            } else {
                console.warn('❌ COD Form introuvable après', this.maxRetries, 'tentatives');
            }
            return;
        }

        console.log('✅ COD Form trouvé:', this.form.className || this.form.id);
        this.setupEventListeners();
        this.initQuantityControls();
        console.log('✅ COD Form initialisé avec succès - v3.0');
    }

    findForm() {
        const selectors = [
            '#cod-form',
            '#cod-order-form', 
            '.cod-order-form',
            '[data-cod-form]',
            'form[action*="cod"]',
            'form.cod-form',
            '.rt_cod_boost_cod_order_form form',
            'form:has(input[name="customer_name"])', // Formulaire avec champ nom client
            'form:has(input[name="customer_phone"])'  // Formulaire avec champ téléphone
        ];

        for (let selector of selectors) {
            try {
                const form = document.querySelector(selector);
                if (form) {
                    console.log(`✅ Formulaire trouvé avec: ${selector}`);
                    return form;
                }
            } catch (e) {
                // Certains sélecteurs avancés peuvent ne pas marcher sur tous les navigateurs
                continue;
            }
        }
        
        return null;
    }

    setupEventListeners() {
        // Intercepter la soumission du formulaire
        this.form.addEventListener('submit', (e) => this.handleSubmit(e), true);
        
        // Intercepter les clics sur les boutons
        const buttons = this.form.querySelectorAll('button[type="submit"], input[type="submit"]');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => this.handleButtonClick(e), true);
        });
    }

    handleButtonClick(e) {
        console.log('🔘 Button click intercepted');
        
        if (this.isSubmitting) {
            e.preventDefault();
            return false;
        }
        
        // Empêcher le comportement par défaut et déclencher notre logique
        e.preventDefault();
        setTimeout(() => {
            this.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }, 100);
    }

    async handleSubmit(e) {
        console.log('📝 Form submission intercepted');
        e.preventDefault();
        e.stopPropagation();
        
        if (this.isSubmitting) {
            return false;
        }

        this.isSubmitting = true;
        
        try {
            // Collecter les données du formulaire de manière sécurisée
            const formData = this.collectFormData();
            
            // Valider les données
            const validation = this.validateFormData(formData);
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            // Traiter la commande
            await this.processOrder(formData);
            
        } catch (error) {
            console.error('❌ Erreur lors de la soumission:', error);
            this.handleError(error);
        } finally {
            this.isSubmitting = false;
        }
    }

    collectFormData() {
        const data = {};
        
        // 🔥 COLLECTE DE DONNÉES FLEXIBLE - Plusieurs noms de champs possibles
        const fieldMappings = {
            // Nom client
            customer_name: ['customer_name', 'nom', 'name', 'full_name', 'client_name'],
            
            // Téléphone
            customer_phone: ['customer_phone', 'telephone', 'phone', 'tel', 'mobile'],
            
            // Email
            customer_email: ['customer_email', 'email', 'e_mail', 'mail'],
            
            // Adresse
            delivery_address: ['delivery_address', 'adresse', 'address', 'shipping_address'],
            
            // Ville
            delivery_city: ['delivery_city', 'ville', 'city', 'shipping_city'],
            
            // Code postal
            delivery_postal_code: ['delivery_postal_code', 'code_postal', 'postal_code', 'zip'],
            
            // Commentaires
            order_notes: ['order_notes', 'commentaire', 'notes', 'note', 'comments'],
            
            // Quantité
            quantity: ['quantity', 'quantite', 'qty']
        };
        
        // Collecter toutes les données possibles
        Object.keys(fieldMappings).forEach(key => {
            const possibleNames = fieldMappings[key];
            let value = '';
            
            for (const fieldName of possibleNames) {
                const element = this.form.querySelector(`[name="${fieldName}"]`) ||
                               this.form.querySelector(`#${fieldName}`) ||
                               this.form.querySelector(`.${fieldName}`);
                
                if (element) {
                    value = safeGetValue(element);
                    if (value) break; // Prendre la première valeur trouvée
                }
            }
            
            data[key] = value;
        });

        // Récupérer les informations du produit depuis les inputs cachés ou data attributes
        data.product_id = this.getProductInfo('product_id') || this.getProductInfo('product-id');
        data.variant_id = this.getProductInfo('variant_id') || this.getProductInfo('variant-id'); 
        data.product_price = this.getProductInfo('product_price') || this.getProductInfo('price');
        
        // Quantité par défaut
        data.quantity = data.quantity || '1';

        console.log('📊 Données collectées:', data);
        return data;
    }

    getProductInfo(fieldName) {
        // Chercher dans les inputs cachés
        const input = this.form.querySelector(`input[name="${fieldName}"]`) ||
                     this.form.querySelector(`input[data-${fieldName}]`);
        
        if (input) {
            return safeGetValue(input);
        }
        
        // Chercher dans les data attributes du formulaire
        const dataValue = this.form.dataset[fieldName] || this.form.dataset[fieldName.replace('_', '')];
        if (dataValue) {
            return dataValue;
        }
        
        // Chercher dans les variables globales
        if (window.COD_PRODUCT_DATA && window.COD_PRODUCT_DATA[fieldName]) {
            return window.COD_PRODUCT_DATA[fieldName];
        }
        
        return '';
    }

    validateFormData(data) {
        const errors = [];
        
        // Validation flexible - seulement les champs vraiment critiques
        if (!data.customer_name && !data.customer_name) {
            errors.push('Veuillez indiquer votre nom complet');
        }
        
        if (!data.customer_phone) {
            errors.push('Le numéro de téléphone est requis');
        } else if (data.customer_phone.length < 8) {
            errors.push('Le numéro de téléphone semble incomplet');
        }

        if (!data.delivery_address) {
            errors.push('L\'adresse de livraison est requise');
        }

        if (!data.delivery_city) {
            errors.push('La ville de livraison est requise');
        }

        // Validation souple de l'email s'il est fourni
        if (data.customer_email && data.customer_email.length > 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.customer_email)) {
                errors.push('Format d\'email invalide');
            }
        }

        return {
            isValid: errors.length === 0,
            message: errors.join(', '),
            errors: errors
        };
    }

    async processOrder(data) {
        try {
            // 🔥 PRÉPARER LES DONNÉES SELON VOTRE API
            const orderData = {
                // Format attendu par votre API /api/orders/create
                order: {
                    customer: {
                        first_name: data.customer_name.split(' ')[0] || data.customer_name,
                        last_name: data.customer_name.split(' ').slice(1).join(' ') || '',
                        email: data.customer_email || `cod_${Date.now()}@temp.com`,
                        phone: data.customer_phone
                    },
                    shipping_address: {
                        address1: data.delivery_address,
                        city: data.delivery_city,
                        zip: data.delivery_postal_code,
                        country: 'Morocco'
                    },
                    line_items: [
                        {
                            variant_id: parseInt(data.variant_id) || parseInt(data.product_id),
                            quantity: parseInt(data.quantity) || 1,
                            price: parseFloat(data.product_price) || 0
                        }
                    ],
                    financial_status: 'pending',
                    note: `Commande COD - ${data.order_notes || ''}`,
                    tags: 'COD,cash-on-delivery'
                }
            };

            console.log('🚀 Envoi de la commande:', orderData);

            // Envoyer la commande
            const response = await this.submitToAPI(orderData);
            
            if (response.success) {
                this.handleSuccess(response);
            } else {
                throw new Error(response.message || 'Erreur lors de l\'envoi de la commande');
            }
            
        } catch (error) {
            console.error('❌ Erreur processOrder:', error);
            throw error;
        }
    }

    async submitToAPI(orderData) {
        const response = await fetch(COD_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Shopify-Shop-Domain': COD_CONFIG.shopDomain
            },
            body: JSON.stringify(orderData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || `Erreur ${response.status}`);
        }
        
        return data;
    }

    handleSuccess(data) {
        // Afficher un message de succès
        this.showMessage('✅ Commande envoyée avec succès! Nous vous contacterons bientôt.', 'success');
        
        // Optionnel: redirection
        if (data.order && data.order.order_status_url) {
            setTimeout(() => {
                window.location.href = data.order.order_status_url;
            }, 2000);
        } else {
            // Redirection vers une page de succès
            setTimeout(() => {
                window.location.href = '/pages/merci-commande';
            }, 3000);
        }
        
        console.log('✅ Commande COD traitée avec succès');
    }

    handleError(error) {
        let message = 'Une erreur est survenue. Veuillez réessayer.';
        
        if (error.message.includes('telephone') || error.message.includes('phone')) {
            message = 'Veuillez vérifier votre numéro de téléphone.';
        } else if (error.message.includes('nom') || error.message.includes('name')) {
            message = 'Veuillez indiquer votre nom complet.';
        } else if (error.message.includes('email')) {
            message = 'Veuillez vérifier votre adresse email.';
        } else if (error.message.includes('adresse') || error.message.includes('address')) {
            message = 'Veuillez indiquer votre adresse complète.';
        } else if (error.message) {
            message = error.message;
        }
        
        this.showMessage(`❌ ${message}`, 'error');
        
        // Retry logic
        if (this.retryCount < 3) {
            this.retryCount++;
            console.log(`🔄 Tentative ${this.retryCount}/3`);
        }
    }

    showMessage(message, type = 'info') {
        // Créer ou mettre à jour le message
        let messageEl = document.querySelector('.cod-message');
        
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = 'cod-message';
            messageEl.style.cssText = `
                padding: 15px 20px;
                margin: 15px 0;
                border-radius: 8px;
                font-weight: 500;
                position: relative;
                z-index: 1000;
                font-size: 16px;
                line-height: 1.4;
            `;
            
            if (this.form) {
                this.form.parentNode.insertBefore(messageEl, this.form);
            }
        }
        
        // Styling selon le type
        const styles = {
            success: 'background: #d4edda; color: #155724; border: 2px solid #c3e6cb;',
            error: 'background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb;',
            info: 'background: #d1ecf1; color: #0c5460; border: 2px solid #bee5eb;'
        };
        
        messageEl.style.cssText += styles[type] || styles.info;
        messageEl.textContent = message;
        
        // Scroll vers le message
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Auto-hide après 8 secondes pour les succès
        if (type === 'success') {
            setTimeout(() => {
                if (messageEl && messageEl.parentNode) {
                    messageEl.style.opacity = '0';
                    setTimeout(() => {
                        if (messageEl && messageEl.parentNode) {
                            messageEl.parentNode.removeChild(messageEl);
                        }
                    }, 300);
                }
            }, 8000);
        }
    }

    initQuantityControls() {
        const qtyInput = this.form.querySelector('input[name="quantity"], input[name="qty"]');
        const plusBtn = this.form.querySelector('.qty-plus, .quantity-plus');
        const minusBtn = this.form.querySelector('.qty-minus, .quantity-minus');

        if (qtyInput) {
            // Boutons +/-
            if (plusBtn) {
                plusBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentValue = parseInt(qtyInput.value) || 1;
                    const maxValue = parseInt(qtyInput.getAttribute('max')) || 99;
                    if (currentValue < maxValue) {
                        qtyInput.value = currentValue + 1;
                        this.updatePriceDisplay();
                    }
                });
            }

            if (minusBtn) {
                minusBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentValue = parseInt(qtyInput.value) || 1;
                    const minValue = parseInt(qtyInput.getAttribute('min')) || 1;
                    if (currentValue > minValue) {
                        qtyInput.value = currentValue - 1;
                        this.updatePriceDisplay();
                    }
                });
            }

            // Changement direct
            qtyInput.addEventListener('change', () => {
                this.updatePriceDisplay();
            });
        }
    }

    updatePriceDisplay() {
        // Mise à jour de l'affichage du prix (si applicable)
        const qtyInput = this.form.querySelector('input[name="quantity"]');
        const priceInput = this.form.querySelector('input[name="product_price"]');
        const priceDisplay = document.querySelector('.cod-price-display, .price-display');

        if (qtyInput && priceInput && priceDisplay) {
            const quantity = parseInt(qtyInput.value) || 1;
            const unitPrice = parseFloat(priceInput.value) || 0;
            const total = quantity * unitPrice;

            priceDisplay.textContent = `${total.toFixed(2)} DH`;
        }
    }
}

// Fonctions de debug globales
window.enableCODDebug = function() {
    COD_CONFIG.debug = true;
    localStorage.setItem('cod_debug', 'true');
    console.log('🐛 Debug COD activé');
};

window.testCODConnection = function() {
    console.log('🧪 Test de connexion COD...');
    fetch(COD_CONFIG.apiUrl.replace('/orders/create', '/test'))
        .then(response => response.json())
        .then(data => console.log('✅ Connexion OK:', data))
        .catch(error => console.error('❌ Erreur connexion:', error));
};

window.getCODFormInfo = function() {
    const form = document.querySelector('#cod-form, .cod-order-form');
    if (form) {
        const fields = form.querySelectorAll('input, select, textarea');
        console.log('📋 Informations du formulaire COD:');
        console.log('- Formulaire:', form);
        console.log('- Nombre de champs:', fields.length);
        fields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field.name || field.id || 'sans nom'} (${field.type}) = "${safeGetValue(field)}"`);
        });
    } else {
        console.log('❌ Aucun formulaire COD trouvé');
    }
};

// Initialisation automatique avec plusieurs points d'entrée
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.codForm = new CODForm();
        console.log('✅ COD Form Script v3.0 chargé avec succès');
        console.log('🔧 Fonctions debug disponibles: enableCODDebug(), testCODConnection(), getCODFormInfo()');
    }, 500);
});

// Si le DOM est déjà chargé
if (document.readyState === 'loading') {
    // DOM pas encore chargé, attendre l'événement
} else {
    // DOM déjà chargé, initialiser maintenant
    setTimeout(() => {
        if (!window.codForm) {
            window.codForm = new CODForm();
            console.log('✅ COD Form Script v3.0 chargé avec succès');
            console.log('🔧 Fonctions debug disponibles: enableCODDebug(), testCODConnection(), getCODFormInfo()');
        }
    }, 100);
}

// Initialisation pour l'éditeur Shopify
if (window.Shopify && window.Shopify.designMode) {
    setTimeout(() => {
        if (!window.codForm) {
            window.codForm = new CODForm();
        }
    }, 2000);
}