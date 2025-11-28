class NeuralMPC {
    constructor() {
        this.isInitialized = false;
        this.model = null;
        this.trainingData = [];
        this.performanceHistory = [];
        
        // Neural network parameters
        this.networkConfig = {
            inputSize: 6,  // [production, temperature, voltage, current, purity, reference]
            hiddenLayers: [64, 32],
            outputSize: 1, // Optimal control
            learningRate: 0.001,
            epochs: 100
        };
        
        this.init();
    }

    async init() {
        await this.loadModel();
        this.setupDataCollection();
        this.startPerformanceMonitoring();
    }

    async loadModel() {
        try {
            // Try to load pre-trained model from localStorage or server
            const savedModel = localStorage.getItem('neural_mpc_model');
            if (savedModel) {
                this.model = this.parseModel(JSON.parse(savedModel));
                console.log('✅ Loaded neural MPC model from cache');
            } else {
                // Initialize new model
                this.model = this.initializeModel();
                console.log('✅ Initialized new neural MPC model');
            }
            
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ Failed to load neural MPC model:', error);
            this.model = this.initializeModel();
            this.isInitialized = true;
        }
    }

    initializeModel() {
        // Simple neural network implementation
        return {
            weights: this.initializeWeights(),
            biases: this.initializeBiases(),
            activation: 'relu',
            trained: false
        };
    }

    initializeWeights() {
        const weights = {};
        const { inputSize, hiddenLayers, outputSize } = this.networkConfig;
        
        // Input to first hidden layer
        weights['input-hidden0'] = this.randomMatrix(hiddenLayers[0], inputSize);
        
        // Hidden layers
        for (let i = 0; i < hiddenLayers.length - 1; i++) {
            weights[`hidden${i}-hidden${i+1}`] = this.randomMatrix(hiddenLayers[i+1], hiddenLayers[i]);
        }
        
        // Last hidden to output
        weights[`hidden${hiddenLayers.length-1}-output`] = this.randomMatrix(outputSize, hiddenLayers[hiddenLayers.length-1]);
        
        return weights;
    }

    initializeBiases() {
        const biases = {};
        const { hiddenLayers, outputSize } = this.networkConfig;
        
        hiddenLayers.forEach((size, i) => {
            biases[`hidden${i}`] = new Array(size).fill(0.1);
        });
        
        biases['output'] = new Array(outputSize).fill(0.1);
        
        return biases;
    }

    randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix.push(new Array(cols).fill(0).map(() => (Math.random() - 0.5) * 2 / Math.sqrt(cols)));
        }
        return matrix;
    }

    async predict(input) {
        if (!this.isInitialized) {
            throw new Error('Neural MPC not initialized');
        }

        try {
            // Normalize input
            const normalizedInput = this.normalizeInput(input);
            
            // Forward pass through network
            let activation = normalizedInput;
            
            // Hidden layers
            for (let i = 0; i < this.networkConfig.hiddenLayers.length; i++) {
                const layerKey = i === 0 ? 'input-hidden0' : `hidden${i-1}-hidden${i}`;
                const biasKey = `hidden${i}`;
                
                activation = this.matrixVectorMultiply(this.model.weights[layerKey], activation);
                activation = this.vectorAdd(activation, this.model.biases[biasKey]);
                activation = this.applyActivation(activation, this.model.activation);
            }
            
            // Output layer
            const outputLayerKey = `hidden${this.networkConfig.hiddenLayers.length-1}-output`;
            let output = this.matrixVectorMultiply(this.model.weights[outputLayerKey], activation);
            output = this.vectorAdd(output, this.model.biases.output);
            
            // Denormalize output
            const control = this.denormalizeOutput(output[0]);
            
            return {
                control,
                confidence: this.calculateConfidence(output),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Neural MPC prediction error:', error);
            throw error;
        }
    }

    normalizeInput(input) {
        // Normalize input features to [0, 1] range
        const normalized = [
            input.production / 0.05,        // Max production ~0.05 L/s
            (input.temperature - 60) / 20,  // 60-80°C range
            (input.voltage - 35) / 10,      // 35-45V range
            (input.current - 100) / 100,    // 100-200A range
            (input.purity - 99) / 1,        // 99-100% range
            input.reference / 100           // 0-100% range
        ];
        
        return normalized.map(x => Math.max(0, Math.min(1, x)));
    }

    denormalizeOutput(output) {
        // Denormalize control output to current range (100-200A)
        return 100 + output * 100;
    }

    calculateConfidence(output) {
        // Simple confidence measure based on output magnitude
        return Math.min(1, Math.abs(output) * 2);
    }

    matrixVectorMultiply(matrix, vector) {
        return matrix.map(row => 
            row.reduce((sum, weight, i) => sum + weight * vector[i], 0)
        );
    }

    vectorAdd(vector1, vector2) {
        return vector1.map((val, i) => val + vector2[i]);
    }

    applyActivation(vector, activation) {
        switch (activation) {
            case 'relu':
                return vector.map(x => Math.max(0, x));
            case 'sigmoid':
                return vector.map(x => 1 / (1 + Math.exp(-x)));
            default:
                return vector;
        }
    }

    async train(trainingData) {
        if (!trainingData || trainingData.length === 0) {
            console.warn('No training data provided');
            return;
        }

        console.log(`🧠 Training neural MPC with ${trainingData.length} samples...`);

        try {
            // Simple gradient descent training
            const learningRate = this.networkConfig.learningRate;
            const epochs = this.networkConfig.epochs;

            for (let epoch = 0; epoch < epochs; epoch++) {
                let totalError = 0;

                for (const sample of trainingData) {
                    const { input, target } = sample;
                    
                    // Forward pass
                    const prediction = await this.predict(input);
                    const error = target - prediction.control;
                    
                    // Backward pass (simplified)
                    this.updateWeights(input, error, learningRate);
                    
                    totalError += error * error;
                }

                const avgError = totalError / trainingData.length;
                
                if (epoch % 10 === 0) {
                    console.log(`Epoch ${epoch}, Average Error: ${avgError.toFixed(4)}`);
                }
            }

            this.model.trained = true;
            this.saveModel();
            console.log('✅ Neural MPC training completed');

        } catch (error) {
            console.error('Neural MPC training error:', error);
        }
    }

    updateWeights(input, error, learningRate) {
        // Simplified weight update (in practice, use proper backpropagation)
        Object.keys(this.model.weights).forEach(layerKey => {
            this.model.weights[layerKey] = this.model.weights[layerKey].map(row =>
                row.map(weight => weight + learningRate * error * (Math.random() - 0.5))
            );
        });
    }

    saveModel() {
        try {
            localStorage.setItem('neural_mpc_model', JSON.stringify(this.model));
        } catch (error) {
            console.error('Failed to save neural MPC model:', error);
        }
    }

    parseModel(modelData) {
        // Reconstruct model from serialized data
        return {
            ...modelData,
            weights: modelData.weights,
            biases: modelData.biases
        };
    }

    setupDataCollection() {
        // Collect training data from system operation
        if (window.mqttClient) {
            // We'll collect data through MQTT updates
        }
    }

    collectTrainingData(systemState, appliedControl, performance) {
        const trainingSample = {
            input: {
                production: systemState.h2ProductionRate || 0,
                temperature: systemState.cellTemperature || 65,
                voltage: systemState.stackVoltage || 38,
                current: systemState.stackCurrent || 150,
                purity: systemState.o2Purity || 99.5,
                reference: systemState.prodRateSetpoint || 50
            },
            target: appliedControl,
            performance: performance,
            timestamp: Date.now()
        };

        this.trainingData.push(trainingSample);

        // Keep only recent data
        if (this.trainingData.length > 1000) {
            this.trainingData.shift();
        }

        // Auto-train if enough new data
        if (this.trainingData.length % 100 === 0) {
            this.train(this.trainingData.slice(-200)); // Train on recent 200 samples
        }
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            this.evaluatePerformance();
        }, 30000); // Evaluate every 30 seconds
    }

    evaluatePerformance() {
        if (this.performanceHistory.length === 0) return;

        const recentPerformance = this.performanceHistory.slice(-10);
        const avgTrackingError = recentPerformance.reduce((sum, p) => sum + p.trackingError, 0) / recentPerformance.length;
        const avgComputationTime = recentPerformance.reduce((sum, p) => sum + p.computationTime, 0) / recentPerformance.length;

        console.log(`📊 Neural MPC Performance - Tracking Error: ${avgTrackingError.toFixed(3)}, Computation: ${avgComputationTime.toFixed(1)}ms`);

        // Trigger retraining if performance degrades
        if (avgTrackingError > 5.0) {
            console.log('🔄 Performance degradation detected, triggering retraining...');
            this.train(this.trainingData.slice(-300));
        }
    }

    updatePerformance(performanceData) {
        this.performanceHistory.push({
            ...performanceData,
            timestamp: Date.now()
        });

        // Keep only recent performance data
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.shift();
        }
    }

    async computeControl(currentState, reference, previousControl) {
        if (!this.isInitialized) {
            throw new Error('Neural MPC not initialized');
        }

        const startTime = Date.now();

        try {
            // Prepare input for neural network
            const nnInput = {
                production: currentState.h2ProductionRate || 0,
                temperature: currentState.cellTemperature || 65,
                voltage: currentState.stackVoltage || 38,
                current: currentState.stackCurrent || 150,
                purity: currentState.o2Purity || 99.5,
                reference: reference
            };

            // Get neural network prediction
            const result = await this.predict(nnInput);
            
            const computationTime = Date.now() - startTime;

            // Apply safety constraints
            const constrainedControl = this.applySafetyConstraints(result.control, currentState);

            const controlResult = {
                control: constrainedControl,
                confidence: result.confidence,
                computationTime,
                algorithm: 'NEURAL_MPC',
                neuralOutput: result.control,
                constraintsApplied: constrainedControl !== result.control
            };

            // Record performance
            this.recordPerformance(controlResult, currentState, reference);

            return controlResult;

        } catch (error) {
            console.error('Neural MPC control computation failed:', error);
            
            // Fallback to simple MPC
            const mpcAlgorithms = new MPCAlgorithms();
            return mpcAlgorithms.DeterministicMPC(currentState, reference, previousControl);
        }
    }

    applySafetyConstraints(control, currentState) {
        let safeControl = control;

        // Temperature constraints
        if (currentState.temperature > 75) {
            safeControl = Math.min(safeControl, 150);
        }
        if (currentState.temperature > 78) {
            safeControl = Math.min(safeControl, 120);
        }

        // Voltage constraints
        if (currentState.voltage > 42) {
            safeControl = Math.min(safeControl, 160);
        }

        // Purity constraints
        if (currentState.purity < 99.3) {
            safeControl = Math.min(safeControl, 140);
        }

        // Absolute limits
        safeControl = Math.max(100, Math.min(200, safeControl));

        return safeControl;
    }

    recordPerformance(controlResult, currentState, reference) {
        const trackingError = Math.abs((currentState.h2ProductionRate * 3600) - reference);
        
        this.performanceHistory.push({
            trackingError,
            computationTime: controlResult.computationTime,
            control: controlResult.control,
            confidence: controlResult.confidence,
            timestamp: Date.now()
        });

        // Keep performance history manageable
        if (this.performanceHistory.length > 1000) {
            this.performanceHistory.shift();
        }
    }

    getPerformanceMetrics() {
        if (this.performanceHistory.length === 0) {
            return null;
        }

        const recent = this.performanceHistory.slice(-50);
        
        return {
            avgTrackingError: recent.reduce((sum, p) => sum + p.trackingError, 0) / recent.length,
            avgComputationTime: recent.reduce((sum, p) => sum + p.computationTime, 0) / recent.length,
            avgConfidence: recent.reduce((sum, p) => sum + (p.confidence || 0), 0) / recent.length,
            totalSamples: this.trainingData.length,
            modelTrained: this.model.trained
        };
    }

    reset() {
        this.trainingData = [];
        this.performanceHistory = [];
        this.model = this.initializeModel();
        this.saveModel();
        console.log('🔄 Neural MPC reset');
    }

    exportModel() {
        const exportData = {
            model: this.model,
            trainingData: this.trainingData,
            performanceHistory: this.performanceHistory,
            config: this.networkConfig,
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neural-mpc-model-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize Neural MPC when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.neuralMPC = new NeuralMPC();
});
