// COD Form Script v4.0 - Version corrigée pour RT COD Boost
console.log('🎯 Initialisation COD Form v4.0...');

// Configuration COD
const COD_CONFIG = {
    apiUrl: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/cod-order'
        : 'https://cod-rt-boost.onrender.com/api/cod-order',
    debug: false
};

console.log('🎯 COD Config:', COD_CONFIG);

class CODForm {
    constructor() {
        this.form = null;
        this.isSubmitting = false;
        this.currentRetry = 0;
        this.maxRetries = 5;
        this.productId = null;
        
        this.init();
    }

    init() {
        // Chercher le formulaire COD
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
        
        // Récupérer l'ID du produit
        this.productId = this.getProductId();
        
        // Charger les champs dynamiques puis configurer le formulaire
        this.loadDynamicFields().then(() => {
            this.setupEventListeners();
            this.initQuantityControls();
            this.initVariantSelector();
            console.log('✅ COD Form initialisé avec succès - v4.0');
        });
    }

    findForm() {
        const selectors = [
            '#cod-form',
            '.cod-order-form',
            '[data-cod-form]',
            'form:has(input[name="customer_name"])',
            '.cod-form-container form'
        ];

        for (let selector of selectors) {
            try {
                const form = document.querySelector(selector);
                if (form) {
                    console.log(`✅ Formulaire trouvé avec: ${selector}`);
                    return form;
                }
            } catch (e) {
                continue;
            }
        }
        
        return null;
    }

    getProductId() {
        // Chercher l'ID produit dans le formulaire
        const productInput = this.form?.querySelector('input[name="product_id"]');
        if (productInput && productInput.value) {
            return productInput.value;
        }
        
        // Chercher dans l'URL ou variables globales
        if (window.COD_PRODUCT_DATA?.id) {
            return window.COD_PRODUCT_DATA.id;
        }
        
        // Fallback générique
        return 'generic';
    }

    async loadDynamicFields() {
        try {
            console.log('📋 Chargement des champs dynamiques...');
            
            const response = await fetch('/api/fields');
            if (!response.ok) {
                throw new Error('Erreur API fields');
            }
            
            const fields = await response.json();
            const activeFields = fields.filter(f => f.active);
            
            // Chercher le conteneur pour les champs dynamiques
            const container = document.getElementById(`cod-dynamic-fields-${this.productId}`) ||
                            this.form?.querySelector('.cod-dynamic-fields') ||
                            this.form?.querySelector('.cod-fields-container');
            
            if (!container) {
                console.warn('⚠️ Conteneur champs dynamiques introuvable, utilisation du formulaire directement');
                this.addFieldsToForm(activeFields);
                return;
            }
            
            // Générer le HTML des champs
            let html = '';
            activeFields.forEach(field => {
                html += this.generateFieldHTML(field);
            });
            
            container.innerHTML = html;
            console.log('✅ Champs dynamiques chargés:', activeFields.length);
            
        } catch (error) {
            console.error('❌ Erreur chargement champs dynamiques:', error);
            // Fallback avec champs de base
            this.addDefaultFields();
        }
    }

    generateFieldHTML(field) {
        const isRequired = ['customer_name', 'customer_phone', 'customer_address', 'customer_city'].includes(field.key);
        const requiredAttr = isRequired ? 'required' : '';
        const requiredLabel = isRequired ? ' *' : '';
        
        let inputType = 'text';
        let placeholder = field.label;
        
        // Types spécifiques selon le champ
        switch (field.key) {
            case 'customer_phone':
            case 'phone':
                inputType = 'tel';
                placeholder = 'Ex: 0661234567';
                break;
            case 'customer_email':
            case 'email':
                inputType = 'email';
                placeholder = 'Ex: nom@email.com';
                break;
        }
        
        return `
            <div class="cod-field-group" style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">
                    ${field.label}${requiredLabel}
                </label>
                <input 
                    type="${inputType}" 
                    name="${field.key}" 
                    placeholder="${placeholder}"
                    ${requiredAttr}
                    style="width: 100%; padding: 10px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box;"
                />
            </div>
        `;
    }

