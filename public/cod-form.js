// COD Form Script v3.0 - Version de test
console.log('🎯 Initialising COD Form v3.0...');

// Configuration COD
const COD_CONFIG = {
    apiUrl: window.location.origin + '/api/orders/create',
    debug: true
};

console.log('🎯 COD Config loaded:', COD_CONFIG);

class CODForm {
    constructor() {
        this.form = null;
        this.isSubmitting = false;
        this.init();
    }

    init() {
        // Chercher le formulaire COD
        this.form = document.querySelector('#cod-form');
        
        if (!this.form) {
            console.warn('❌ COD Form non trouvé');
            return;
        }

        console.log('✅ COD Form trouvé');
        this.setupEventListeners();
        console.log('✅ COD Form initialisé avec succès');
    }

    setupEventListeners() {
        // Intercepter la soumission du formulaire
        this.form.addEventListener('submit', (e) => this.handleSubmit(e), true);
        
        // Intercepter les clics sur le bouton
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => this.handleButtonClick(e), true);
        }
    }

    handleButtonClick(e) {
        console.log('🔘 Button click intercepted');
        
        if (this.isSubmitting) {
            e.preventDefault();
            return false;
        }
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
            // Collecter les données du formulaire
            const formData = this.collectFormData();
            console.log('📊 Données collectées:', formData);
            
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
            this.setLoading(false);
        }
    }

    collectFormData() {
        const data = {};
        
        // Collecter tous les champs du formulaire
        const fields = ['customer_name', 'customer_phone', 'customer_email', 
                       'delivery_address', 'delivery_city', 'order_notes',
                       'product_id', 'variant_id', 'quantity', 'product_price'];
        
        fields.forEach(fieldName => {
            const element = this.form.querySelector(`[name="${fieldName}"]`);
            data[fieldName] = element ? element.value.trim() : '';
        });

        console.log('📊 Données brutes collectées:', data);
        return data;
    }

    validateFormData(data) {
        const errors = [];
        
        // Validation du nom
        if (!data.customer_name || data.customer_name.length < 2) {
            errors.push('Le nom complet est requis (minimum 2 caractères)');
        }
        
        // Validation du téléphone (format marocain flexible)
        if (!data.customer_phone) {
            errors.push('Le numéro de téléphone est requis');
        } else {
            // Accepter différents formats marocains
            const phoneRegex = /^(\+212|0212|0)[5-7]\d{8}$|^\d{10}$/;
            const cleanPhone = data.customer_phone.replace(/[\s\-\(\)]/g, '');
            
            if (!phoneRegex.test(cleanPhone) && cleanPhone.length < 9) {
                errors.push('Format de téléphone invalide (ex: 0612345678)');
            }
        }
        
        // Validation de l'adresse
        if (!data.delivery_address || data.delivery_address.length < 10) {
            errors.push('L\'adresse complète est requise (minimum 10 caractères)');
        }
        
        // Validation de la ville
        if (!data.delivery_city || data.delivery_city.length < 2) {
            errors.push('La ville est requise');
        }
        
        // Validation email (si fourni)
        if (data.customer_email && data.customer_email.length > 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.customer_email)) {
                errors.push('Format d\'email invalide');
            }
        }

        return {
            isValid: errors.length === 0,
            message: errors.join('\n'),
            errors: errors
        };
    }

    async processOrder(data) {
        this.setLoading(true);
        this.showMessage('Envoi de votre commande...', 'info');
        
        try {
            // Préparer les données pour l'API
            const orderData = {
                customer_name: data.customer_name,
                customer_phone: data.customer_phone,
                customer_email: data.customer_email || null,
                delivery_address: data.delivery_address,
                delivery_city: data.delivery_city,
                order_notes: data.order_notes || null,
                product_id: data.product_id || 'test-product',
                variant_id: data.variant_id || 'test-variant',
                quantity: parseInt(data.quantity) || 1,
                product_price: parseFloat(data.product_price) || 0
            };

            console.log('🚀 Envoi vers API:', orderData);

            // Envoyer à l'API
            const response = await fetch(COD_CONFIG.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            console.log('📥 Réponse API:', result);
            
            if (!response.ok) {
                throw new Error(result.message || `Erreur ${response.status}`);
            }
            
            if (result.success) {
                this.handleSuccess(result);
            } else {
                throw new Error(result.message || 'Erreur lors de la création de la commande');
            }
            
        } catch (error) {
            console.error('❌ Erreur processOrder:', error);
            throw error;
        }
    }

    handleSuccess(result) {
        console.log('✅ Commande créée avec succès:', result);
        
        // Afficher le message de succès
        this.showMessage(`✅ Commande créée avec succès!\n📦 Numéro: ${result.order.name}\nMerci pour votre commande !`, 'success');
        
        // Réinitialiser le formulaire
        setTimeout(() => {
            this.form.reset();
        }, 2000);
        
        // Optionnel: redirection
        if (result.order.order_status_url && result.order.order_status_url !== '/pages/merci-commande') {
            setTimeout(() => {
                window.location.href = result.order.order_status_url;
            }, 3000);
        }
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
    }

    showMessage(message, type = 'info') {
        // Supprimer l'ancien message
        const oldMessage = document.querySelector('.cod-message');
        if (oldMessage) {
            oldMessage.remove();
        }
        
        // Créer le nouveau message
        const messageEl = document.createElement('div');
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
            white-space: pre-line;
        `;
        
        // Styling selon le type
        const styles = {
            success: 'background: #d4edda; color: #155724; border: 2px solid #c3e6cb;',
            error: 'background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb;',
            info: 'background: #d1ecf1; color: #0c5460; border: 2px solid #bee5eb;'
        };
        
        messageEl.style.cssText += styles[type] || styles.info;
        messageEl.textContent = message;
        
        // Insérer le message avant le formulaire
        this.form.parentNode.insertBefore(messageEl, this.form);
        
        // Scroll vers le message
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Auto-hide après 8 secondes pour les succès
        if (type === 'success') {
            setTimeout(() => {
                if (messageEl && messageEl.parentNode) {
                    messageEl.style.opacity = '0';
                    setTimeout(() => {
                        if (messageEl && messageEl.parentNode) {
                            messageEl.remove();
                        }
                    }, 300);
                }
            }, 8000);
        }
    }

    setLoading(isLoading) {
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = isLoading;
            if (isLoading) {
                submitBtn.textContent = '⏳ Traitement...';
            } else {
                submitBtn.textContent = '📦 Passer la commande COD';
            }
        }
    }
}

// Fonctions de debug globales
window.enableCODDebug = function() {
    COD_CONFIG.debug = true;
    console.log('🐛 Debug COD activé');
};

window.getCODFormInfo = function() {
    const form = document.querySelector('#cod-form');
    if (form) {
        const fields = form.querySelectorAll('input, textarea');
        console.log('📋 Informations du formulaire COD:');
        console.log('- Formulaire:', form);
        console.log('- Nombre de champs:', fields.length);
        fields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field.name || 'sans nom'} (${field.type}) = "${field.value}"`);
        });
    } else {
        console.log('❌ Aucun formulaire COD trouvé');
    }
};

// Initialisation automatique
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.codForm = new CODForm();
        console.log('✅ COD Form Script v3.0 chargé avec succès');
        console.log('🔧 Fonctions debug disponibles: enableCODDebug(), getCODFormInfo()');
    }, 100);
});

// Si le DOM est déjà chargé
if (document.readyState !== 'loading') {
    setTimeout(() => {
        if (!window.codForm) {
            window.codForm = new CODForm();
            console.log('✅ COD Form Script v3.0 chargé avec succès');
        }
    }, 100);
}