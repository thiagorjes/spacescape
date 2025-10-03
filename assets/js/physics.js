// Definição da classe Vector para manipulação de vetores 2D
class Vector {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    subtract(v) { this.x -= v.x; this.y -= v.y; return this; }
    multiply(s) { this.x *= s; this.y *= s; return this; }
    divide(s) { if (s !== 0) { this.x /= s; this.y /= s; } return this; }
    get magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    get normalize() {
        const mag = this.magnitude;
        return mag > 0 ? new Vector(this.x / mag, this.y / mag) : new Vector(0, 0);
    }
    dot(v) { return this.x * v.x + this.y * v.y; }
    projection(onVector) {
        const onVectorMagSq = onVector.magnitude * onVector.magnitude;
        if (onVectorMagSq === 0) return new Vector(0, 0);
        const scalar = this.dot(onVector) / onVectorMagSq;
        return onVector.clone().multiply(scalar);
    }
    clone() { return new Vector(this.x, this.y); }
}

// Constantes de física
const G = 6.6743e-11 * 1e12;
const ROCKET_MASS = 1;
const ROCKET_THRUST = 1000;
const ROCKET_TORQUE = 0.05;
const PLANET_DENSITY = 10;
const MAX_ANGULAR_VELOCITY = 0.08;
const FRICTION = 0.3;
const MAX_PERCENTAGE = 0.3

class PhysicsEngine {
    constructor(canvas, initialGameState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameState = initialGameState;
        this.planets = [];
        this.rocket = {};
        this.startPlanet = null;
        this.endPlanet = null;
        this.isRunning = false;
        this.isExploding = false;
        this.lastTimestamp = 0;
        this.explosionStartTimestamp = 0; // Adicionado para controlar a animação
        this.keyMap = {};
        this.rocketRatio = 8;
        this.collitionThreshold = 100;
        this.minRadius=10;
        this.maxRadius=80;
        this.minDistance = 50;

    }

    init(minR, maxR, minDist, rocketSize, collisionThreshold) {
        this.collitionThreshold = collisionThreshold; 
        this.minRadius = minR;
        this.maxRadius = maxR;
        this.minDistance = minDist; 
        this.rocketRatio = rocketSize;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.reset();
    }

    resizeCanvas() {
        const gameArea = this.canvas.parentElement;
        if (gameArea) {
            this.canvas.width = gameArea.clientWidth;
            this.canvas.height = gameArea.clientHeight;
        }
        if (!this.isRunning) {
            this.draw();
        }
    }

