// Definição da classe Vector para manipulação de vetores 2D
class Vector {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    }

    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    divide(scalar) {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    get magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    get normalize() {
        const magnitude = this.magnitude;
        if (magnitude > 0) {
            return new Vector(this.x / magnitude, this.y / magnitude);
        }
        return new Vector(0, 0);
    }

    // Novo método para produto escalar
    dot(vector) {
        return this.x * vector.x + this.y * vector.y;
    }

    // Novo método para projeção vetorial
    projection(onVector) {
        const onVectorMagnitudeSq = onVector.magnitude * onVector.magnitude;
        if (onVectorMagnitudeSq === 0) return new Vector(0, 0);
        const scalar = this.dot(onVector) / onVectorMagnitudeSq;
        return onVector.clone().multiply(scalar);
    }

    clone() {
        return new Vector(this.x, this.y);
    }
}

// Constantes do jogo
const G = 6.6743e-11 * 1e12; // Constante Gravitacional (escalada para o simulador)
const ROCKET_MASS = 1; // Massa do foguete (kg)
const ROCKET_THRUST = 500; // Força de avanço/recuo (Newtons)
const ROCKET_TORQUE = 0.05; // Velocidade de rotação
const PLANET_DENSITY = 10; // Densidade para calcular a massa do planeta
const ROCKET_RADIUS = 10; // Raio do foguete para detecção de colisão
const MAX_FUEL = 10; // Combustível máximo em litros
const FUEL_CONSUMPTION_THRUST = 0.5; // Consumo por segundo para avanço/recuo
const FUEL_CONSUMPTION_TURN = 0.1; // Consumo por segundo para rotação
const FRICTION = 0.3;
const COLLISION_THRESHOLD = 200; // LIMIAR DE FORÇA DE IMPACTO PARA EXPLOSÃO

// Estado do jogo e elementos do canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const planetCountRange = document.getElementById('planetCount');
const messageOverlay = document.getElementById('message-overlay');
const winOverlay = document.getElementById('win-overlay');

let isRunning = false;
let lastTimestamp = 0;
let rocket = {};
let planets = [];
let startPlanet = null;
let endPlanet = null;
let keyMap = {};
let difficultyLevel = 2; // Nível de dificuldade inicial
let isExploding = false; // Estado da explosão

// Mapeamento de teclas configurável
let keyBindings = {
    'forward': 'ArrowUp',
    'backward': 'ArrowDown',
    'left': 'ArrowLeft',
    'right': 'ArrowRight'
};

// Função de inicialização
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.8;
    resetGame();
    
    // Event listeners para teclas
    document.addEventListener('keydown', (e) => {
        if (Object.values(keyBindings).includes(e.key)) {
            keyMap[e.key] = true;
        }
    });
    document.addEventListener('keyup', (e) => {
        if (Object.values(keyBindings).includes(e.key)) {
            keyMap[e.key] = false;
        }
    });
    
    // Event listener para configuração de teclas
    document.querySelectorAll('.key-input input').forEach(input => {
        input.addEventListener('click', () => {
            input.value = 'Aguardando...';
            input.readOnly = false;
        });
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            if (e.key !== ' ' && e.key !== 'Enter') {
                input.value = e.key;
                input.readOnly = true;
                const keyName = input.id.replace('key-', '');
                keyBindings[keyName] = e.key;
            }
        });
    });
    
    // Event listener para redimensionamento da janela
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight * 0.8;
        if (!isRunning) {
            draw();
        }
    });

    startGame();
}

// Função para gerar planetas aleatórios
function generatePlanets(count) {
    const minRadius = 20;
    const maxRadius = 80;
    const minDistance = 150; 
    
    planets = [];
    
    // Gerar o planeta inicial
    let startRadius = minRadius + Math.random() * (maxRadius - minRadius);
    let startX = Math.random() * (canvas.width - startRadius * 2) + startRadius;
    let startY = Math.random() * (canvas.height - startRadius * 2) + startRadius;
    planets.push({
        position: new Vector(startX, startY),
        radius: startRadius,
        mass: PLANET_DENSITY * Math.pow(startRadius, 2),
        color: '#fff73b'
    });

    // Gerar o planeta final o mais longe possível
    let endPlanetCandidate = { position: new Vector(0, 0), dist: 0 };
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
        let x = Math.random() * (canvas.width - maxRadius * 2) + maxRadius;
        let y = Math.random() * (canvas.height - maxRadius * 2) + maxRadius;
        let dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));

        let isTooClose = false;
        for (const existingPlanet of planets) {
            const existingDist = Math.sqrt(Math.pow(x - existingPlanet.position.x, 2) + Math.pow(y - existingPlanet.position.y, 2));
            if (existingDist < maxRadius + existingPlanet.radius + minDistance) {
                isTooClose = true;
                break;
            }
        }
        if (!isTooClose && dist > endPlanetCandidate.dist) {
            endPlanetCandidate = { position: new Vector(x, y), dist: dist };
        }
    }
    let endRadius = minRadius + Math.random() * (maxRadius - minRadius);
    planets.push({
        position: endPlanetCandidate.position,
        radius: endRadius,
        mass: PLANET_DENSITY * Math.pow(endRadius, 2),
        color: '#e74a4a'
    });

    // Gerar planetas intermediários
    for (let i = 2; i < count; i++) {
        let radius = minRadius + Math.random() * (maxRadius - minRadius);
        let mass = PLANET_DENSITY * Math.pow(radius, 2);
        let x, y;
        let isTooClose = true;

        while(isTooClose) {
            isTooClose = false;
            x = Math.random() * (canvas.width - radius * 2) + radius;
            y = Math.random() * (canvas.height - radius * 2) + radius;

            for (const existingPlanet of planets) {
                const dist = Math.sqrt(Math.pow(x - existingPlanet.position.x, 2) + Math.pow(y - existingPlanet.position.y, 2));
                if (dist < radius + existingPlanet.radius + minDistance) {
                    isTooClose = true;
                    break;
                }
            }
        }
        planets.push({
            position: new Vector(x, y),
            radius: radius,
            mass: mass,
            color: '#4a8fe7'
        });
    }

    startPlanet = planets[0];
    endPlanet = planets[1];
}

