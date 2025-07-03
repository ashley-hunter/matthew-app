
import { Calculator, Clipboard, Eye, HandCoins, Info, Minus, Plus, Ruler, Scale, Settings, Weight } from 'lucide-react'; // Added Clipboard, Plus, Minus icons
import { useCallback, useEffect, useMemo, useState } from 'react';

// Main App component for the Brake Press Costing Calculator
function BrakePressCalculator() {
  // State variables for user inputs and settings
  const [complexity, setComplexity] = useState(3); // Complexity level (1-5)
  const [bends, setBends] = useState(1); // Number of bends
  const [quantity, setQuantity] = useState(1); // Quantity of parts
  const [numMen, setNumMen] = useState(1); // Number of men required for the job

  // User-editable base settings for calculations
  const [setupTimeMinutes, setSetupTimeMinutes] = useState(30); // Setup time per job in minutes
  const [hourlyRateGBP, setHourlyRateGBP] = useState(45); // Hourly rate in GBP

  // State for time per bend based on complexity (in minutes per bend)
  // This can be customized by the user in the settings
  const [timePerComplexity, setTimePerComplexity] = useState({
    1: 0.25, // 15 seconds
    2: 0.5,  // 30 seconds
    3: 0.75, // 45 seconds
    4: 1.0,  // 60 seconds (1 minute)
    5: 1.5   // 90 seconds (1.5 minutes)
  } as const);

  // Material properties for weight calculation
  const [materialDensity, setMaterialDensity] = useState({ // Density in kg/m³
    'Mild Steel': 7850,
    'Stainless Steel': 8000,
    'Aluminium': 2700,
    'Brass': 8400,
    'Copper': 8960
  } as const);
  const [materialType, setMaterialType] = useState<keyof typeof materialDensity>('Mild Steel');

  // Part dimensions for weight calculation (in mm)
  const [partLengthMm, setPartLengthMm] = useState(1000);
  const [partWidthMm, setPartWidthMm] = useState(50);
  const [partThicknessMm, setPartThicknessMm] = useState(3);

  // Tonnage calculation states
  // Initial available V-die tooling sizes (in mm) as provided by the user
  const initialVDies = useMemo(() => [6, 8, 10, 12, 16, 22, 25, 35, 50, 80], []);
  const [availableVDies, setAvailableVDies] = useState(initialVDies);
  // Set initial vDieOpeningMm to the first available die or a default if list is empty
  const [vDieOpeningMm, setVDieOpeningMm] = useState(initialVDies.length > 0 ? initialVDies[0] : 18);

  // Empirical constants for tonnage calculation (Tonnage/meter = (Constant * Thickness^2) / V-die Opening)
  const [tonnageConstants, setTonnageConstants] = useState({
    'Mild Steel': 7,
    'Stainless Steel': 11,
    'Aluminium': 3.5,
    'Brass': 8,
    'Copper': 9
  });

  const [tonnagePerMeter, setTonnagePerMeter] = useState(0);
  const [overallTonnage, setOverallTonnage] = useState(0);

  // Calculated values
  const [totalFoldingTimeMinutes, setTotalFoldingTimeMinutes] = useState(0);
  const [totalBendAndSetupTimeMinutes, setTotalBendAndSetupTimeMinutes] = useState(0);
  const [jobCost, setJobCost] = useState(0);
  const [setupCost, setSetupCost] = useState(0);
  const [bendingCost, setBendingCost] = useState(0);
  const [finalPrice, setFinalPrice] = useState(0);
  const [partWeightKg, setPartWeightKg] = useState(0);
  const [weightSafetyMessage, setWeightSafetyMessage] = useState('');

  // State for controlling result animation
  const [animateResults, setAnimateResults] = useState(false);

  // States for copy button feedback
  const [copyTimeButtonText, setCopyTimeButtonText] = useState('Copy');
  const [copyPriceButtonText, setCopyPriceButtonText] = useState('Copy');

  // Show/hide settings panel and quick view panel
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false); // Declared here

  // --- Calculations ---

  // Memoize current time per bend to avoid re-calculating on every render
  const currentTimePerBend = useMemo(() => {
    return timePerComplexity[complexity as keyof typeof timePerComplexity] || 0;
  }, [complexity, timePerComplexity]);

  // Calculate total folding time (per part * quantity * number of men)
  const calculateTotalFoldingTime = useCallback(() => {
    return (bends * currentTimePerBend * quantity * numMen);
  }, [bends, currentTimePerBend, quantity, numMen]);

  // Calculate the total job cost
  const calculateJobCost = useCallback(() => {
    const totalTimeInMinutes = setupTimeMinutes + totalFoldingTimeMinutes;
    return (totalTimeInMinutes / 60) * hourlyRateGBP;
  }, [setupTimeMinutes, totalFoldingTimeMinutes, hourlyRateGBP]);

  // Calculate the setup cost
  const calculateSetupCost = useCallback(() => {
    return (setupTimeMinutes / 60) * hourlyRateGBP;
  }, [setupTimeMinutes, hourlyRateGBP]);

  // Calculate the bending cost
  const calculateBendingCost = useCallback(() => {
    return (totalFoldingTimeMinutes / 60) * hourlyRateGBP;
  }, [totalFoldingTimeMinutes, hourlyRateGBP]);

  // Calculate the final price (now simply the job cost)
  const calculateFinalPrice = useCallback(() => {
    return jobCost;
  }, [jobCost]);

  // Calculate the weight of a single part
  const calculatePartWeight = useCallback(() => {
    const lengthM = partLengthMm / 1000;
    const widthM = partWidthMm / 1000;
    const thicknessM = partThicknessMm / 1000;
    const currentDensity = materialDensity[materialType] || 0;
    return (lengthM * widthM * thicknessM * currentDensity);
  }, [partLengthMm, partWidthMm, partThicknessMm, materialType, materialDensity]);

  // Determine weight safety message
  const getWeightSafetyMessage = useCallback(() => {
    if (partWeightKg === 0) return '';
    if (partWeightKg < 25) {
      return 'Safe for one person to handle.';
    } else if (partWeightKg >= 25 && partWeightKg < 50) {
      return 'Heavy part: May require two people or mechanical aid.';
    } else {
      return 'Very heavy part: Mechanical aid (e.g., crane, forklift) strongly recommended.';
    }
  }, [partWeightKg]);

  // Calculate tonnage required for bending
  const calculateTonnage = useCallback(() => {
    const currentThickness = partThicknessMm;
    const currentVdie = vDieOpeningMm;
    const currentMaterialTonnageConstant = tonnageConstants[materialType] || 0;
    const lengthM = partLengthMm / 1000;

    if (currentThickness <= 0 || currentVdie <= 0 || currentMaterialTonnageConstant <= 0) {
      return { tonnagePerM: 0, overallT: 0 };
    }

    const tonnagePerM = (currentMaterialTonnageConstant * Math.pow(currentThickness, 2)) / currentVdie;
    const overallT = tonnagePerM * lengthM;

    return { tonnagePerM, overallT };
  }, [partThicknessMm, vDieOpeningMm, materialType, tonnageConstants, partLengthMm]);

  // Recommend V-die opening based on thickness (8x thickness is common) and available tooling
  const getRecommendedVdie = useCallback(() => {
    if (partThicknessMm <= 0 || availableVDies.length === 0) return 'N/A';

    const idealVdie = partThicknessMm * 8; // Using 8x as the common starting point

    // Find the closest available V-die
    let closestVdie = availableVDies[0];
    let minDifference = Math.abs(idealVdie - availableVDies[0]);

    for (let i = 1; i < availableVDies.length; i++) {
      const difference = Math.abs(idealVdie - availableVDies[i]);
      if (difference < minDifference) {
        minDifference = difference;
        closestVdie = availableVDies[i];
      }
    }
    // console.log(`DEBUG: Thickness: ${partThicknessMm}, Ideal V-Die (8x): ${idealVdie.toFixed(2)}, Closest Available: ${closestVdie}, Available Dies: [${availableVDies.join(', ')}]`);
    return `${closestVdie} mm (closest to ${idealVdie.toFixed(1)}mm, approx. 8x thickness)`;
  }, [partThicknessMm, availableVDies]);

  // --- useEffect hooks to update calculations and trigger animations ---

  useEffect(() => {
    setTotalFoldingTimeMinutes(calculateTotalFoldingTime());
  }, [calculateTotalFoldingTime]);

  useEffect(() => {
    const newTotalBendAndSetupTime = setupTimeMinutes + totalFoldingTimeMinutes;
    if (newTotalBendAndSetupTime !== totalBendAndSetupTimeMinutes) {
      setTotalBendAndSetupTimeMinutes(newTotalBendAndSetupTime);
      setAnimateResults(true); // Trigger animation
    }
  }, [setupTimeMinutes, totalFoldingTimeMinutes, totalBendAndSetupTimeMinutes]);

  useEffect(() => {
    const newJobCost = calculateJobCost();
    if (newJobCost !== jobCost) {
      setJobCost(newJobCost);
      setAnimateResults(true);
    }
  }, [calculateJobCost, jobCost]);

  useEffect(() => {
    setSetupCost(calculateSetupCost());
  }, [calculateSetupCost]);

  useEffect(() => {
    setBendingCost(calculateBendingCost());
  }, [calculateBendingCost]);

  useEffect(() => {
    const newFinalPrice = calculateFinalPrice();
    if (newFinalPrice !== finalPrice) {
      setFinalPrice(newFinalPrice);
      setAnimateResults(true);
    }
  }, [calculateFinalPrice, finalPrice]);

  useEffect(() => {
    const newPartWeight = calculatePartWeight();
    if (newPartWeight !== partWeightKg) {
      setPartWeightKg(newPartWeight);
      setAnimateResults(true);
    }
  }, [calculatePartWeight, partWeightKg]);

  useEffect(() => {
    setWeightSafetyMessage(getWeightSafetyMessage());
  }, [getWeightSafetyMessage]);

  useEffect(() => {
    const { tonnagePerM, overallT } = calculateTonnage();
    if (tonnagePerM !== tonnagePerMeter || overallT !== overallTonnage) {
      setTonnagePerMeter(tonnagePerM);
      setOverallTonnage(overallT);
      setAnimateResults(true);
    }
  }, [calculateTonnage, tonnagePerMeter, overallTonnage]);

  // Reset animation state after a short delay
  useEffect(() => {
    if (animateResults) {
      const timer = setTimeout(() => setAnimateResults(false), 500); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [animateResults]);


  // Handler for changing time per complexity settings
  const handleTimePerComplexityChange = (level: string, value: string) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      setTimePerComplexity(prev => ({
        ...prev,
        [level]: numericValue
      }));
    } else if (value === '') {
      setTimePerComplexity(prev => ({
        ...prev,
        [level]: 0
      }));
    }
  };

  // Handler for changing material density settings
  const handleMaterialDensityChange = (type: string, value: string) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      setMaterialDensity(prev => ({
        ...prev,
        [type]: numericValue
      }));
    } else if (value === '') {
      setMaterialDensity(prev => ({
        ...prev,
        [type]: 0
      }));
    }
  };

  // Handler for changing tonnage constant settings
  const handleTonnageConstantChange = (type: string, value: string) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      setTonnageConstants(prev => ({
        ...prev,
        [type]: numericValue
      }));
    } else if (value === '') {
      setTonnageConstants(prev => ({
        ...prev,
        [type]: 0
      }));
    }
  };

  // Helper function to handle input changes, allowing empty string for 0
  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setter(0);
    } else {
      const numericValue = parseFloat(value);
      setter(isNaN(numericValue) ? 0 : numericValue);
    }
  };

  // Function to copy text to clipboard with feedback
  const copyToClipboard = (text: string, type: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.focus(); // Ensure the textarea is focused
    el.select();
    try {
      document.execCommand('copy');
      if (type === 'time') {
        setCopyTimeButtonText('Copied!');
        setTimeout(() => setCopyTimeButtonText('Copy'), 1500);
      } else if (type === 'price') {
        setCopyPriceButtonText('Copied!');
        setTimeout(() => setCopyPriceButtonText('Copy'), 1500);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      if (type === 'time') {
        setCopyTimeButtonText('Failed!');
        setTimeout(() => setCopyTimeButtonText('Copy'), 1500);
      } else if (type === 'price') {
        setCopyPriceButtonText('Failed!');
        setTimeout(() => setCopyPriceButtonText('Copy'), 1500);
      }
    } finally {
      document.body.removeChild(el);
    }
  };

  // Handlers for managing available V-dies
  const handleAddVDie = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value) && value > 0 && !availableVDies.includes(value)) {
      setAvailableVDies(prev => [...prev, value].sort((a, b) => a - b));
      (e.target as HTMLInputElement).value = ''; // Clear input after adding
    }
  };

  const handleRemoveVDie = (dieToRemove: number) => {
    setAvailableVDies(prev => {
      const newDies = prev.filter(die => die !== dieToRemove);
      // If the currently selected V-die is removed, default to the first available or 0
      if (vDieOpeningMm === dieToRemove) {
        setVDieOpeningMm(newDies.length > 0 ? newDies[0] : 0);
      }
      return newDies;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter text-gray-800 flex flex-col items-center">
      <style>
        {`
        @keyframes pulse-once {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.95; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pulse-once {
          animation: pulse-once 0.5s ease-out;
        }
        `}
      </style>
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl p-6 md:p-8 space-y-6">

        {/* Header */}
        <h1 className="text-3xl md:text-4xl font-extrabold text-center text-indigo-700 mb-6 flex items-center justify-center gap-3">
          <Calculator className="w-9 h-9 text-indigo-500" /> Brake Press Cost Calculator
        </h1>

        {/* Top Buttons: Settings and Quick View */}
        <div className="flex justify-center gap-3 mb-4">
          <button
            onClick={() => setShowQuickView(!showQuickView)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg shadow-md hover:bg-purple-600 transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            <Eye className="w-5 h-5" />
            {showQuickView ? 'Hide Quick View' : 'Show Quick View'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg shadow-md hover:bg-indigo-600 transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            <Settings className="w-5 h-5" />
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        {/* Quick View Panel (conditionally rendered) */}
        {showQuickView && (
          <div className="bg-blue-50 p-5 rounded-lg shadow-inner border border-blue-200 mb-6 space-y-4 animate-fade-in">
            <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
              <Eye className="w-6 h-6" /> Quick Job Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Key Inputs */}
              <div className="bg-blue-100 p-3 rounded-md shadow-sm border border-blue-200">
                <p className="font-medium text-blue-800">Bends: <span className="font-semibold text-blue-900">{bends}</span></p>
              </div>
              <div className="bg-blue-100 p-3 rounded-md shadow-sm border border-blue-200">
                <p className="font-medium text-blue-800">Quantity: <span className="font-semibold text-blue-900">{quantity}</span></p>
              </div>
              <div className="bg-blue-100 p-3 rounded-md shadow-sm border border-blue-200">
                <p className="font-medium text-blue-800">Complexity: <span className="font-semibold text-blue-900">{complexity}</span></p>
              </div>
              <div className="bg-blue-100 p-3 rounded-md shadow-sm border border-blue-200">
                <p className="font-medium text-blue-800">Men: <span className="font-semibold text-blue-900">{numMen}</span></p>
              </div>
              <div className="bg-blue-100 p-3 rounded-md shadow-sm border border-blue-200">
                <p className="font-medium text-blue-800">Setup Time: <span className="font-semibold text-blue-900">{setupTimeMinutes} min</span></p>
              </div>

              {/* Key Outputs */}
              <div className={`md:col-span-1 lg:col-span-3 bg-gradient-to-r from-blue-400 to-indigo-500 text-white p-4 rounded-lg shadow-md flex justify-between items-center ${animateResults ? 'animate-pulse-once' : ''}`}>
                <span className="text-lg font-medium">Total Job Time:</span>
                <span className="text-3xl font-extrabold">{totalBendAndSetupTimeMinutes.toFixed(2)} min</span>
              </div>
              <div className={`md:col-span-1 lg:col-span-3 bg-gradient-to-r from-green-500 to-teal-600 text-white p-4 rounded-lg shadow-md flex justify-between items-center ${animateResults ? 'animate-pulse-once' : ''}`}>
                <span className="text-lg font-medium">Final Quoted Price:</span>
                <span className="text-3xl font-extrabold">£{finalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}


        {/* Settings Panel (conditionally rendered) */}
        {showSettings && (
          <div className="bg-gray-50 p-5 rounded-lg shadow-inner border border-gray-200 mb-6 space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
              <Settings className="w-6 h-6" /> General Settings
            </h2>

            {/* Hourly Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (£)</label>
                <input
                  type="number"
                  id="hourlyRate"
                  value={hourlyRateGBP === 0 ? '' : hourlyRateGBP}
                  onChange={handleNumericInputChange(setHourlyRateGBP)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  min="0"
                />
              </div>
            </div>

            {/* Time per Complexity Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4">Time Per Bend by Complexity (minutes per bend)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {Object.keys(timePerComplexity).map((level) => (
                  <div key={level} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                    <label htmlFor={`complexity-${level}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Complexity {level}
                    </label>
                    <input
                      type="number"
                      id={`complexity-${level}`}
                      value={timePerComplexity[level as unknown as keyof typeof timePerComplexity]}
                      onChange={(e) => handleTimePerComplexityChange(level, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      min="0"
                      step="0.01"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Material Density Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4">Material Densities (kg/m³)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.keys(materialDensity).map((type) => (
                  <div key={type} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                    <label htmlFor={`density-${type}`} className="block text-sm font-medium text-gray-700 mb-1">
                      {type}
                    </label>
                    <input
                      type="number"
                      id={`density-${type}`}
                      value={materialDensity[type as keyof typeof materialDensity]}
                      onChange={(e) => handleMaterialDensityChange(type, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      min="0"
                      step="0.01"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Tonnage Constants Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4 flex items-center gap-2">
                Tonnage Constants (for Tonnage/meter calculation)
                <div className="relative group">
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    (Tonnage/meter $\approx$ Constant * Thickness$^2$ / V-die Opening)
                  </div>
                </div>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.keys(tonnageConstants).map((type) => (
                  <div key={type} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                    <label htmlFor={`tonnage-constant-${type}`} className="block text-sm font-medium text-gray-700 mb-1">
                      {type}
                    </label>
                    <input
                      type="number"
                      id={`tonnage-constant-${type}`}
                      value={tonnageConstants[type as keyof typeof tonnageConstants]}
                      onChange={(e) => handleTonnageConstantChange(type, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      min="0"
                      step="0.1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Manage Available V-Dies */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4 flex items-center gap-2">
                Manage Available V-Die Tooling (mm)
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {availableVDies.map(die => (
                  <span key={die} className="flex items-center bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">
                    {die} mm
                    <button
                      onClick={() => handleRemoveVDie(die)}
                      className="ml-2 text-indigo-600 hover:text-indigo-900 focus:outline-none"
                      aria-label={`Remove ${die}mm V-Die`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Add new V-die (mm)"
                  onBlur={handleAddVDie} // Add on blur
                  onKeyDown={(e) => { // Add on Enter key
                    if (e.key === 'Enter') {
                      handleAddVDie(e);
                    }
                  }}
                  className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  min="0"
                  step="1"
                />
                <button
                  onClick={() => { /* Trigger add logic from input blur/keydown */ }}
                  className="p-2 bg-indigo-500 text-white rounded-md shadow-sm hover:bg-indigo-600 transition-all"
                  aria-label="Add V-Die"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Enter a number and press Enter or click outside the input to add.</p>
            </div>
          </div>
        )}

        {/* Job Details Input Section */}
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-100">
          <h2 className="text-2xl font-bold text-indigo-600 mb-4 flex items-center gap-2">
            <Ruler className="w-6 h-6" /> Job Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Setup Time (Moved to main interface) */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="setupTime" className="block text-sm font-medium text-gray-700 mb-1">Setup Time (minutes per job)</label>
              <input
                type="number"
                id="setupTime"
                value={setupTimeMinutes === 0 ? '' : setupTimeMinutes}
                onChange={handleNumericInputChange(setSetupTimeMinutes)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="0"
              />
            </div>

            {/* Complexity Slider */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="complexity" className="block text-sm font-medium text-gray-700 mb-1">
                Complexity Level (1-5)
              </label>
              <input
                type="range"
                id="complexity"
                min="1"
                max="5"
                step="1"
                value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="text-center mt-1 text-indigo-600 font-semibold">
                {complexity} ({currentTimePerBend.toFixed(2)} min/bend)
              </div>
            </div>

            {/* Number of Bends */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="bends" className="block text-sm font-medium text-gray-700 mb-1">Number of Bends</label>
              <input
                type="number"
                id="bends"
                value={bends === 0 ? '' : bends}
                onChange={handleNumericInputChange(setBends)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="0"
              />
            </div>

            {/* Quantity */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                id="quantity"
                value={quantity === 0 ? '' : quantity}
                onChange={handleNumericInputChange(setQuantity)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="1"
              />
            </div>

            {/* Number of Men */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="numMen" className="block text-sm font-medium text-gray-700 mb-1">Number of Men</label>
              <input
                type="number"
                id="numMen"
                value={numMen === 0 ? '' : numMen}
                onChange={handleNumericInputChange(setNumMen)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Material & Dimensions Input Section */}
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-100">
          <h2 className="text-2xl font-bold text-indigo-600 mb-4 flex items-center gap-2">
            <Weight className="w-6 h-6" /> Material & Dimensions (for Weight)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Material Type */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="materialType" className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
              <select
                id="materialType"
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value as keyof typeof materialDensity)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                {Object.keys(materialDensity).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Part Length */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="partLength" className="block text-sm font-medium text-gray-700 mb-1">Length (mm)</label>
              <input
                type="number"
                id="partLength"
                value={partLengthMm === 0 ? '' : partLengthMm}
                onChange={handleNumericInputChange(setPartLengthMm)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="0"
              />
            </div>

            {/* Part Width */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="partWidth" className="block text-sm font-medium text-gray-700 mb-1">Width (mm)</label>
              <input
                type="number"
                id="partWidth"
                value={partWidthMm === 0 ? '' : partWidthMm}
                onChange={handleNumericInputChange(setPartWidthMm)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="0"
              />
            </div>

            {/* Part Thickness */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="partThickness" className="block text-sm font-medium text-gray-700 mb-1">Thickness (mm)</label>
              <input
                type="number"
                id="partThickness"
                value={partThicknessMm === 0 ? '' : partThicknessMm}
                onChange={handleNumericInputChange(setPartThicknessMm)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Tonnage Calculation Section */}
        <div className="bg-white p-5 rounded-lg shadow-md border border-gray-100">
          <h2 className="text-2xl font-bold text-indigo-600 mb-4 flex items-center gap-2">
            <Scale className="w-6 h-6" /> Tonnage Calculation
            <div className="relative group">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Simplified estimate. Always verify with actual press charts.
              </div>
            </div>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* V-Die Opening Dropdown */}
            <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200">
              <label htmlFor="vDieOpening" className="block text-sm font-medium text-gray-700 mb-1">V-Die Opening (mm)</label>
              <select
                id="vDieOpening"
                value={vDieOpeningMm}
                onChange={(e) => setVDieOpeningMm(parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                {availableVDies.length > 0 ? (
                  availableVDies.map(die => (
                    <option key={die} value={die}>{die} mm</option>
                  ))
                ) : (
                  <option value={0}>No V-Dies available. Add in settings.</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">Recommended V-Die: {getRecommendedVdie()}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Tonnage Per Meter */}
            <div className={`flex justify-between items-center bg-purple-50 p-3 rounded-md shadow-sm border border-purple-200 ${animateResults ? 'animate-pulse-once' : ''}`}>
              <span className="font-medium text-purple-800">Tonnage per Meter:</span>
              <span className="font-semibold text-purple-900">
                {tonnagePerMeter.toFixed(2)} tonnes/meter
              </span>
            </div>
            {/* Overall Tonnage */}
            <div className={`flex justify-between items-center bg-purple-100 p-3 rounded-md shadow-sm border border-purple-200 ${animateResults ? 'animate-pulse-once' : ''}`}>
              <span className="font-medium text-purple-800">Overall Tonnage:</span>
              <span className="font-semibold text-purple-900">
                {overallTonnage.toFixed(2)} tonnes
              </span>
            </div>
          </div>
        </div>


        {/* Results Section */}
        <div className="bg-indigo-50 p-6 rounded-lg shadow-xl border border-indigo-200 space-y-5">
          <h2 className="text-2xl md:text-3xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
            <HandCoins className="w-7 h-7" /> Costing & Weight Summary
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Folding Time */}
            <div className="flex justify-between items-center bg-indigo-100 p-3 rounded-md shadow-sm border border-indigo-200">
              <span className="font-medium text-indigo-800">Total Bending Time:</span>
              <span className="font-semibold text-indigo-900">
                {totalFoldingTimeMinutes.toFixed(2)} minutes
              </span>
            </div>

            {/* Total Bend Time + Setup Time */}
            <div className="flex justify-between items-center bg-indigo-200 p-4 rounded-md shadow-md border border-indigo-300 transition-all duration-300 transform hover:scale-105">
              <span className="font-bold text-indigo-800 text-lg">Total Job Time (Bend + Setup):</span>
              <span className="font-extrabold text-indigo-900 text-3xl">
                {totalBendAndSetupTimeMinutes.toFixed(2)} min
              </span>
              <button
                onClick={() => copyToClipboard(totalBendAndSetupTimeMinutes.toFixed(2) + ' minutes', 'time')}
                className="ml-2 p-2 bg-indigo-400 text-white rounded-md shadow-sm hover:bg-indigo-500 transition-all"
                aria-label="Copy Total Job Time"
              >
                {copyTimeButtonText === 'Copy' ? <Clipboard className="w-5 h-5" /> : <span>{copyTimeButtonText}</span>}
              </button>
            </div>

            {/* Single Part Weight - Highlighted */}
            <div className={`md:col-span-2 flex justify-between items-center bg-teal-100 p-4 rounded-md shadow-md border border-teal-300 transition-all duration-300 transform hover:scale-105 ${animateResults ? 'animate-pulse-once' : ''}`}>
              <span className="font-bold text-teal-800 text-xl">Single Part Weight:</span>
              <span className="font-extrabold text-teal-900 text-4xl">
                {partWeightKg.toFixed(2)} kg
              </span>
            </div>

            {/* Weight Safety Message */}
            <div className="md:col-span-2 bg-yellow-50 p-3 rounded-md shadow-sm border border-yellow-200 text-yellow-800 font-medium">
              <span className="flex items-center gap-2">
                <Weight className="w-5 h-5" /> Weight Handling:
              </span>
              <p className="mt-1 text-sm">{weightSafetyMessage}</p>
            </div>

            {/* Job Cost */}
            <div className="flex justify-between items-center bg-blue-100 p-3 rounded-md shadow-sm border border-blue-200">
              <span className="font-medium text-blue-800">Estimated Job Cost:</span>
              <span className="text-2xl font-bold text-blue-900">
                £{jobCost.toFixed(2)}
              </span>
            </div>

            {/* Cost Breakdown */}
            <div className="md:col-span-2 bg-blue-50 p-3 rounded-md shadow-sm border border-blue-200 text-blue-800 font-medium">
              <p className="flex justify-between">
                <span>Setup Cost:</span>
                <span className="font-semibold">£{setupCost.toFixed(2)}</span>
              </p>
              <p className="flex justify-between mt-1">
                <span>Bending Cost:</span>
                <span className="font-semibold">£{bendingCost.toFixed(2)}</span>
              </p>
            </div>

            {/* Final Price */}
            <div className="md:col-span-2 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-5 rounded-lg shadow-xl transition-all duration-300 transform hover:scale-105">
              <span className="text-xl font-medium">Final Quoted Price:</span>
              <span className="text-5xl font-extrabold">
                £{finalPrice.toFixed(2)}
              </span>
              <button
                onClick={() => copyToClipboard('£' + finalPrice.toFixed(2), 'price')}
                className="ml-2 p-2 bg-purple-400 text-white rounded-md shadow-sm hover:bg-purple-500 transition-all"
                aria-label="Copy Final Quoted Price"
              >
                {copyPriceButtonText === 'Copy' ? <Clipboard className="w-5 h-5" /> : <span>{copyPriceButtonText}</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          All times and costs are estimates and should be verified for accuracy.
        </p>

      </div>
    </div>
  );
}

export default BrakePressCalculator;