    reset() {
        this.isRunning = false;
        this.isExploding = false;
        this.keyMap = {};

        this.rocket = {
            position: new Vector(this.canvas.width / 2, this.canvas.height / 2),
            velocity: new Vector(0, 0),
            acceleration: new Vector(0, 0),
            angle: 0,
            angularVelocity: 0
        };

        this.generatePlanets();

        if (this.startPlanet) {
            const totalRadius = this.startPlanet.radius + this.rocketRatio + 5;
            const randomAngle = Math.random() * 2 * Math.PI;
            this.rocket.position.x = this.startPlanet.position.x + Math.cos(randomAngle) * totalRadius;
            this.rocket.position.y = this.startPlanet.position.y + Math.sin(randomAngle) * totalRadius;
            this.rocket.velocity = new Vector(0, 0);
            this.rocket.angle = randomAngle + Math.PI / 2;
        }
        // Dispatch event when planets are generated
        this.dispatchEvent('planets-generated');
        this.draw();
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTimestamp = performance.now();
            requestAnimationFrame((ts) => this.gameLoop(ts));
        }
    }

    stop() { this.isRunning = false; }
    setInput(key, isPressed) { this.keyMap[key] = isPressed; }


    generatePlanets() {
        this.planets = [];
        const count = this.gameState.level + 1;
        this.maxRadius = Math.min(this.maxRadius, Math.sqrt((this.canvas.width * this.canvas.height * MAX_PERCENTAGE) / count / Math.PI));

        let tempPlanets = [];
        for (let i = 0; i < count; i++) {
            let radius = this.minRadius + Math.random() * (this.maxRadius - this.minRadius);
            let mass = PLANET_DENSITY * Math.pow(radius, 2);
            let x, y, isTooClose;
            do {
                isTooClose = false;
                x = Math.random() * (this.canvas.width - radius * 2) + radius;
                y = Math.random() * (this.canvas.height - radius * 2) + radius;
                for (const p of tempPlanets) {
                    if (Math.hypot(x - p.position.x, y - p.position.y) < radius + p.radius + this.minDistance) {
                        isTooClose = true;
                        break;
                    }
                }
            } while (isTooClose);
            tempPlanets.push({ position: new Vector(x, y), radius, mass, color: '#4a8fe7' });
        }

        let maxDist = 0;
        let startIdx = 0, endIdx = 1;
        if (tempPlanets.length > 1) {
            for (let i = 0; i < tempPlanets.length; i++) {
                for (let j = i + 1; j < tempPlanets.length; j++) {
                    const dist = tempPlanets[i].position.clone().subtract(tempPlanets[j].position).magnitude;
                    if (dist > maxDist) {
                        maxDist = dist;
                        startIdx = i;
                        endIdx = j;
                    }
                }
            }
        }

        if (tempPlanets[startIdx]) tempPlanets[startIdx].color = '#fff73b';
        if (tempPlanets[endIdx]) tempPlanets[endIdx].color = '#e74a4a';

        this.planets = tempPlanets;
        this.startPlanet = this.planets[startIdx];
        this.endPlanet = this.planets[endIdx];
    }

    gameLoop(timestamp) {
        if (!this.isRunning && !this.isExploding) return;
        const deltaTime = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
        this.lastTimestamp = timestamp;
        if (this.isRunning) this.update(deltaTime);
        this.draw();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    // physics.js

    update(deltaTime) {
        if (this.isExploding) return;

        let resultantForce = new Vector(0, 0);
        this.planets.forEach(p => {
            const d = p.position.clone().subtract(this.rocket.position);
            const distSq = d.x * d.x + d.y * d.y;
            if (distSq > 10) {
                const forceMag = G * (ROCKET_MASS * p.mass) / distSq;
                resultantForce.add(d.normalize.multiply(forceMag));
            }
        });

        const thrustDirection = new Vector(Math.cos(this.rocket.angle - Math.PI / 2), Math.sin(this.rocket.angle - Math.PI / 2));
        if (this.gameState.fuel > 0) {

            // MUDANÇA 1: Verifica se não está superaquecido para ligar o motor
            if (!this.gameState.isOverheated) {
                if (this.keyMap['up']) {
                    resultantForce.add(thrustDirection.clone().multiply(ROCKET_THRUST));
                    // MUDANÇA 2: Envia um evento específico para THRUST
                    this.dispatchEvent('control-active', { controlType: 'thrust' });
                }
                if (this.keyMap['down']) {
                    resultantForce.add(thrustDirection.clone().multiply(-ROCKET_THRUST));
                    this.dispatchEvent('control-active', { controlType: 'thrust' });
                }
            }

            if (this.keyMap['left']) {
                this.rocket.angularVelocity = Math.max(-MAX_ANGULAR_VELOCITY, -ROCKET_TORQUE);
                // MUDANÇA 3: Envia um evento específico para TURN
                this.dispatchEvent('control-active', { controlType: 'turn' });
            }
            else if (this.keyMap['right']) {
                this.rocket.angularVelocity = Math.min(MAX_ANGULAR_VELOCITY, ROCKET_TORQUE);
                this.dispatchEvent('control-active', { controlType: 'turn' });
            }
            else { this.rocket.angularVelocity = 0; }

        } else {
            this.rocket.angularVelocity = 0;
            if (!this.gameState.isFuelEmpty) this.dispatchEvent('fuel-empty');
        }

        this.rocket.acceleration = resultantForce.divide(ROCKET_MASS);
        this.rocket.velocity.add(this.rocket.acceleration.clone().multiply(deltaTime));
        this.rocket.position.add(this.rocket.velocity.clone().multiply(deltaTime));
        this.rocket.angle += this.rocket.angularVelocity;

        this.checkCollisions();
        this.checkBoundaries();
    }

    checkCollisions() {
        for (const planet of this.planets) {
            const distVec = this.rocket.position.clone().subtract(planet.position);
            const dist = distVec.magnitude;
            if (dist < this.rocketRatio + planet.radius) {

                const impactForce = this.rocket.velocity.magnitude * ROCKET_MASS;
                if (impactForce > this.collitionThreshold) {
                    this.isExploding = true;
                    this.stop();
                    this.explosionStartTimestamp = performance.now(); // Inicia o tempo da explosão
                    setTimeout(() => { this.dispatchEvent('death-reset'); }, 2000);
                    return;
                }

                if (planet === this.endPlanet) {
                    this.stop();
                    this.dispatchEvent('level-win');
                    return;
                }

                const normal = distVec.normalize;
                const parallelVel = this.rocket.velocity.projection(normal);
                const orthoVel = this.rocket.velocity.clone().subtract(parallelVel);
                this.rocket.velocity = orthoVel.subtract(parallelVel).multiply(1 - FRICTION);
                const overlap = this.rocketRatio + planet.radius - dist;
                this.rocket.position.add(normal.multiply(overlap));
                return;
            }
        }
    }

    checkBoundaries() {
        if (this.rocket.position.x < 0) this.rocket.position.x = this.canvas.width;
        if (this.rocket.position.x > this.canvas.width) this.rocket.position.x = 0;
        if (this.rocket.position.y < 0) this.rocket.position.y = this.canvas.height;
        if (this.rocket.position.y > this.canvas.height) this.rocket.position.y = 0;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.planets.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.position.x, p.position.y, p.radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = p.radius / 2;
            this.ctx.fill();
            this.ctx.closePath();
            this.ctx.shadowBlur = 0;
        });

        if (this.isExploding) {
            const explosionDuration = 2000; // Duração da explosão em milissegundos
            const elapsed = performance.now() - this.explosionStartTimestamp;
            const progress = elapsed / explosionDuration;
            const radius = this.rocketRatio + progress * 50;
            const opacity = 1 - progress;

            this.ctx.globalAlpha = opacity > 0 ? opacity : 0;

            this.ctx.fillStyle = '#ffcc00';
            this.ctx.beginPath();
            this.ctx.arc(this.rocket.position.x, this.rocket.position.y, radius, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = '#ff6600';
            this.ctx.beginPath();
            this.ctx.arc(this.rocket.position.x + Math.random() * 20 - 10, this.rocket.position.y + Math.random() * 20 - 10, radius * 0.8, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(this.rocket.position.x + Math.random() * 10 - 5, this.rocket.position.y + Math.random() * 10 - 5, radius * 0.5, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.globalAlpha = 1.0;

            return; // Sai da função para não desenhar o foguete
        }

        // CORREÇÃO: Adicionada verificação para garantir que o foguete e sua posição existam
        if (!this.rocket || !this.rocket.position) {
            return;
        }

        this.ctx.save();
        this.ctx.translate(this.rocket.position.x, this.rocket.position.y);
        this.ctx.rotate(this.rocket.angle);
        const scale = this.rocketRatio / 8;
        if (this.gameState.fuel > 0 && !this.gameState.isOverheated &&(this.keyMap['up'] || this.keyMap['down'])) {
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.beginPath();
            this.ctx.moveTo(0, 9 * scale);
            this.ctx.lineTo(-3 * scale, (15 + Math.random() * 3) * scale);
            this.ctx.lineTo(3 * scale, (15 + Math.random() * 3) * scale);
            this.ctx.fill();
        }
        this.ctx.fillStyle = '#b0b0b0';
        this.ctx.strokeStyle = '#555555';
        this.ctx.lineWidth = 1.2 * scale;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -9 * scale);
        this.ctx.lineTo(-6 * scale, 9 * scale);
        this.ctx.lineTo(6 * scale, 9 * scale);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = '#808080';
        this.ctx.beginPath();
        this.ctx.moveTo(-5 * scale, 9 * scale); this.ctx.lineTo(-9 * scale, 9 * scale); this.ctx.lineTo(-5 * scale, 5 * scale);
        this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(5 * scale, 9 * scale); this.ctx.lineTo(9 * scale, 9 * scale); this.ctx.lineTo(5 * scale, 5 * scale);
        this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
        this.ctx.restore();
    }

    dispatchEvent(type, detail = {}) {
        let temp =new CustomEvent('gameEvent', { detail: { type, ...detail } });
        document.dispatchEvent(temp);
    }
}

export { PhysicsEngine };