// Função para reiniciar o jogo
function resetGame() {
    winOverlay.style.display = 'none';
    isRunning = false;
    isExploding = false;

    // Reinicia o foguete
    rocket = {
        position: new Vector(canvas.width / 2, canvas.height / 2),
        velocity: new Vector(0, 0),
        acceleration: new Vector(0, 0),
        angle: 0,
        angularVelocity: 0,
        fuel: MAX_FUEL
    };
    
    // Gera planetas novamente com o nível de dificuldade atual
    generatePlanets(difficultyLevel);
    
    // Reposiciona o foguete em uma posição aleatória no planeta inicial
    if (startPlanet) {
        const totalRadius = startPlanet.radius + ROCKET_RADIUS + 5;
        const randomAngle = Math.random() * 2 * Math.PI;

        rocket.position.x = startPlanet.position.x + Math.cos(randomAngle) * totalRadius;
        rocket.position.y = startPlanet.position.y + Math.sin(randomAngle) * totalRadius;
        
        // Zera a velocidade ao iniciar
        rocket.velocity = new Vector(0, 0);

        // Define o ângulo do foguete para apontar para fora do planeta
        rocket.angle = randomAngle + Math.PI / 2;
    }

    draw();
    startGame();
}

// Função para aumentar a dificuldade e reiniciar
function increaseDifficultyAndReset() {
    difficultyLevel = Math.min(parseInt(planetCount.max), difficultyLevel + 1);
    planetCount.value = difficultyLevel;
    resetGame();
    startGame();
}

// Atualiza a contagem de planetas e reinicia o jogo
function updatePlanetCount(value) {
    difficultyLevel = parseInt(value);
    resetGame();
}

