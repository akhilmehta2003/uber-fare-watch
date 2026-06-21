/* ==========================================================================
   Uber Scheduled Fare Watch - Application Logic (Vanilla JS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  const state = {
    pickup: 'Home',
    destination: 'Airport',
    time: 'now',
    selectedTier: 'premier', // 'ubergo', 'premier', 'uberxl'
    baseFare: 650,
    targetFare: 500,
    
    // Tracking simulation variables
    watchActive: false,
    currentPrice: 650,
    lowestToday: 650,
    highestToday: 650,
    trend: 'stable', // 'rising', 'dropping', 'stable'
    priceHistory: [], // stores up to 10 pricing entries
    
    // Command overrides from PM control console
    forceDrop: false,
    forceSurge: false,
    
    // Ticker handles
    tickerIntervalId: null,
    clockIntervalId: null
  };

  // Slider Configurations based on Ride Tiers
  const tierConfig = {
    ubergo: {
      base: 550,
      minPrice: 250,
      maxPrice: 600,
      defaultTarget: 420
    },
    premier: {
      base: 650,
      minPrice: 300,
      maxPrice: 700,
      defaultTarget: 500
    },
    uberxl: {
      base: 850,
      minPrice: 450,
      maxPrice: 900,
      defaultTarget: 650
    }
  };

  // ==========================================================================
  // DOM ELEMENT REFERENCES
  // ==========================================================================
  
  // Screens & Navigation
  const screens = {
    setup: document.getElementById('screen-setup'),
    loading: document.getElementById('screen-loading'),
    dashboard: document.getElementById('screen-dashboard'),
    confirmed: document.getElementById('screen-confirmed')
  };
  
  // Inputs
  const pickupInput = document.getElementById('pickup-input');
  const destInput = document.getElementById('dest-input');
  const timeSelector = document.getElementById('time-selector');
  const rideItems = document.querySelectorAll('.ride-item');
  const targetSlider = document.getElementById('target-slider');
  
  // Dyn Value displays (Setup Screen)
  const targetValBadge = document.getElementById('target-value-badge');
  const compCurrent = document.getElementById('comp-current');
  const compTarget = document.getElementById('comp-target');
  const compSavings = document.getElementById('comp-savings');
  const targetFareSummaryVal = document.getElementById('target-fare-summary-val');
  
  // Dynamic displays (Dashboard Screen)
  const dbTargetBadge = document.getElementById('dashboard-target-badge');
  const lblPickup = document.getElementById('route-lbl-pickup');
  const lblDest = document.getElementById('route-lbl-dest');
  const dbTierLbl = document.getElementById('dashboard-tier-lbl');
  const dbTimeLbl = document.getElementById('dashboard-time-lbl');
  const livePriceVal = document.getElementById('live-price-val');
  const trendIndicatorBadge = document.getElementById('trend-indicator-badge');
  const valLowestToday = document.getElementById('val-lowest-today');
  const valHighestToday = document.getElementById('val-highest-today');
  const valEstimatedTrend = document.getElementById('val-estimated-trend');
  
  // Buttons
  const btnStartWatch = document.getElementById('btn-start-watch');
  const btnCancelWatch = document.getElementById('btn-cancel-watch');
  const btnConfirmClose = document.getElementById('btn-confirm-close');
  
  // Overlays / Overlays Content
  const pushNotification = document.getElementById('push-notification');
  const pushPrice = document.getElementById('push-price');
  const fareAlertOverlay = document.getElementById('fare-alert-overlay');
  const alertPickup = document.getElementById('alert-pickup');
  const alertDest = document.getElementById('alert-dest');
  const alertPriceCurr = document.getElementById('alert-price-curr');
  const alertPriceTarget = document.getElementById('alert-price-target');
  const btnAlertBook = document.getElementById('btn-alert-book');
  const btnAlertKeep = document.getElementById('btn-alert-keep');
  const successTickOverlay = document.getElementById('success-tick-overlay');
  
  // Booking confirmation displays
  const confirmRouteTxt = document.getElementById('confirm-route-txt');
  const confirmServiceTxt = document.getElementById('confirm-service-txt');
  const confirmPriceTxt = document.getElementById('confirm-price-txt');

  // Case Study & Console
  const btnForceDrop = document.getElementById('btn-force-drop');
  const btnForceSurge = document.getElementById('btn-force-surge');
  const btnResetDemo = document.getElementById('btn-reset-demo');
  const btnPlaySound = document.getElementById('btn-play-sound');
  const btnPresentationMode = document.getElementById('btn-presentation-mode');
  const presenterExitTip = document.getElementById('presenter-exit-tip');
  const toastBox = document.getElementById('toast-notification');
  const toastMessage = document.getElementById('toast-message');

  // Chart SVGs elements
  const svgChart = document.getElementById('live-fare-svg-chart');
  const svgTargetLine = document.getElementById('svg-target-line');
  const svgTargetText = document.getElementById('svg-target-text');
  const chartCurvePath = document.getElementById('chart-curve-path');
  const chartAreaPath = document.getElementById('chart-area-path');
  const chartDotsGroup = document.getElementById('chart-dots-group');
  const chartCurrentDot = document.getElementById('chart-current-dot');


  // ==========================================================================
  // VIEW TRANSITIONS & CLOCK TICKER
  // ==========================================================================
  
  function switchScreen(targetScreenId) {
    Object.keys(screens).forEach(key => {
      if (screens[key].id === targetScreenId) {
        screens[key].classList.add('active');
      } else {
        screens[key].classList.remove('active');
      }
    });
  }

  // Update Clock in Phone Status Bar
  function updateSimulatedClock() {
    const clockEl = document.getElementById('sim-time');
    if (!clockEl) return;
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    clockEl.textContent = `${hours}:${minutes}`;
  }
  
  state.clockIntervalId = setInterval(updateSimulatedClock, 30000);
  updateSimulatedClock(); // Init immediately

  // Trigger brief Toast alert inside device/panel
  function showToast(message) {
    toastMessage.textContent = message;
    toastBox.classList.remove('hidden');
    
    // Animate opacity/slide
    toastBox.style.opacity = '1';
    toastBox.style.transform = 'translateY(0)';
    
    setTimeout(() => {
      toastBox.style.opacity = '0';
      toastBox.style.transform = 'translateY(10px)';
      setTimeout(() => {
        toastBox.classList.add('hidden');
      }, 300);
    }, 2500);
  }

  // Synthesize Bell Notification sound (Web Audio API)
  function playNotificationSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // High ding
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      
      // Secondary chime note, slightly offset
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start(audioCtx.currentTime + 0.12);
      
      osc1.stop(audioCtx.currentTime + 0.6);
      osc2.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.warn("Web Audio API is disabled or restricted by browser settings: ", e);
    }
  }


  // ==========================================================================
  // INPUT STATE LISTENERS
  // ==========================================================================
  
  // Locations
  pickupInput.addEventListener('input', (e) => {
    state.pickup = e.target.value || 'Home';
    lblPickup.textContent = state.pickup;
  });
  
  destInput.addEventListener('input', (e) => {
    state.destination = e.target.value || 'Airport';
    lblDest.textContent = state.destination;
  });

  // Time selector
  timeSelector.addEventListener('change', (e) => {
    state.time = e.target.value;
    // Map code value to presentation text
    const displayMap = {
      'now': 'Leave Now',
      '1hr': 'Leave in 1 hour',
      '2hr': 'Leave in 2 hours',
      'evening': 'Leave this evening'
    };
    dbTimeLbl.textContent = displayMap[state.time] || 'Leave Now';
  });

  // Ride Option Selector
  rideItems.forEach(item => {
    item.addEventListener('click', () => {
      rideItems.forEach(ri => ri.classList.remove('selected'));
      item.classList.add('selected');
      
      const tier = item.getAttribute('data-tier');
      state.selectedTier = tier;
      state.baseFare = tierConfig[tier].base;
      
      // Update UI Tiers descriptions
      const config = tierConfig[tier];
      
      // Re-configure target slider limits
      targetSlider.min = config.minPrice;
      targetSlider.max = config.maxPrice;
      
      // Check if target fare is out of bounds for the new range, reset if so
      if (state.targetFare < config.minPrice || state.targetFare > config.maxPrice) {
        state.targetFare = config.defaultTarget;
        targetSlider.value = config.defaultTarget;
      }
      
      dbTierLbl.textContent = item.querySelector('.ride-name').textContent;
      
      // Redo calculations
      updateSliderCalculations();
    });
  });

  // Target Slider Dragging
  targetSlider.addEventListener('input', (e) => {
    state.targetFare = parseInt(e.target.value, 10);
    updateSliderCalculations();
  });

  function updateSliderCalculations() {
    // 1. Badge & Comparison Displays
    targetValBadge.textContent = state.targetFare;
    compCurrent.textContent = state.baseFare;
    compTarget.textContent = state.targetFare;
    targetFareSummaryVal.textContent = state.targetFare;
    
    // 2. Savings Calculation
    const savings = Math.max(0, state.baseFare - state.targetFare);
    compSavings.textContent = savings;
    
    // Update target badge on dashboard just in case
    dbTargetBadge.textContent = `Target: ₹${state.targetFare}`;
    
    // Highlight savings styling based on size
    const savingsBadge = document.querySelector('.highlight-savings');
    if (savings > 0) {
      savingsBadge.style.display = 'inline-block';
    } else {
      savingsBadge.style.display = 'none';
    }
  }

  // Run initial calculations on load
  updateSliderCalculations();


  // ==========================================================================
  // CORE SIMULATION LOGIC & MATH
  // ==========================================================================
  
  // Set up price history simulation when starting monitoring
  function initializePriceHistory() {
    state.currentPrice = state.baseFare;
    state.lowestToday = state.baseFare;
    state.highestToday = state.baseFare;
    state.trend = 'stable';
    
    // Populate historic data points with realistic fluctuations
    const pointsCount = 6;
    const history = [];
    let referencePrice = state.baseFare;
    
    for (let i = 0; i < pointsCount; i++) {
      // Simulate historical prices trending slightly higher than target
      const variance = (Math.random() - 0.4) * 40; // slightly upward bias
      const histPrice = Math.round(referencePrice + variance);
      history.push(histPrice);
    }
    
    // Add current price as the last point
    history.push(state.baseFare);
    state.priceHistory = history;
    
    // Redetermine highs and lows based on history
    state.lowestToday = Math.min(...history);
    state.highestToday = Math.max(...history);
  }

  // Fluctuates fare price every tick (called every 3.5s)
  function simulateFareTick() {
    if (!state.watchActive) return;

    let nextPrice = state.currentPrice;
    
    if (state.forceDrop) {
      // PM Control Center override: force price drop below target
      const targetDelta = Math.round(15 + Math.random() * 15); // ₹15-30 below target
      nextPrice = state.targetFare - targetDelta;
      state.forceDrop = false;
      showToast("Simulation: Forced Price Drop Triggered");
    } else if (state.forceSurge) {
      // PM Control Center override: force surge pricing
      const surgeMultiplier = 1.1 + (Math.random() * 0.1); // 10% - 20% surge
      nextPrice = Math.round(state.baseFare * surgeMultiplier);
      state.forceSurge = false;
      showToast("Simulation: Forced Demand Surge Triggered");
    } else {
      // Natural price fluctuation: Random walk with regression to base
      const config = tierConfig[state.selectedTier];
      const pullToBase = (state.baseFare - state.currentPrice) * 0.15; // regresses back slowly
      const randomFluctuation = (Math.random() - 0.5) * 35; // standard fluctuation variance
      
      nextPrice = Math.round(state.currentPrice + pullToBase + randomFluctuation);
      
      // Clamp price within the current tier's logical limits
      nextPrice = Math.max(config.minPrice, Math.min(config.maxPrice, nextPrice));
    }
    
    // Log previous price for trend calculation
    const prevPrice = state.currentPrice;
    state.currentPrice = nextPrice;
    
    // Update tracking records
    state.priceHistory.push(nextPrice);
    if (state.priceHistory.length > 10) {
      state.priceHistory.shift(); // retain last 10 points
    }
    
    // Recalculate Min & Max
    state.lowestToday = Math.min(state.lowestToday, nextPrice);
    state.highestToday = Math.max(state.highestToday, nextPrice);
    
    // Determine Trend & update badge classes
    let trendBadgeText = 'Stable';
    let trendBadgeClass = 'stable';
    
    if (nextPrice < prevPrice) {
      state.trend = 'dropping';
      trendBadgeText = '📉 Fare Dropping';
      trendBadgeClass = 'dropping';
    } else if (nextPrice > prevPrice) {
      state.trend = 'rising';
      trendBadgeText = '📈 High Demand';
      trendBadgeClass = 'high-demand';
    } else {
      state.trend = 'stable';
      trendBadgeText = '⚡ Stable Price';
      trendBadgeClass = 'stable';
    }
    
    // UI Update Dashboard Values
    livePriceVal.textContent = nextPrice;
    valLowestToday.textContent = `₹${state.lowestToday}`;
    valHighestToday.textContent = `₹${state.highestToday}`;
    
    const displayTrends = {
      'dropping': 'Downward',
      'rising': 'Upward',
      'stable': 'Stable'
    };
    valEstimatedTrend.textContent = displayTrends[state.trend];
    
    // Trend indicator updates
    trendIndicatorBadge.textContent = trendBadgeText;
    trendIndicatorBadge.className = `badge-trend ${trendBadgeClass}`;

    // Update SVG Chart Rendering
    renderSvgChart();
    
    // Evaluate if price is below target
    if (nextPrice <= state.targetFare) {
      triggerFareAlert(nextPrice);
    }
  }


  // ==========================================================================
  // DYNAMIC SVG CHART RENDERER
  // ==========================================================================
  
  function renderSvgChart() {
    const history = state.priceHistory;
    if (history.length === 0) return;
    
    const svgWidth = 400;
    const svgHeight = 180;
    const paddingLeft = 20;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 20;
    
    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;
    
    // Determine bounds for scale mapping based on current tier limits
    const config = tierConfig[state.selectedTier];
    const minVal = config.minPrice - 20;
    const maxVal = config.maxPrice + 20;
    const valRange = maxVal - minVal;
    
    // Helper to map (index, price) to (X, Y) coordinates
    const getCoords = (index, val) => {
      const x = paddingLeft + (index / (history.length - 1)) * chartWidth;
      // In SVG coordinates, Y increases downwards, so we subtract mapped height from bottom
      const y = (svgHeight - paddingBottom) - ((val - minVal) / valRange) * chartHeight;
      return { x, y };
    };

    // 1. Draw/Position the Target Fare Dashed Line
    const targetCoords = getCoords(0, state.targetFare);
    svgTargetLine.setAttribute('y1', targetCoords.y);
    svgTargetLine.setAttribute('y2', targetCoords.y);
    svgTargetText.setAttribute('y', targetCoords.y - 6);
    svgTargetText.textContent = `Target: ₹${state.targetFare}`;

    // 2. Generate line coordinates
    const points = history.map((val, idx) => getCoords(idx, val));
    
    // Build path coordinates string
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    
    chartCurvePath.setAttribute('d', pathD);
    
    // Fill region below line path
    const fillD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingBottom} L ${points[0].x} ${svgHeight - paddingBottom} Z`;
    chartAreaPath.setAttribute('d', fillD);

    // 3. Render Nodes/circles and attach tooltips/hover attributes
    chartDotsGroup.innerHTML = ''; // clear previous elements
    
    points.forEach((pt, idx) => {
      const val = history[idx];
      
      // Node circle outline
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', '4');
      circle.setAttribute('class', 'chart-node-circle');
      
      // Simple tooltip overlay simulation (adds titles for DOM tooltips)
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `Update #${idx + 1}: ₹${val}`;
      circle.appendChild(title);
      
      chartDotsGroup.appendChild(circle);
    });

    // 4. Highlight the Active/Current Price Indicator Dot
    const activePt = points[points.length - 1];
    chartCurrentDot.setAttribute('cx', activePt.x);
    chartCurrentDot.setAttribute('cy', activePt.y);
    chartCurrentDot.classList.remove('hidden');
  }


  // ==========================================================================
  // ACTION EVENTS & HANDLERS
  // ==========================================================================
  
  // START FARE WATCH
  btnStartWatch.addEventListener('click', () => {
    switchScreen('screen-loading');
    
    // Step 1: Simulate network loading animation
    setTimeout(() => {
      
      // Step 2: Show the green tick success screen overlay
      successTickOverlay.classList.remove('hidden');
      successTickOverlay.classList.add('active');
      
      // Initialize pricing logs & simulation states
      initializePriceHistory();
      state.watchActive = true;
      
      // Enable simulation buttons on the showcase panel
      btnForceDrop.disabled = false;
      btnForceSurge.disabled = false;
      
      // Synchronize text tags in the live screen
      lblPickup.textContent = state.pickup;
      lblDest.textContent = state.destination;
      
      // Dynamic rendering of current and starting details
      livePriceVal.textContent = state.currentPrice;
      valLowestToday.textContent = `₹${state.lowestToday}`;
      valHighestToday.textContent = `₹${state.highestToday}`;
      dbTargetBadge.textContent = `Target: ₹${state.targetFare}`;
      
      renderSvgChart();
      
      // Set interval loop to update mock fares
      state.tickerIntervalId = setInterval(simulateFareTick, 3500);

      // Step 3: Transition fully into Live Dashboard screen
      setTimeout(() => {
        switchScreen('screen-dashboard');
        // clean overlay for next loops
        successTickOverlay.classList.remove('active');
        successTickOverlay.classList.add('hidden');
        
        showToast("Fare Watch Active!");
      }, 1500);

    }, 1200);
  });

  // CANCEL FARE WATCH
  btnCancelWatch.addEventListener('click', () => {
    cancelActiveTracking();
    switchScreen('screen-setup');
    showToast("Fare Watch Cancelled");
  });

  function cancelActiveTracking() {
    state.watchActive = false;
    if (state.tickerIntervalId) {
      clearInterval(state.tickerIntervalId);
      state.tickerIntervalId = null;
    }
    
    // Disable simulation panel controls
    btnForceDrop.disabled = true;
    btnForceSurge.disabled = true;
  }

  // ==========================================================================
  // NOTIFICATION & FARE ALERTS
  // ==========================================================================
  
  function triggerFareAlert(droppedPrice) {
    // Pause fluctuation ticker temporarily so the user can look at the notification
    cancelActiveTracking();
    
    // Trigger synthesized audio alarm
    playNotificationSound();
    
    // 1. Show Push Notification slide-down banner
    pushPrice.textContent = droppedPrice;
    pushNotification.classList.remove('hidden');
    pushNotification.classList.add('active');
    
    // 2. Open high-impact In-app dialog modal (Delayed slightly for realism)
    setTimeout(() => {
      // Sync names/prices
      alertPickup.textContent = state.pickup;
      alertDest.textContent = state.destination;
      alertPriceCurr.textContent = `₹${droppedPrice}`;
      alertPriceTarget.textContent = `₹${state.targetFare}`;
      
      fareAlertOverlay.classList.remove('hidden');
      fareAlertOverlay.classList.add('active');
    }, 1000);
  }

  // CLOSE NOTIFICATION BANNER (ON PUSH CLICK OR SLIDE OUT)
  pushNotification.addEventListener('click', () => {
    pushNotification.classList.remove('active');
    setTimeout(() => {
      pushNotification.classList.add('hidden');
    }, 400);
  });

  // NOTIFICATION ALERTS OVERLAY BUTTONS
  
  // "Book Ride" CTA
  btnAlertBook.addEventListener('click', () => {
    // Dismiss overlays
    pushNotification.classList.remove('active');
    fareAlertOverlay.classList.remove('active');
    
    // Prep booking confirmation page fields
    confirmRouteTxt.innerHTML = `${state.pickup} &rarr; ${state.destination}`;
    confirmPriceTxt.textContent = `₹${state.currentPrice}`;
    
    const displayMap = {
      'ubergo': 'UberGo',
      'premier': 'Uber Premier',
      'uberxl': 'Uber XL'
    };
    confirmServiceTxt.textContent = displayMap[state.selectedTier] || 'Uber Premier';

    setTimeout(() => {
      pushNotification.classList.add('hidden');
      fareAlertOverlay.classList.add('hidden');
      switchScreen('screen-confirmed');
    }, 300);
  });

  // "Keep Watching" CTA
  btnAlertKeep.addEventListener('click', () => {
    // Dismiss push banner and modal dialog
    pushNotification.classList.remove('active');
    fareAlertOverlay.classList.remove('active');
    
    setTimeout(() => {
      pushNotification.classList.add('hidden');
      fareAlertOverlay.classList.add('hidden');
    }, 400);
    
    // Reactivate and resume the Live tracking simulation loop
    state.watchActive = true;
    
    // Readjust stats to ensure target isn't instantly re-triggered
    // Push the current price up slightly so it can fluctuate again
    state.currentPrice = state.targetFare + Math.round(10 + Math.random() * 20);
    state.priceHistory[state.priceHistory.length - 1] = state.currentPrice;
    
    btnForceDrop.disabled = false;
    btnForceSurge.disabled = false;
    state.tickerIntervalId = setInterval(simulateFareTick, 3500);
    
    showToast("Fare Watch Resumed");
  });

  // EXIT BOOKING AND RESET
  btnConfirmClose.addEventListener('click', () => {
    resetDemoToHome();
  });

  function resetDemoToHome() {
    cancelActiveTracking();
    
    // Dismiss active overlays
    pushNotification.classList.remove('active');
    pushNotification.classList.add('hidden');
    fareAlertOverlay.classList.remove('active');
    fareAlertOverlay.classList.add('hidden');
    
    // Reset state values
    state.pickup = 'Home';
    state.destination = 'Airport';
    state.time = 'now';
    state.selectedTier = 'premier';
    state.baseFare = 650;
    state.targetFare = 500;
    state.priceHistory = [];
    
    // Reset inputs
    pickupInput.value = 'Home';
    destInput.value = 'Airport';
    timeSelector.value = 'now';
    targetSlider.value = 500;
    
    rideItems.forEach(ri => ri.classList.remove('selected'));
    document.querySelector('.ride-item[data-tier="premier"]').classList.add('selected');
    
    updateSliderCalculations();
    switchScreen('screen-setup');
    
    showToast("Demo State Reset");
  }


  // ==========================================================================
  // PM DEMO CONTROL CONSOLE BINDINGS
  // ==========================================================================
  
  // Force price drop
  btnForceDrop.addEventListener('click', () => {
    if (state.watchActive) {
      state.forceDrop = true;
      showToast("Queued: Price drop below target");
      // speed up tick for instant feedback
      if (state.tickerIntervalId) {
        clearInterval(state.tickerIntervalId);
        simulateFareTick();
        state.tickerIntervalId = setInterval(simulateFareTick, 3500);
      }
    }
  });

  // Force surge demand
  btnForceSurge.addEventListener('click', () => {
    if (state.watchActive) {
      state.forceSurge = true;
      showToast("Queued: Surge pricing hike");
      // speed up tick for instant feedback
      if (state.tickerIntervalId) {
        clearInterval(state.tickerIntervalId);
        simulateFareTick();
        state.tickerIntervalId = setInterval(simulateFareTick, 3500);
      }
    }
  });

  // Reset Demo button
  btnResetDemo.addEventListener('click', () => {
    resetDemoToHome();
  });

  // Test Notification sound
  btnPlaySound.addEventListener('click', () => {
    playNotificationSound();
    showToast("Playing alert sound chime");
  });

  // Toggle Presentation view (Fullscreen simulator)
  btnPresentationMode.addEventListener('click', () => {
    document.body.classList.toggle('presentation-active');
    
    if (document.body.classList.contains('presentation-active')) {
      presenterExitTip.classList.remove('hidden');
      btnPresentationMode.querySelector('span').textContent = "Exit Presenter Mode";
      showToast("Presenter Mode: Case study hidden");
    } else {
      presenterExitTip.classList.add('hidden');
      btnPresentationMode.querySelector('span').textContent = "Presenter Mode";
      showToast("Presenter Mode Closed");
    }
  });

});
