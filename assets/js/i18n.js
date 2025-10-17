/**
 * Internationalization Manager for Space Scape
 * Supports Portuguese (pt-br) and English (en-us)
 */
class I18nManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('spacescape_language') || 'en-us';
        this.translations = {};
        // Exponha uma promessa que resolve quando o gerenciador estiver pronto.
        this.ready = this.init();
    }

    async init() {
        // Carrega os arquivos de tradução em paralelo para maior eficiência.
        await Promise.all([
            this.loadTranslations('en-us'),
            this.loadTranslations('pt-br')
        ]);


        // Ouve por novos componentes sendo carregados para traduzi-los também.
        this.setupComponentsLoadedListener();

        // Aplica o idioma ao conteúdo estático que já está na página.
        this.applyCurrentLanguage();

        // Ouve por novos componentes sendo carregados para traduzi-los também.
        this.setupComponentsLoadedListener();
        
    }

    async loadTranslations(language) {
        try {
            const response = await fetch(`assets/i18n/${language}.json`);
            if (!response.ok) {
                throw new Error(`Falha ao carregar ${language}.json`);
            }
            this.translations[language] = await response.json();
        } catch (error) {
            console.error(`Erro ao carregar traduções para ${language}:`, error);
        }
    }

    setLanguage(language) {
        if (this.translations[language]) {
            this.currentLanguage = language;
            localStorage.setItem('spacescape_language', language);
            this.applyCurrentLanguage();
            return true;
        }
        return false;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    applyCurrentLanguage() {
        if (!this.translations[this.currentLanguage]) {
            console.warn(`Traduções para '${this.currentLanguage}' não estão disponíveis.`);
            return;
        }

        // Traduz todos os elementos com o atributo data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) { // Apenas atualiza se a tradução foi encontrada
                element.textContent = translation;
            }
        });

        // Traduz todos os elementos com o atributo data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation !== key) {
                element.placeholder = translation;
            }
        });

        document.documentElement.setAttribute('lang', this.currentLanguage);
        document.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: this.currentLanguage }
        }));
    }

    t(key) {
        // Acessa a tradução de forma segura
        return this.translations[this.currentLanguage]?.[key] || key;
    }

    setupComponentsLoadedListener() {
        // Quando novos componentes são adicionados ao DOM, aplica o idioma atual a eles.
        document.addEventListener('componentsLoaded', () => {
            this.applyCurrentLanguage();
        });
    }
}

// Cria e exporta uma instância única
const i18n = new I18nManager();
export { i18n };