// Função para iniciar o ciclo do jogo
function startGame() {
    if (!isRunning) {
        isRunning = true;
        lastTimestamp = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

// Função para exibir uma mensagem temporária
function displayMessage(text) {
    messageOverlay.textContent = text;
    messageOverlay.classList.add('show');
    setTimeout(() => {
        messageOverlay.classList.remove('show');
    }, 3000);
}

// Função para verificar e resolver colisões e a vitória
function checkCollisions() {
    // Verifica colisões com outros planetas
    for (const planet of planets) {
        //if (planet === endPlanet) continue; // Ignora o planeta final na colisão
        const distanceVector = rocket.position.clone().subtract(planet.position);
        const distance = distanceVector.magnitude;
        
        if (distance < ROCKET_RADIUS + planet.radius) {
            // Calcula a força de impacto com base na velocidade vetorial
            const impactForce = rocket.velocity.magnitude * ROCKET_MASS;
            
            if (impactForce > COLLISION_THRESHOLD) {
                isExploding = true;
                isRunning = false;
                displayMessage("Impacto catastrófico! Foguete destruído.");
                setTimeout(() => {
                    resetGame(); // Reinicia o jogo após a explosão
                }, 2000);
                return; // Encerra a função para não processar mais colisões
            }
            
            // Colisão normal
            const collisionNormal = distanceVector.normalize;
            const parallelVelocity = rocket.velocity.projection(collisionNormal);
            const orthogonalVelocity = rocket.velocity.clone().subtract(parallelVelocity);
            rocket.velocity = orthogonalVelocity.subtract(parallelVelocity).multiply(1 - FRICTION);
            
            // Ajusta a posição para evitar que o foguete fique "preso"
            const overlap = ROCKET_RADIUS + planet.radius - distance;
            rocket.position.add(collisionNormal.multiply(overlap));
            
            return;
        }
    }

    // Verifica a vitória
    const distanceToEndPlanet = rocket.position.clone().subtract(endPlanet.position).magnitude;
    if (distanceToEndPlanet < ROCKET_RADIUS + endPlanet.radius + 0.1) {
        isRunning = false;
        winOverlay.style.display = 'flex';
        return;
    }
}

// O loop principal do jogo
function gameLoop(timestamp) {
    if (!isRunning && !isExploding) return;
    
    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Função de atualização (a "máquina de estados" de física)
function update(deltaTime) {
    if (isExploding) {
        // Nada a atualizar, apenas a animação de explosão será renderizada
        return;
    }

    // Força resultante inicial no foguete
    let resultantForce = new Vector(0, 0);

    // Calcula a força gravitacional de cada planeta no foguete
    for (const planet of planets) {
        const dx = planet.position.x - rocket.position.x;
        const dy = planet.position.y - rocket.position.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > 10) {
            const forceMagnitude = G * (ROCKET_MASS * planet.mass) / distanceSq;
            const forceDirection = new Vector(dx, dy).normalize;
            resultantForce.add(forceDirection.multiply(forceMagnitude));
        }
    }

    let thrustDirection = new Vector(Math.cos(rocket.angle - Math.PI / 2), Math.sin(rocket.angle - Math.PI / 2));
    if (rocket.fuel > 0) {
        if (keyMap[keyBindings['forward']]) {
            resultantForce.add(thrustDirection.clone().multiply(ROCKET_THRUST));
            rocket.fuel -= FUEL_CONSUMPTION_THRUST * deltaTime;
        }
        if (keyMap[keyBindings['backward']]) {
            resultantForce.add(thrustDirection.clone().multiply(-ROCKET_THRUST));
            rocket.fuel -= FUEL_CONSUMPTION_THRUST * deltaTime;
        }
        if (keyMap[keyBindings['left']]) {
            rocket.angularVelocity = -ROCKET_TORQUE;
            rocket.fuel -= FUEL_CONSUMPTION_TURN * deltaTime;
        } else if (keyMap[keyBindings['right']]) {
            rocket.angularVelocity = ROCKET_TORQUE;
            rocket.fuel -= FUEL_CONSUMPTION_TURN * deltaTime;
        } else {
            rocket.angularVelocity = 0;
        }
    } else {
        rocket.angularVelocity = 0;
        displayMessage("Combustível esgotado!");
    }

    if (rocket.fuel < 0) {
        rocket.fuel = 0;
    }

    rocket.acceleration = resultantForce.divide(ROCKET_MASS);
    rocket.velocity.add(rocket.acceleration.multiply(deltaTime));
    rocket.position.add(rocket.velocity.clone().multiply(deltaTime));
    rocket.angle += rocket.angularVelocity;
    
    checkCollisions();

    if (rocket.position.x < 0) { rocket.position.x = canvas.width; }
    if (rocket.position.x > canvas.width) { rocket.position.x = 0; }
    if (rocket.position.y < 0) { rocket.position.y = canvas.height; }
    if (rocket.position.y > canvas.height) { rocket.position.y = 0; }
    
    const speed = rocket.velocity.magnitude;
    const distance = rocket.position.clone().subtract(endPlanet.position).magnitude;
    document.getElementById('speedValue').textContent = speed.toFixed(2);
    document.getElementById('distanceValue').textContent = distance.toFixed(2);
    document.getElementById('fuelValue').textContent = rocket.fuel.toFixed(2);
}

// Função de desenho (renderização)
function draw() {
    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha os planetas
    for (const planet of planets) {
        ctx.beginPath();
        ctx.arc(planet.position.x, planet.position.y, planet.radius, 0, 2 * Math.PI);
        ctx.fillStyle = planet.color;
        ctx.shadowColor = planet.color;
        ctx.shadowBlur = planet.radius / 2;
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0;
    }

    // Se o foguete estiver explodindo, desenha a explosão
    if (isExploding) {
        const explosionDuration = 2000; // Duração da explosão em milissegundos
        const elapsed = performance.now() - lastTimestamp;
        const progress = elapsed / explosionDuration;
        const radius = ROCKET_RADIUS + progress * 50;
        const opacity = 1 - progress;

        ctx.globalAlpha = opacity;
        
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(rocket.position.x, rocket.position.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(rocket.position.x + Math.random() * 20 - 10, rocket.position.y + Math.random() * 20 - 10, radius * 0.8, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(rocket.position.x + Math.random() * 10 - 5, rocket.position.y + Math.random() * 10 - 5, radius * 0.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        
        return; // Sai da função para não desenhar o foguete
    }

    // Desenha o foguete
    ctx.save();
    ctx.translate(rocket.position.x, rocket.position.y);
    ctx.rotate(rocket.angle);
    
    // Desenha o motor e o fogo apenas se houver combustível
    if (rocket.fuel > 0) {
      ctx.fillStyle = '#ffcc00'; // Cor do fogo do motor
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.lineTo(-5, 25);
      ctx.lineTo(5, 25);
      ctx.fill();
    }
    
    ctx.fillStyle = '#b0b0b0';
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(-10, 15);
    ctx.lineTo(10, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Asas do foguete
    ctx.fillStyle = '#808080';
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(-15, 10);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(15, 10);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// Inicia a aplicação quando a janela carrega
window.onload = init;