    addFieldsToForm(fields) {
        // Si pas de conteneur dédié, ajouter les champs au formulaire
        const lastInput = this.form.querySelector('input[name="product_image"]') || 
                          this.form.querySelector('input[type="hidden"]:last-of-type');
        
        if (lastInput) {
            fields.forEach(field => {
                const fieldHTML = this.generateFieldHTML(field);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = fieldHTML;
                lastInput.parentNode.insertBefore(tempDiv.firstElementChild, lastInput.nextSibling);
            });
        }
    }

    addDefaultFields() {
        // Champs de base en fallback
        const defaultFields = [
            { key: 'customer_name', label: 'Nom complet', active: true },
            { key: 'customer_phone', label: 'Téléphone', active: true },
            { key: 'customer_email', label: 'Email', active: false },
            { key: 'customer_address', label: 'Adresse', active: true },
            { key: 'customer_city', label: 'Ville', active: true }
        ];
        
        this.addFieldsToForm(defaultFields.filter(f => f.active));
    }

    setupEventListeners() {
        if (!this.form) return;
        
        // Intercepter la soumission du formulaire
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Intercepter les clics sur les boutons submit
        const submitButtons = this.form.querySelectorAll('button[type="submit"], input[type="submit"]');
        submitButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if (this.isSubmitting) {
                    e.preventDefault();
                }
            });
        });
    }

    initQuantityControls() {
        const qtyInput = this.form?.querySelector('input[name="quantity"]');
        const plusBtn = this.form?.querySelector('.cod-qty-plus, .qty-plus');
        const minusBtn = this.form?.querySelector('.cod-qty-minus, .qty-minus');

        if (qtyInput) {
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
                    if (currentValue > 1) {
                        qtyInput.value = currentValue - 1;
                        this.updatePriceDisplay();
                    }
                });
            }

            qtyInput.addEventListener('change', () => this.updatePriceDisplay());
        }
    }

    initVariantSelector() {
        const variantSelect = this.form?.querySelector('select[name="variant_id"]');
        if (variantSelect) {
            variantSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.selectedOptions[0];
                const price = selectedOption.dataset.price;
                
                // Mettre à jour le prix caché
                const priceInput = this.form.querySelector('input[name="product_price"]');
                if (priceInput && price) {
                    priceInput.value = price;
                    this.updatePriceDisplay();
                }
            });
        }
    }

    updatePriceDisplay() {
        const qtyInput = this.form?.querySelector('input[name="quantity"]');
        const priceInput = this.form?.querySelector('input[name="product_price"]');
        const priceDisplay = document.querySelector('#cod-display-price') || 
                           document.querySelector('.cod-price-display');

        if (qtyInput && priceInput && priceDisplay) {
            const quantity = parseInt(qtyInput.value) || 1;
            const unitPrice = parseFloat(priceInput.value) || 0;
            const total = quantity * unitPrice;
            
            // Format prix Shopify (centimes vers dirhams)
            const formattedPrice = unitPrice > 1000 ? (total / 100).toFixed(2) : total.toFixed(2);
            priceDisplay.textContent = `${formattedPrice} DH`;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        try {
            // Collecter les données
            const formData = this.collectFormData();
            
            // Valider
            const validation = this.validateFormData(formData);
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            // Afficher loading
            this.showLoading(true);

            // Envoyer la commande
            const response = await this.submitOrder(formData);
            
            if (response.success) {
                this.handleSuccess(response);
            } else {
                throw new Error(response.error || 'Erreur lors de la création de la commande');
            }
            
        } catch (error) {
            console.error('❌ Erreur soumission:', error);
            this.handleError(error);
        } finally {
            this.isSubmitting = false;
            this.showLoading(false);
        }
    }

    collectFormData() {
        const data = {};
        
        // Collecter tous les champs du formulaire
        const formData = new FormData(this.form);
        for (const [key, value] of formData.entries()) {
            data[key] = value.trim();
        }
        
        // Assurer la quantité par défaut
        if (!data.quantity) {
            data.quantity = '1';
        }
        
        console.log('📊 Données collectées:', data);
        return data;
    }

    validateFormData(data) {
        const errors = [];
        
        // Validation des champs requis
        if (!data.customer_name) {
            errors.push('Le nom complet est requis');
        }
        
        if (!data.customer_phone) {
            errors.push('Le numéro de téléphone est requis');
        } else if (data.customer_phone.length < 8) {
            errors.push('Le numéro de téléphone semble incomplet');
        }

        if (!data.customer_address) {
            errors.push('L\'adresse est requise');
        }

        if (!data.customer_city) {
            errors.push('La ville est requise');
        }

        // Email optionnel mais validé si fourni
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

    async submitOrder(data) {
        console.log('🚀 Envoi commande vers:', COD_CONFIG.apiUrl);
        
        const response = await fetch(COD_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `Erreur ${response.status}`);
        }
        
        return result;
    }

    showLoading(show) {
        const submitBtn = this.form?.querySelector('button[type="submit"]');
        const btnText = submitBtn?.querySelector('.cod-btn-text');
        const btnLoading = submitBtn?.querySelector('.cod-btn-loading');
        
        if (submitBtn) {
            submitBtn.disabled = show;
            
            if (btnText && btnLoading) {
                btnText.style.display = show ? 'none' : 'inline';
                btnLoading.style.display = show ? 'inline' : 'none';
            } else {
                submitBtn.textContent = show ? '⏳ Traitement...' : '🚚 Confirmer ma commande';
            }
        }
    }

    handleSuccess(response) {
        console.log('✅ Commande créée avec succès:', response);
        
        this.showMessage('✅ Commande créée avec succès ! Nous vous contacterons bientôt.', 'success');
        
        // Réinitialiser le formulaire
        this.form?.reset();
        
        // Redirection optionnelle
        setTimeout(() => {
            if (response.order_status_url) {
                window.location.href = response.order_status_url;
            }
        }, 3000);
    }

    handleError(error) {
        let message = 'Une erreur est survenue. Veuillez réessayer.';
        
        if (error.message.includes('téléphone') || error.message.includes('phone')) {
            message = 'Veuillez vérifier votre numéro de téléphone.';
        } else if (error.message.includes('nom') || error.message.includes('name')) {
            message = 'Veuillez indiquer votre nom complet.';
        } else if (error.message) {
            message = error.message;
        }
        
        this.showMessage(`❌ ${message}`, 'error');
    }

    showMessage(message, type = 'info') {
        // Chercher ou créer le conteneur de message
        let messageEl = this.form?.parentNode?.querySelector('.cod-message') ||
                       document.querySelector('.cod-message');
        
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = 'cod-message';
            messageEl.style.cssText = `
                padding: 15px 20px;
                margin: 15px 0;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                line-height: 1.4;
            `;
            
            if (this.form?.parentNode) {
                this.form.parentNode.insertBefore(messageEl, this.form);
            }
        }
        
        // Styles selon le type
        const styles = {
            success: 'background: #d4edda; color: #155724; border: 2px solid #c3e6cb;',
            error: 'background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb;',
            info: 'background: #d1ecf1; color: #0c5460; border: 2px solid #bee5eb;'
        };
        
        messageEl.style.cssText += styles[type] || styles.info;
        messageEl.textContent = message;
        
        // Scroll vers le message
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Auto-hide pour les succès
        if (type === 'success') {
            setTimeout(() => {
                if (messageEl?.parentNode) {
                    messageEl.style.opacity = '0';
                    setTimeout(() => messageEl.remove(), 300);
                }
            }, 5000);
        }
    }
}

// Fonctions utilitaires globales
window.enableCODDebug = function() {
    COD_CONFIG.debug = true;
    console.log('🐛 Debug COD activé');
};

window.testCODConnection = function() {
    console.log('🧪 Test de connexion COD...');
    fetch(COD_CONFIG.apiUrl.replace('/api/cod-order', '/health'))
        .then(response => response.json())
        .then(data => console.log('✅ Connexion OK:', data))
        .catch(error => console.error('❌ Erreur connexion:', error));
};

// Initialisation automatique
function initCODForm() {
    if (!window.codForm) {
        window.codForm = new CODForm();
        console.log('✅ COD Form Script v4.0 chargé avec succès');
    }
}

// Points d'entrée multiples
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initCODForm, 100);
    });
} else {
    setTimeout(initCODForm, 100);
}

// Pour l'éditeur Shopify
if (window.Shopify?.designMode) {
    setTimeout(initCODForm, 1000);
}