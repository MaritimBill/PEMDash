class MPCAlgorithms {
    constructor() {
        this.algorithms = {
            HEMPC: this.HEMPC.bind(this),
            DETERMINISTIC: this.DeterministicMPC.bind(this),
            STOCHASTIC: this.StochasticMPC.bind(this),
            HYBRID: this.HybridMPC.bind(this)
        };
        
        this.modelParameters = {
            // PEM Electrolyzer model parameters
            A_MATRIX: 0.95,
            B_MATRIX: 0.8,
            C_MATRIX: 1.0,
            MAX_CURRENT: 200,
            MIN_CURRENT: 100,
            MAX_TEMPERATURE: 80,
            MIN_O2_PURITY: 99.0
        };
    }

    // Hierarchical Economic MPC (HE-MPC)
    async HEMPC(currentState, reference, previousControl, parameters = {}) {
        const {
            horizon = 10,
            sampleTime = 0.1,
            qWeight = 10.0,
            rWeight = 1.0,
            sWeight = 100.0,
            economicWeight = 0.5
        } = parameters;

        try {
            // Upper layer: Economic optimization
            const economicSetpoint = this.upperLayerEconomicOptimization(currentState, reference, parameters);
            
            // Lower layer: Tracking control
            const control = this.lowerLayerTrackingMPC(
                currentState, 
                economicSetpoint, 
                previousControl, 
                parameters
            );

            return {
                control,
                economicSetpoint,
                horizon,
                computationTime: Date.now(),
                algorithm: 'HEMPC'
            };

        } catch (error) {
            console.error('HE-MPC computation error:', error);
            return this.fallbackControl(currentState, previousControl);
        }
    }

    // Deterministic Receding-Horizon MPC
    async DeterministicMPC(currentState, reference, previousControl, parameters = {}) {
        const {
            horizon = 10,
            sampleTime = 0.1,
            qWeight = 10.0,
            rWeight = 1.0
        } = parameters;

        try {
            // Standard MPC formulation
            let optimalControl = previousControl;
            let minCost = Number.MAX_VALUE;

            // Simple gradient-based optimization
            const controlRange = this.modelParameters.MAX_CURRENT - this.modelParameters.MIN_CURRENT;
            const stepSize = controlRange / 20;

            for (let u = this.modelParameters.MIN_CURRENT; u <= this.modelParameters.MAX_CURRENT; u += stepSize) {
                const cost = this.evaluateMPCCost(currentState, u, reference, horizon, qWeight, rWeight);
                
                if (cost < minCost) {
                    minCost = cost;
                    optimalControl = u;
                }
            }

            // Apply constraints
            optimalControl = this.applyConstraints(optimalControl, currentState);

            return {
                control: optimalControl,
                cost: minCost,
                horizon,
                computationTime: Date.now(),
                algorithm: 'DETERMINISTIC'
            };

        } catch (error) {
            console.error('Deterministic MPC computation error:', error);
            return this.fallbackControl(currentState, previousControl);
        }
    }

    // Stochastic MPC with uncertainty handling
    async StochasticMPC(currentState, reference, previousControl, parameters = {}) {
        const {
            horizon = 10,
            sampleTime = 0.1,
            qWeight = 10.0,
            rWeight = 1.0,
            scenarios = 5,
            uncertaintyLevel = 0.1
        } = parameters;

        try {
            // Generate multiple scenarios for uncertainty
            const scenarioControls = [];
            const scenarioCosts = [];

            for (let i = 0; i < scenarios; i++) {
                // Add uncertainty to state prediction
                const uncertainState = this.addUncertainty(currentState, uncertaintyLevel);
                
                const result = await this.DeterministicMPC(
                    uncertainState, 
                    reference, 
                    previousControl, 
                    parameters
                );
                
                scenarioControls.push(result.control);
                scenarioCosts.push(result.cost);
            }

            // Robust control: average of scenario controls
            const robustControl = scenarioControls.reduce((sum, control) => sum + control, 0) / scenarios;
            
            // Apply additional robustness margin
            const finalControl = this.applyRobustnessMargin(robustControl, currentState);

            return {
                control: finalControl,
                scenarios,
                scenarioCosts,
                computationTime: Date.now(),
                algorithm: 'STOCHASTIC'
            };

        } catch (error) {
            console.error('Stochastic MPC computation error:', error);
            return this.fallbackControl(currentState, previousControl);
        }
    }

    // Hybrid MPC combining continuous and discrete decisions
    async HybridMPC(currentState, reference, previousControl, parameters = {}) {
        const {
            horizon = 10,
            sampleTime = 0.1,
            qWeight = 10.0,
            rWeight = 1.0,
            discreteOptions = [100, 150, 200] // Example discrete current levels
        } = parameters;

        try {
            let bestControl = previousControl;
            let minCost = Number.MAX_VALUE;
            let bestDiscreteOption = discreteOptions[0];

            // Evaluate each discrete option
            for (const discreteControl of discreteOptions) {
                // Continuous optimization around discrete option
                const continuousRange = 20; // ±20A around discrete option
                const start = Math.max(this.modelParameters.MIN_CURRENT, discreteControl - continuousRange);
                const end = Math.min(this.modelParameters.MAX_CURRENT, discreteControl + continuousRange);
                const stepSize = 5;

                for (let u = start; u <= end; u += stepSize) {
                    const cost = this.evaluateMPCCost(currentState, u, reference, horizon, qWeight, rWeight);
                    
                    if (cost < minCost) {
                        minCost = cost;
                        bestControl = u;
                        bestDiscreteOption = discreteControl;
                    }
                }
            }

            return {
                control: bestControl,
                discreteOption: bestDiscreteOption,
                cost: minCost,
                computationTime: Date.now(),
                algorithm: 'HYBRID'
            };

        } catch (error) {
            console.error('Hybrid MPC computation error:', error);
            return this.fallbackControl(currentState, previousControl);
        }
    }

    // Upper layer: Economic optimization for HE-MPC
    upperLayerEconomicOptimization(currentState, reference, parameters) {
        // Simplified economic optimization
        // In practice, this would consider electricity prices, demand patterns, etc.
        
        const timeOfDay = new Date().getHours();
        let economicAdjustment = 0;

        // Time-based economic adjustments
        if (timeOfDay >= 0 && timeOfDay < 6) {
            // Night hours - lower electricity costs
            economicAdjustment = 0.1; // Increase production
        } else if (timeOfDay >= 18 && timeOfDay < 24) {
            // Evening peak - higher electricity costs
            economicAdjustment = -0.1; // Decrease production
        }

        // State-based adjustments
        if (currentState.temperature > 75) {
            economicAdjustment -= 0.05; // Reduce due to high temperature
        }

        if (currentState.purity < 99.3) {
            economicAdjustment -= 0.1; // Reduce due to purity concerns
        }

        const economicSetpoint = reference * (1 + economicAdjustment);
        return Math.max(0, Math.min(100, economicSetpoint));
    }

    // Lower layer: Tracking MPC for HE-MPC
    lowerLayerTrackingMPC(currentState, reference, previousControl, parameters) {
        // Fast tracking control without economic computations
        return this.DeterministicMPC(currentState, reference, previousControl, {
            ...parameters,
            horizon: 5, // Shorter horizon for faster computation
            qWeight: parameters.qWeight * 2 // Higher tracking weight
        }).then(result => result.control);
    }

    // Cost function evaluation
    evaluateMPCCost(currentState, control, reference, horizon, qWeight, rWeight) {
        let totalCost = 0;
        let state = currentState.production || 0; // Use production as state for tracking

        for (let k = 0; k < horizon; k++) {
            // State prediction
            state = this.modelParameters.A_MATRIX * state + this.modelParameters.B_MATRIX * control;
            
            // Tracking error cost
            const trackingError = state - reference;
            totalCost += qWeight * trackingError * trackingError;

            // Control effort cost (except first step)
            if (k > 0) {
                totalCost += rWeight * control * control;
            }
        }

        // Terminal cost
        const terminalError = state - reference;
        totalCost += parameters.sWeight || 100 * terminalError * terminalError;

        return totalCost;
    }

    // Uncertainty modeling for stochastic MPC
    addUncertainty(state, uncertaintyLevel) {
        if (typeof state === 'number') {
            const uncertainty = (Math.random() - 0.5) * 2 * uncertaintyLevel * state;
            return state + uncertainty;
        }

        // For state objects, add uncertainty to key parameters
        return {
            ...state,
            production: state.production ? state.production + (Math.random() - 0.5) * 2 * uncertaintyLevel * state.production : 0,
            temperature: state.temperature ? state.temperature + (Math.random() - 0.5) * 2 * uncertaintyLevel : 65
        };
    }

    // Robustness margin for stochastic control
    applyRobustnessMargin(control, currentState) {
        let margin = 0;

        // Increase margin for critical conditions
        if (currentState.temperature > 75) {
            margin -= 10; // Reduce current for high temperature
        }

        if (currentState.purity < 99.3) {
            margin -= 5; // Reduce current for purity concerns
        }

        // Voltage considerations
        if (currentState.voltage > 42) {
            margin -= 8; // Reduce current for high voltage
        }

        return Math.max(
            this.modelParameters.MIN_CURRENT,
            Math.min(this.modelParameters.MAX_CURRENT, control + margin)
        );
    }

    // Safety constraints application
    applyConstraints(control, currentState) {
        let constrainedControl = control;

        // Temperature constraints
        if (currentState.temperature > 75) {
            constrainedControl = Math.min(constrainedControl, 150);
        }
        if (currentState.temperature > 78) {
            constrainedControl = Math.min(constrainedControl, 120);
        }

        // Voltage constraints
        if (currentState.voltage > 42) {
            constrainedControl = Math.min(constrainedControl, 160);
        }

        // Purity constraints
        if (currentState.purity < 99.3) {
            constrainedControl = Math.min(constrainedControl, 140);
        }

        // Absolute limits
        constrainedControl = Math.max(
            this.modelParameters.MIN_CURRENT,
            Math.min(this.modelParameters.MAX_CURRENT, constrainedControl)
        );

        return constrainedControl;
    }

    // Fallback control for error conditions
    fallbackControl(currentState, previousControl) {
        console.warn('Using fallback control');
        
        // Simple proportional control with constraints
        const error = (currentState.reference || 50) - (currentState.production || 0);
        const proportionalGain = 0.5;
        
        let control = previousControl + proportionalGain * error;
        control = this.applyConstraints(control, currentState);

        return {
            control,
            algorithm: 'FALLBACK',
            computationTime: Date.now(),
            note: 'Fallback control activated due to algorithm error'
        };
    }

    // Performance monitoring and adaptation
    monitorPerformance(controlResult, actualPerformance) {
        const performanceMetrics = {
            trackingError: Math.abs(actualPerformance.production - controlResult.reference),
            controlEffort: Math.abs(controlResult.control - (controlResult.previousControl || 0)),
            computationTime: Date.now() - controlResult.computationTime,
            constraintViolations: this.checkConstraintViolations(controlResult.control, actualPerformance)
        };

        // Adaptive tuning based on performance
        if (performanceMetrics.trackingError > 5) {
            console.log('High tracking error - consider increasing Q weight');
        }

        if (performanceMetrics.controlEffort > 20) {
            console.log('High control effort - consider increasing R weight');
        }

        return performanceMetrics;
    }

    checkConstraintViolations(control, actualPerformance) {
        const violations = [];

        if (control > this.modelParameters.MAX_CURRENT) {
            violations.push('MAX_CURRENT');
        }
        if (control < this.modelParameters.MIN_CURRENT) {
            violations.push('MIN_CURRENT');
        }
        if (actualPerformance.temperature > this.modelParameters.MAX_TEMPERATURE) {
            violations.push('MAX_TEMPERATURE');
        }
        if (actualPerformance.purity < this.modelParameters.MIN_O2_PURITY) {
            violations.push('MIN_O2_PURITY');
        }

        return violations;
    }

    // Get algorithm description
    getAlgorithmDescription(algorithm) {
        const descriptions = {
            HEMPC: 'Hierarchical Economic MPC: Separates economic optimization from fast tracking control. Suitable for multi-time-scale objectives.',
            DETERMINISTIC: 'Deterministic Receding-Horizon MPC: Standard MPC with perfect forecast assumption. Computationally efficient but sensitive to uncertainties.',
            STOCHASTIC: 'Stochastic MPC: Explicitly handles uncertainties through scenario-based optimization. More robust but computationally intensive.',
            HYBRID: 'Hybrid MPC: Combines continuous control with discrete decisions. Suitable for systems with both continuous and discrete actuators.'
        };

        return descriptions[algorithm] || 'Unknown algorithm';
    }

    // Validate parameters
    validateParameters(parameters) {
        const errors = [];

        if (parameters.horizon && (parameters.horizon < 1 || parameters.horizon > 50)) {
            errors.push('Horizon must be between 1 and 50');
        }

        if (parameters.qWeight && parameters.qWeight <= 0) {
            errors.push('Q weight must be positive');
        }

        if (parameters.rWeight && parameters.rWeight <= 0) {
            errors.push('R weight must be positive');
        }

        return errors;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MPCAlgorithms;
} else {
    window.MPCAlgorithms = MPCAlgorithms;
}
