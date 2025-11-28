class MPCComparator {
    constructor() {
        this.comparisonData = {
            hempc: null,
            deterministic: null,
            stochastic: null,
            hybrid: null
        };
        this.performanceMetrics = {};
        this.comparisonHistory = [];
        
        this.init();
    }

    init() {
        this.setupComparisonTable();
        this.startPerformanceMonitoring();
    }

    setupComparisonTable() {
        // Initialize comparison table with default values
        this.updateComparisonTable();
    }

    updateComparison(data) {
        if (!data) return;

        // Update individual MPC strategy data
        if (data.hempc) this.comparisonData.hempc = data.hempc;
        if (data.deterministic) this.comparisonData.deterministic = data.deterministic;
        if (data.stochastic) this.comparisonData.stochastic = data.stochastic;
        if (data.hybrid) this.comparisonData.hybrid = data.hybrid;

        // Update performance metrics
        this.calculatePerformanceMetrics();

        // Update UI
        this.updateComparisonTable();
        this.updatePerformanceCharts();

        // Store in history
        this.storeComparisonSnapshot();
    }

    calculatePerformanceMetrics() {
        const metrics = {};
        const strategies = ['hempc', 'deterministic', 'stochastic', 'hybrid'];

        strategies.forEach(strategy => {
            const data = this.comparisonData[strategy];
            if (!data) return;

            metrics[strategy] = {
                cost: this.calculateCostMetric(data),
                production: this.calculateProductionMetric(data),
                efficiency: this.calculateEfficiencyMetric(data),
                computation: this.calculateComputationMetric(data),
                stability: this.calculateStabilityMetric(data),
                robustness: this.calculateRobustnessMetric(data)
            };
        });

        this.performanceMetrics = metrics;
    }

    calculateCostMetric(data) {
        // Calculate operational cost metric
        if (data.operationalCost !== undefined) {
            return data.operationalCost;
        }
        
        // Fallback calculation based on current and production
        if (data.current && data.h2Production) {
            return (data.current * 0.1) / (data.h2Production + 0.001); // $/L of H2
        }
        
        return Math.random() * 10 + 5; // Default random value for demo
    }

    calculateProductionMetric(data) {
        // H2 production rate
        if (data.h2Production !== undefined) {
            return data.h2Production * 3600; // Convert to L/h
        }
        return Math.random() * 30 + 10; // Default for demo
    }

    calculateEfficiencyMetric(data) {
        // System efficiency
        if (data.efficiency !== undefined) {
            return data.efficiency;
        }
        
        if (data.current && data.h2Production) {
            return (data.h2Production / (data.current + 0.001)) * 1000;
        }
        
        return Math.random() * 20 + 60; // Default 60-80%
    }

    calculateComputationMetric(data) {
        // Computation time in milliseconds
        if (data.computationTime !== undefined) {
            return data.computationTime;
        }
        return Math.random() * 50 + 10; // Default 10-60ms
    }

    calculateStabilityMetric(data) {
        // Control stability (lower is better)
        if (data.stability !== undefined) {
            return data.stability;
        }
        return Math.random() * 5 + 1; // Default 1-6%
    }

    calculateRobustnessMetric(data) {
        // Robustness to disturbances
        if (data.robustness !== undefined) {
            return data.robustness;
        }
        return Math.random() * 20 + 80; // Default 80-100%
    }

    updateComparisonTable() {
        const strategies = [
            { key: 'hempc', name: 'HE-MPC', row: 'hempc-row' },
            { key: 'deterministic', name: 'Deterministic MPC', row: 'deterministic-row' },
            { key: 'stochastic', name: 'Stochastic MPC', row: 'stochastic-row' },
            { key: 'hybrid', name: 'Hybrid MPC', row: 'hybrid-row' }
        ];

        strategies.forEach(strategy => {
            const metrics = this.performanceMetrics[strategy.key];
            if (!metrics) return;

            // Update cost
            const costElement = document.getElementById(`${strategy.key}-cost`);
            if (costElement) {
                costElement.textContent = `$${metrics.cost.toFixed(2)}`;
                this.applyPerformanceColor(costElement, metrics.cost, 15, 5, true); // Lower is better
            }

            // Update production
            const productionElement = document.getElementById(`${strategy.key}-production`);
            if (productionElement) {
                productionElement.textContent = `${metrics.production.toFixed(1)} L/h`;
                this.applyPerformanceColor(productionElement, metrics.production, 10, 35, false); // Higher is better
            }

            // Update efficiency
            const efficiencyElement = document.getElementById(`${strategy.key}-efficiency`);
            if (efficiencyElement) {
                efficiencyElement.textContent = `${metrics.efficiency.toFixed(1)}%`;
                this.applyPerformanceColor(efficiencyElement, metrics.efficiency, 60, 80, false); // Higher is better
            }

            // Update computation time
            const computationElement = document.getElementById(`${strategy.key}-computation`);
            if (computationElement) {
                computationElement.textContent = `${metrics.computation.toFixed(1)} ms`;
                this.applyPerformanceColor(computationElement, metrics.computation, 10, 50, true); // Lower is better
            }
        });
    }

    applyPerformanceColor(element, value, lowThreshold, highThreshold, lowerIsBetter) {
        // Remove existing color classes
        element.classList.remove('performance-good', 'performance-medium', 'performance-poor');
        
        let performanceClass = 'performance-medium';
        
        if (lowerIsBetter) {
            if (value <= lowThreshold) performanceClass = 'performance-good';
            else if (value >= highThreshold) performanceClass = 'performance-poor';
        } else {
            if (value >= highThreshold) performanceClass = 'performance-good';
            else if (value <= lowThreshold) performanceClass = 'performance-poor';
        }
        
        element.classList.add(performanceClass);
    }

    updatePerformanceCharts() {
        // Update the performance comparison chart
        if (window.charts && window.charts.charts.mpcPerformance) {
            window.charts.updateMPCComparison({
                performance: Object.fromEntries(
                    Object.entries(this.performanceMetrics).map(([key, metrics]) => [
                        key, 
                        this.calculateOverallScore(metrics)
                    ])
                )
            });
        }
    }

    calculateOverallScore(metrics) {
        // Calculate overall performance score (0-100)
        const weights = {
            cost: 0.25,
            production: 0.25,
            efficiency: 0.20,
            computation: 0.15,
            stability: 0.10,
            robustness: 0.05
        };

        let score = 0;
        let totalWeight = 0;

        // Normalize each metric to 0-100 scale
        Object.entries(weights).forEach(([metric, weight]) => {
            if (metrics[metric] !== undefined) {
                let normalized;
                
                switch(metric) {
                    case 'cost':
                        normalized = Math.max(0, 100 - (metrics.cost / 15) * 100); // Lower cost = higher score
                        break;
                    case 'production':
                        normalized = Math.min(100, (metrics.production / 40) * 100); // Higher production = higher score
                        break;
                    case 'efficiency':
                        normalized = metrics.efficiency; // Already in percentage
                        break;
                    case 'computation':
                        normalized = Math.max(0, 100 - (metrics.computation / 100) * 100); // Lower computation = higher score
                        break;
                    case 'stability':
                        normalized = Math.max(0, 100 - metrics.stability * 10); // Lower stability metric = higher score
                        break;
                    case 'robustness':
                        normalized = metrics.robustness; // Already in percentage
                        break;
                    default:
                        normalized = 50;
                }

                score += normalized * weight;
                totalWeight += weight;
            }
        });

        return Math.round(score / totalWeight);
    }

    storeComparisonSnapshot() {
        const snapshot = {
            timestamp: new Date().toISOString(),
            performance: { ...this.performanceMetrics },
            overallScores: this.calculateOverallScores()
        };

        this.comparisonHistory.push(snapshot);

        // Keep only last 100 snapshots
        if (this.comparisonHistory.length > 100) {
            this.comparisonHistory.shift();
        }
    }

    calculateOverallScores() {
        const scores = {};
        Object.entries(this.performanceMetrics).forEach(([strategy, metrics]) => {
            scores[strategy] = this.calculateOverallScore(metrics);
        });
        return scores;
    }

    startPerformanceMonitoring() {
        // Periodic performance analysis
        setInterval(() => {
            this.analyzePerformanceTrends();
        }, 10000); // Every 10 seconds
    }

    analyzePerformanceTrends() {
        if (this.comparisonHistory.length < 2) return;

        const recentSnapshots = this.comparisonHistory.slice(-5);
        const trends = {};

        ['hempc', 'deterministic', 'stochastic', 'hybrid'].forEach(strategy => {
            const scores = recentSnapshots.map(snap => 
                snap.overallScores[strategy] || 0
            );
            
            if (scores.length >= 2) {
                const trend = scores[scores.length - 1] - scores[0];
                trends[strategy] = {
                    direction: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
                    magnitude: Math.abs(trend)
                };
            }
        });

        // Update trend indicators in UI
        this.updateTrendIndicators(trends);
    }

    updateTrendIndicators(trends) {
        Object.entries(trends).forEach(([strategy, trend]) => {
            const trendElement = document.getElementById(`${strategy}-trend`);
            if (!trendElement) return;

            trendElement.className = 'metric-trend';
            
            if (trend.direction === 'improving') {
                trendElement.classList.add('trend-up');
                trendElement.innerHTML = '<i class="fas fa-arrow-up"></i> Improving';
            } else if (trend.direction === 'declining') {
                trendElement.classList.add('trend-down');
                trendElement.innerHTML = '<i class="fas fa-arrow-down"></i> Declining';
            } else {
                trendElement.classList.add('trend-stable');
                trendElement.innerHTML = '<i class="fas fa-minus"></i> Stable';
            }
        });
    }

    getBestPerformingStrategy() {
        const scores = this.calculateOverallScores();
        let bestStrategy = null;
        let bestScore = -1;

        Object.entries(scores).forEach(([strategy, score]) => {
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
            }
        });

        return {
            strategy: bestStrategy,
            score: bestScore,
            metrics: this.performanceMetrics[bestStrategy]
        };
    }

    generateComparisonReport() {
        const best = this.getBestPerformingStrategy();
        
        return {
            timestamp: new Date().toISOString(),
            bestPerformingStrategy: best.strategy,
            bestScore: best.score,
            performanceMetrics: this.performanceMetrics,
            overallScores: this.calculateOverallScores(),
            recommendation: this.generateRecommendation(best)
        };
    }

    generateRecommendation(bestStrategy) {
        const { strategy, score, metrics } = bestStrategy;
        
        if (score >= 80) {
            return `Strong recommendation: Continue using ${strategy}. Excellent performance across all metrics.`;
        } else if (score >= 60) {
            return `Good performance: ${strategy} is working well. Consider fine-tuning parameters for better results.`;
        } else {
            return `Needs improvement: ${strategy} shows suboptimal performance. Consider switching strategies or reconfiguring parameters.`;
        }
    }

    exportComparisonData() {
        const exportData = {
            comparisonData: this.comparisonData,
            performanceMetrics: this.performanceMetrics,
            comparisonHistory: this.comparisonHistory,
            report: this.generateComparisonReport(),
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mpc-comparison-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    resetComparison() {
        this.comparisonData = {
            hempc: null,
            deterministic: null,
            stochastic: null,
            hybrid: null
        };
        this.performanceMetrics = {};
        this.comparisonHistory = [];
        this.updateComparisonTable();
    }
}

// Add CSS for performance colors
const performanceStyles = `
.performance-good { color: var(--success-color); font-weight: bold; }
.performance-medium { color: var(--warning-color); }
.performance-poor { color: var(--danger-color); }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = performanceStyles;
document.head.appendChild(styleSheet);

// Initialize MPC Comparator when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.mpcComparator = new MPCComparator();
});
