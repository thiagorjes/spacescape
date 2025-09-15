/**
 * touch-connect.js
 * Uma biblioteca para gerenciar eventos de toque e calcular distâncias
 * de pontos de referência.
 *
 * Autor: Especialista em Mobile e Web
 * Versão: 1.0.0
 */
(function() {

  class TouchConnect {
    /**
     * @param {object} config - Objeto de configuração para a lib.
     * @param {string} config.mode - 'one-point' ou 'two-points'.
     * @param {number} config.screenWidth - Largura da tela em pixels.
     * @param {number} config.screenHeight - Altura da tela em pixels.
     * @param {Array<object>} config.referencePoints - Array de pontos de referência {x, y}.
     * @param {HTMLElement} [config.targetElement=document.body] - Elemento para anexar os eventos de toque.
     * @param {string} [config.returnType='float'] - 'float' para vetor de ponto flutuante, 'boolean' para vetor booleano.
     * @param {number} [config.proximityThreshold=50] - Limite em pixels para o retorno booleano.
     */
    constructor(config) {
      if (!config || !config.mode || !config.referencePoints) {
        throw new Error('Configurações mínimas (mode e referencePoints) são obrigatórias.');
      }

      this.mode = config.mode;
      this.screenWidth = config.screenWidth;
      this.screenHeight = config.screenHeight;
      this.referencePoints = config.referencePoints;
      this.targetElement = config.targetElement || document.body;
      this.returnType = config.returnType || 'float';
      this.proximityThreshold = config.proximityThreshold || 50;

      // Armazena os callbacks para os eventos
      this.callbacks = {
        onMove: []
      };

      this.initEvents();
    }

    /**
     * Anexa os listeners de eventos de toque ao elemento alvo.
     */
    initEvents() {
      this.targetElement.addEventListener('touchmove', this.handleTouchMove.bind(this));
    }

    /**
     * Manipula o evento touchmove, calcula as distâncias e executa os callbacks.
     * @param {TouchEvent} event - O objeto de evento de toque.
     */
    handleTouchMove(event) {
      const touches = event.touches;
      let results = [];

      if (this.mode === 'one-point' && touches.length >= 1) {
        const touch = touches[0];
        const referencePoint = this.referencePoints[0];
        const distance = this.calculateDistance(touch, referencePoint);
        results.push(distance);

      } else if (this.mode === 'two-points' && touches.length >= 2) {
        if (this.referencePoints.length < 2) {
          console.error('Modo de dois pontos requer pelo menos dois pontos de referência.');
          return;
        }
        const touch1 = touches[0];
        const touch2 = touches[1];
        const referencePoint1 = this.referencePoints[0];
        const referencePoint2 = this.referencePoints[1];

        const distance1 = this.calculateDistance(touch1, referencePoint1);
        const distance2 = this.calculateDistance(touch2, referencePoint2);

        results.push(distance1, distance2);
      }
      
      // Executa todos os callbacks registrados
      this.callbacks.onMove.forEach(callback => callback(results, event));
    }

    /**
     * Calcula a distância entre um toque e um ponto de referência.
     * @param {Touch} touch - O objeto de toque.
     * @param {object} referencePoint - O ponto de referência {x, y}.
     * @returns {Array<number|boolean>} - Vetor [x, y] de ponto flutuante ou booleano.
     */
    calculateDistance(touch, referencePoint) {
      const dx = touch.clientX - referencePoint.x;
      const dy = touch.clientY - referencePoint.y;

      if (this.returnType === 'float') {
        return [dx, dy];
      } else if (this.returnType === 'boolean') {
        return [Math.abs(dx) < this.proximityThreshold, Math.abs(dy) < this.proximityThreshold];
      }
    }

    /**
     * Registra um callback para ser executado no evento touchmove.
     * @param {function} callback - A função a ser executada com os resultados do cálculo.
     */
    onMove(callback) {
      if (typeof callback === 'function') {
        this.callbacks.onMove.push(callback);
      }
    }

    /**
     * Atualiza os pontos de referência dinamicamente.
     * @param {Array<object>} newPoints - O novo array de pontos de referência.
     */
    setReferencePoints(newPoints) {
      this.referencePoints = newPoints;
    }
  }

  // Expõe a classe TouchConnect no escopo global
  if (typeof window !== 'undefined') {
    window.TouchConnect = TouchConnect;
  }

})();