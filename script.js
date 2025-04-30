document.addEventListener('DOMContentLoaded', function() {
    // jsPDF initialisieren
    const { jsPDF } = window.jspdf;
    // Konstanten und Konfiguration
    const MAX_LOADS = 10;
    const MAX_RIGGING_POINTS = 4;
    const MIN_RIGGING_POINTS = 2;
    const TRUSS_WEIGHT_KG_PER_METER = 8.5; // FD32 Eigengewicht pro Meter

    // DOM-Elemente
    const trussLengthInput = document.getElementById('trussLength');
    const trussWeightInput = document.getElementById('trussWeight');
    const riggingPointsContainer = document.getElementById('riggingPointsContainer');
    const loadsContainer = document.getElementById('loadsContainer');
    const riggingPointsList = document.getElementById('riggingPointsList');
    const loadsList = document.getElementById('loadsList');
    const addRiggingPointBtn = document.getElementById('addRiggingPoint');
    const addLoadBtn = document.getElementById('addLoad');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const trussBeam = document.querySelector('.truss-beam');
    const useLiftSystemCheckbox = document.getElementById('useLiftSystem');
    const liftSystemOptions = document.getElementById('liftSystemOptions');
    const liftHeightInput = document.getElementById('liftHeight');
    const liftCountInput = document.getElementById('liftCount');
    const liftCapacityInput = document.getElementById('liftCapacity');
    const liftWeightInput = document.getElementById('liftWeight');
    const outriggerLengthInput = document.getElementById('outriggerLength');

    // Zustandsvariablen
    let trussLength = parseFloat(trussLengthInput.value);
    let riggingPoints = [
        { position: 0 },
        { position: trussLength }
    ];
    let loads = [];
    let useLiftSystem = false;
    let liftHeight = parseFloat(liftHeightInput.value);
    let liftCount = parseInt(liftCountInput.value);
    let liftCapacity = parseFloat(liftCapacityInput.value);
    let liftWeight = 75; // Gewicht eines Lifts in kg
    let outriggerLength = 1.5; // Länge der Ausleger in m

    // Event-Listener
    trussLengthInput.addEventListener('change', updateTrussLength);
    addRiggingPointBtn.addEventListener('click', addRiggingPoint);
    addLoadBtn.addEventListener('click', addLoad);
    calculateBtn.addEventListener('click', calculateForces);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
    useLiftSystemCheckbox.addEventListener('change', toggleLiftSystem);
    liftHeightInput.addEventListener('change', updateLiftHeight);
    liftCountInput.addEventListener('change', updateLiftCount);
    liftCapacityInput.addEventListener('change', updateLiftCapacity);
    liftWeightInput.addEventListener('change', updateLiftWeight);
    outriggerLengthInput.addEventListener('change', updateOutriggerLength);
    
    // Drag-and-Drop für die Traverse
    trussBeam.addEventListener('dragover', handleDragOver);
    trussBeam.addEventListener('drop', handleDrop);
    
    // Maus-Events für alternative Drag-Funktionalität
    document.addEventListener('mousemove', function(e) {
        if (isDragging && draggedItemType) {
            e.preventDefault();
            
            // Berechne die neue Position
            const rect = trussBeam.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const percentage = offsetX / rect.width;
            const newPosition = percentage * trussLength;
            const clampedPosition = Math.max(0, Math.min(trussLength, newPosition));
            
            if (draggedItemType === 'load') {
                // Aktualisiere die Position der Last
                updateLoadPosition(draggedItemIndex, clampedPosition);
                
                // Aktualisiere auch die Eingabefelder
                const loadPositionInputs = document.querySelectorAll('.load-position');
                if (loadPositionInputs[draggedItemIndex]) {
                    loadPositionInputs[draggedItemIndex].value = clampedPosition.toFixed(1);
                }
                
                // Aktualisiere die visuelle Position sofort
                const loadElements = document.querySelectorAll('.load');
                if (loadElements[draggedItemIndex]) {
                    loadElements[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                }
                
                // Aktualisiere auch die Positionsmarkierung
                const loadMarkers = document.querySelectorAll('.position-marker.load-marker');
                if (loadMarkers[draggedItemIndex]) {
                    loadMarkers[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                    loadMarkers[draggedItemIndex].textContent = `${clampedPosition.toFixed(1)} m`;
                }
            } else if (draggedItemType === 'rigging') {
                // Für Endpunkte spezielle Regeln
                const isFirstPoint = draggedItemIndex === 0;
                const isLastPoint = draggedItemIndex === riggingPoints.length - 1;
                
                let finalPosition = clampedPosition;
                
                if (isFirstPoint) {
                    // Erster Punkt kann nur bis zum nächsten Punkt verschoben werden
                    const nextPoint = riggingPoints[1].position;
                    finalPosition = Math.min(nextPoint - 0.1, clampedPosition);
                } else if (isLastPoint) {
                    // Letzter Punkt kann nur bis zum vorherigen Punkt verschoben werden
                    const prevPoint = riggingPoints[riggingPoints.length - 2].position;
                    finalPosition = Math.max(prevPoint + 0.1, clampedPosition);
                }
                
                // Aktualisiere die Position des Aufhängepunkts
                updateRiggingPointPosition(draggedItemIndex, finalPosition);
                
                // Aktualisiere auch die Eingabefelder
                const riggingInputs = document.querySelectorAll('.rigging-position');
                riggingInputs[draggedItemIndex].value = finalPosition.toFixed(1);
                
                // Aktualisiere die visuelle Position sofort
                const riggingElements = document.querySelectorAll('.rigging-point');
                if (riggingElements[draggedItemIndex]) {
                    riggingElements[draggedItemIndex].style.left = `${(finalPosition / trussLength) * 100}%`;
                }
                
                // Aktualisiere auch die Positionsmarkierung
                const posMarkers = document.querySelectorAll('.position-marker:not(.load-marker):not(.lift-marker)');
                if (posMarkers[draggedItemIndex]) {
                    posMarkers[draggedItemIndex].style.left = `${(finalPosition / trussLength) * 100}%`;
                    posMarkers[draggedItemIndex].textContent = `${finalPosition.toFixed(1)} m`;
                }
            } else if (draggedItemType === 'lift') {
                // Aktualisiere die Position des Lifts
                updateLiftPosition(draggedItemIndex, clampedPosition);
                
                // Aktualisiere die visuelle Position sofort
                const liftElements = document.querySelectorAll('.lift');
                if (liftElements[draggedItemIndex]) {
                    liftElements[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                }
                
                // Aktualisiere auch die Positionsmarkierung
                const liftMarkers = document.querySelectorAll('.position-marker.lift-marker');
                if (liftMarkers[draggedItemIndex]) {
                    liftMarkers[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                    liftMarkers[draggedItemIndex].textContent = `${clampedPosition.toFixed(1)} m`;
                }
            }
        }
    });
    
    document.addEventListener('mouseup', function(e) {
        if (isDragging) {
            // Wenn wir gerade ziehen, behandle das Loslassen wie ein Drop
            handleDrop(e);
        }
    });
    
    // Touch-Events für mobile Geräte
    document.addEventListener('touchmove', function(e) {
        if (isDragging && draggedItemType) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = trussBeam.getBoundingClientRect();
            const offsetX = touch.clientX - rect.left;
            const percentage = offsetX / rect.width;
            const newPosition = percentage * trussLength;
            const clampedPosition = Math.max(0, Math.min(trussLength, newPosition));
            
            if (draggedItemType === 'load') {
                // Aktualisiere die Position der Last
                updateLoadPosition(draggedItemIndex, clampedPosition);
                
                // Aktualisiere auch die Eingabefelder
                const loadPositionInputs = document.querySelectorAll('.load-position');
                if (loadPositionInputs[draggedItemIndex]) {
                    loadPositionInputs[draggedItemIndex].value = clampedPosition.toFixed(1);
                }
                
                // Aktualisiere die visuelle Position sofort
                const loadElements = document.querySelectorAll('.load');
                if (loadElements[draggedItemIndex]) {
                    loadElements[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                }
                
                // Aktualisiere auch die Positionsmarkierung
                const loadMarkers = document.querySelectorAll('.position-marker.load-marker');
                if (loadMarkers[draggedItemIndex]) {
                    loadMarkers[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                    loadMarkers[draggedItemIndex].textContent = `${clampedPosition.toFixed(1)} m`;
                }
            } else if (draggedItemType === 'rigging') {
                // Aktualisiere die Position des Aufhängepunkts
                updateRiggingPointPosition(draggedItemIndex, clampedPosition);
                
                // Aktualisiere auch die Eingabefelder
                const riggingInputs = document.querySelectorAll('.rigging-position');
                riggingInputs[draggedItemIndex].value = clampedPosition.toFixed(1);
                
                // Aktualisiere die visuelle Position sofort
                const riggingElements = document.querySelectorAll('.rigging-point');
                if (riggingElements[draggedItemIndex]) {
                    riggingElements[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                }
                
                // Aktualisiere auch die Positionsmarkierung
                const posMarkers = document.querySelectorAll('.position-marker:not(.load-marker):not(.lift-marker)');
                if (posMarkers[draggedItemIndex]) {
                    posMarkers[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                    posMarkers[draggedItemIndex].textContent = `${clampedPosition.toFixed(1)} m`;
                }
            } else if (draggedItemType === 'lift') {
                // Aktualisiere die Position des Lifts
                updateLiftPosition(draggedItemIndex, clampedPosition);
                
                // Aktualisiere die visuelle Position sofort
                const liftElements = document.querySelectorAll('.lift');
                if (liftElements[draggedItemIndex]) {
                    liftElements[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                }
                
                // Aktualisiere auch die Positionsmarkierung
                const liftMarkers = document.querySelectorAll('.position-marker.lift-marker');
                if (liftMarkers[draggedItemIndex]) {
                    liftMarkers[draggedItemIndex].style.left = `${(clampedPosition / trussLength) * 100}%`;
                    liftMarkers[draggedItemIndex].textContent = `${clampedPosition.toFixed(1)} m`;
                }
            }
        }
    }, { passive: false });
    
    document.addEventListener('touchend', function(e) {
        if (isDragging) {
            // Wenn wir gerade ziehen, behandle das Loslassen wie ein Drop
            handleDrop(e);
        }
    });

    // Initialisierung
    initializeRiggingPointsUI();
    updateVisualization();
    
    // Funktionen für Traversenlifte
    function toggleLiftSystem() {
        useLiftSystem = useLiftSystemCheckbox.checked;
        if (useLiftSystem) {
            liftSystemOptions.classList.add('active');
            // Verstecke die Rigging-Panel wenn Liftsystem aktiviert ist
            document.querySelector('.rigging-panel').style.display = 'none';
        } else {
            liftSystemOptions.classList.remove('active');
            // Zeige die Rigging-Panel wenn Liftsystem deaktiviert ist
            document.querySelector('.rigging-panel').style.display = 'block';
        }
        updateVisualization();
    }
    
    function updateLiftHeight() {
        liftHeight = parseFloat(liftHeightInput.value);
        if (liftHeight < 0) {
            liftHeight = 0;
            liftHeightInput.value = 0;
        }
        updateVisualization();
    }
    
    function updateLiftCount() {
        liftCount = parseInt(liftCountInput.value);
        if (liftCount < 2) {
            liftCount = 2;
            liftCountInput.value = 2;
        } else if (liftCount > 4) {
            liftCount = 4;
            liftCountInput.value = 4;
        }
        // Zurücksetzen der Lift-Positionen bei Änderung der Anzahl
        liftPositions = [];
        updateVisualization();
    }
    
    function updateLiftCapacity() {
        liftCapacity = parseFloat(liftCapacityInput.value);
        if (liftCapacity < 0) {
            liftCapacity = 0;
            liftCapacityInput.value = 0;
        }
        updateVisualization();
    }
    
    function updateLiftWeight() {
        liftWeight = parseFloat(liftWeightInput.value);
        if (liftWeight < 0) {
            liftWeight = 0;
            liftWeightInput.value = 0;
        }
        updateVisualization();
    }
    
    function updateOutriggerLength() {
        outriggerLength = parseFloat(outriggerLengthInput.value);
        if (outriggerLength < 0.5) {
            outriggerLength = 0.5;
            outriggerLengthInput.value = 0.5;
        } else if (outriggerLength > 3) {
            outriggerLength = 3;
            outriggerLengthInput.value = 3;
        }
        updateVisualization();
    }
    
    // Event-Listener für das Ende des Ziehens
    document.addEventListener('dragend', function() {
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(el => el.classList.remove('dragging'));
        draggedItemType = null;
        draggedItemIndex = null;
    });

    // Funktionen
    function updateTrussLength() {
        const newLength = parseFloat(trussLengthInput.value);
        if (newLength <= 0) {
            alert('Die Traversenlänge muss größer als 0 sein.');
            trussLengthInput.value = trussLength;
            return;
        }
        
        trussLength = newLength;
        
        // Aktualisiere den letzten Aufhängepunkt
        const lastRiggingPointIndex = riggingPoints.length - 1;
        riggingPoints[lastRiggingPointIndex].position = trussLength;
        
        // Aktualisiere die UI
        const riggingInputs = document.querySelectorAll('.rigging-position');
        riggingInputs[lastRiggingPointIndex].value = trussLength;
        
        // Überprüfe und korrigiere Positionen von Lasten und Aufhängepunkten
        validatePositions();
        updateVisualization();
    }

    function validatePositions() {
        // Stelle sicher, dass keine Last oder Aufhängepunkt außerhalb der Traverse liegt
        loads.forEach(load => {
            if (load.position > trussLength) {
                load.position = trussLength;
            }
        });
        
        riggingPoints.forEach((point, index) => {
            if (index > 0 && index < riggingPoints.length - 1 && point.position > trussLength) {
                point.position = trussLength;
            }
        });
        
        updateLoadsList();
        initializeRiggingPointsUI();
    }

    function initializeRiggingPointsUI() {
        // Leere die Liste
        riggingPointsList.innerHTML = '';
        
        // Füge die Aufhängepunkte hinzu
        riggingPoints.forEach((point, index) => {
            const isEndPoint = index === 0 || index === riggingPoints.length - 1;
            const item = document.createElement('div');
            item.className = 'rigging-point-item';
            
            item.innerHTML = `
                <div class="input-group">
                    <label>Position (m):</label>
                    <input type="number" class="rigging-position" min="0" max="${trussLength}" value="${point.position}" step="0.1">
                </div>
                <button class="remove-btn" ${isEndPoint ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
            `;
            
            riggingPointsList.appendChild(item);
            
            // Event-Listener für Position
            const positionInput = item.querySelector('.rigging-position');
            positionInput.addEventListener('change', function() {
                updateRiggingPointPosition(index, parseFloat(this.value));
            });
            
            // Event-Listener für Löschen-Button
            const removeBtn = item.querySelector('.remove-btn');
            if (!isEndPoint) {
                removeBtn.addEventListener('click', function() {
                    removeRiggingPoint(index);
                });
            }
        });
        
        // Aktualisiere den Status des Hinzufügen-Buttons
        addRiggingPointBtn.disabled = riggingPoints.length >= MAX_RIGGING_POINTS;
    }

    function updateRiggingPointPosition(index, position) {
        if (position < 0) position = 0;
        if (position > trussLength) position = trussLength;
        
        riggingPoints[index].position = position;
        updateVisualization();
    }

    function addRiggingPoint() {
        if (riggingPoints.length >= MAX_RIGGING_POINTS) return;
        
        // Berechne eine Position in der Mitte der Traverse
        const position = trussLength / 2;
        
        // Füge den neuen Punkt hinzu und sortiere nach Position
        riggingPoints.push({ position });
        riggingPoints.sort((a, b) => a.position - b.position);
        
        initializeRiggingPointsUI();
        updateVisualization();
    }

    function removeRiggingPoint(index) {
        if (riggingPoints.length <= MIN_RIGGING_POINTS) return;
        
        riggingPoints.splice(index, 1);
        initializeRiggingPointsUI();
        updateVisualization();
    }

    function addLoad() {
        if (loads.length >= MAX_LOADS) return;
        
        // Standardposition in der Mitte der Traverse
        const position = trussLength / 2;
        const weight = 50; // Standardgewicht in kg
        
        loads.push({ position, weight });
        updateLoadsList();
        updateVisualization();
    }

    function updateLoadsList() {
        // Leere die Liste
        loadsList.innerHTML = '';
        
        // Füge die Lasten hinzu
        loads.forEach((load, index) => {
            const item = document.createElement('div');
            item.className = 'load-item';
            
            item.innerHTML = `
                <div class="input-group">
                    <label>Position (m):</label>
                    <input type="number" class="load-position" min="0" max="${trussLength}" value="${load.position}" step="0.1">
                </div>
                <div class="input-group">
                    <label>Gewicht (kg):</label>
                    <input type="number" class="load-weight" min="0" value="${load.weight}" step="1">
                </div>
                <button class="remove-btn"><i class="fas fa-trash"></i></button>
            `;
            
            loadsList.appendChild(item);
            
            // Event-Listener für Position
            const positionInput = item.querySelector('.load-position');
            positionInput.addEventListener('change', function() {
                updateLoadPosition(index, parseFloat(this.value));
            });
            
            // Event-Listener für Gewicht
            const weightInput = item.querySelector('.load-weight');
            weightInput.addEventListener('change', function() {
                updateLoadWeight(index, parseFloat(this.value));
            });
            
            // Event-Listener für Löschen-Button
            const removeBtn = item.querySelector('.remove-btn');
            removeBtn.addEventListener('click', function() {
                removeLoad(index);
            });
        });
        
        // Aktualisiere den Status des Hinzufügen-Buttons
        addLoadBtn.disabled = loads.length >= MAX_LOADS;
    }

    function updateLoadPosition(index, position) {
        if (position < 0) position = 0;
        if (position > trussLength) position = trussLength;
        
        loads[index].position = position;
        updateVisualization();
    }

    function updateLoadWeight(index, weight) {
        if (weight < 0) weight = 0;
        
        loads[index].weight = weight;
        updateVisualization();
    }

    function removeLoad(index) {
        loads.splice(index, 1);
        updateLoadsList();
        updateVisualization();
    }

    function updateVisualization() {
        // Leere die Container
        riggingPointsContainer.innerHTML = '';
        loadsContainer.innerHTML = '';
        
        // Zeichne die Bemaßung
        const dimensionElement = document.createElement('div');
        dimensionElement.className = 'dimension';
        
        // Maßlinie
        const dimensionLine = document.createElement('div');
        dimensionLine.className = 'dimension-line';
        dimensionElement.appendChild(dimensionLine);
        
        // Maßpfeile
        const leftArrow = document.createElement('div');
        leftArrow.className = 'dimension-arrow left';
        dimensionElement.appendChild(leftArrow);
        
        const rightArrow = document.createElement('div');
        rightArrow.className = 'dimension-arrow right';
        dimensionElement.appendChild(rightArrow);
        
        // Maßtext
        const dimensionText = document.createElement('div');
        dimensionText.className = 'dimension-text';
        dimensionText.textContent = `${trussLength.toFixed(1)} m`;
        dimensionElement.appendChild(dimensionText);
        
        riggingPointsContainer.appendChild(dimensionElement);
        
        // Zeichne Traversenlifte, wenn aktiviert
        if (useLiftSystem) {
            drawLiftSystem();
        }
        
        // Zeichne die Aufhängepunkte nur wenn kein Liftsystem aktiviert ist
        if (!useLiftSystem) {
            riggingPoints.forEach((point, index) => {
                const riggingPoint = document.createElement('div');
                riggingPoint.className = 'rigging-point';
                riggingPoint.style.left = `${(point.position / trussLength) * 100}%`;
        
                const label = document.createElement('div');
                label.className = 'rigging-point-label';
                label.textContent = `R${index + 1}`;
        
                riggingPoint.appendChild(label);
                riggingPointsContainer.appendChild(riggingPoint);
        
                // Direktes Verschieben mit der Maus
                riggingPoint.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    draggedItemType = 'rigging';
                    draggedItemIndex = index;
                    isDragging = true;
                    dragStartX = e.clientX;
                    this.classList.add('dragging');
                
                    // Verhindere Standard-Drag-and-Drop
                    riggingPoint.ondragstart = function() { return false; };
                });
            
                // Touch-Events für mobile Geräte
                riggingPoint.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    draggedItemType = 'rigging';
                    draggedItemIndex = index;
                    isDragging = true;
                    dragStartX = e.touches[0].clientX;
                    this.classList.add('dragging');
                }, { passive: false });
        
                // Positionsmarkierung
                const posMarker = document.createElement('div');
                posMarker.className = 'position-marker';
                posMarker.textContent = `${point.position.toFixed(1)} m`;
                posMarker.style.left = `${(point.position / trussLength) * 100}%`;
                riggingPointsContainer.appendChild(posMarker);
            });
        }
        
        // Zeichne die Lasten
        loads.forEach((load, index) => {
            const loadElement = document.createElement('div');
            loadElement.className = 'load';
            loadElement.style.left = `${(load.position / trussLength) * 100}%`;
    
            const label = document.createElement('div');
            label.className = 'load-label';
            label.textContent = `${load.weight} kg`;
    
            loadElement.appendChild(label);
            loadsContainer.appendChild(loadElement);
    
            // Direktes Verschieben mit der Maus
            loadElement.addEventListener('mousedown', function(e) {
                e.preventDefault();
                draggedItemType = 'load';
                draggedItemIndex = index;
                isDragging = true;
                dragStartX = e.clientX;
                this.classList.add('dragging');
            
                // Verhindere Standard-Drag-and-Drop
                loadElement.ondragstart = function() { return false; };
            });
        
            // Touch-Events für mobile Geräte
            loadElement.addEventListener('touchstart', function(e) {
                e.preventDefault();
                draggedItemType = 'load';
                draggedItemIndex = index;
                isDragging = true;
                dragStartX = e.touches[0].clientX;
                this.classList.add('dragging');
            }, { passive: false });
    
            // Positionsmarkierung
            const posMarker = document.createElement('div');
            posMarker.className = 'position-marker load-marker';
            posMarker.textContent = `${load.position.toFixed(1)} m`;
            posMarker.style.left = `${(load.position / trussLength) * 100}%`;
            loadsContainer.appendChild(posMarker);
        });
    }

    function calculateForces() {
        if (riggingPoints.length < 2) {
            alert('Mindestens zwei Aufhängepunkte werden benötigt.');
            return;
        }
        
        // Sortiere die Aufhängepunkte nach Position
        riggingPoints.sort((a, b) => a.position - b.position);
        
        // Berechne das Eigengewicht der Traverse
        const trussWeightTotal = trussLength * TRUSS_WEIGHT_KG_PER_METER;
        
        // Berechne die Kräfte an den Aufhängepunkten
        let forces;
        
        if (useLiftSystem) {
            forces = calculateLiftSystemForces(riggingPoints, loads, trussWeightTotal, trussLength);
        } else {
            forces = calculateRiggingForces(riggingPoints, loads, trussWeightTotal, trussLength);
        }
        
        // Zeige die Ergebnisse an
        displayResults(forces);
    }

    function calculateRiggingForces(riggingPoints, loads, trussWeight, trussLength) {
        // Implementierung der Berechnung für mehrere Aufhängepunkte
        // Wir verwenden hier ein vereinfachtes Modell für statisch bestimmte Systeme
        
        // Für den Fall mit 2 Aufhängepunkten (einfacher Balken)
        if (riggingPoints.length === 2) {
            const forces = [
                { position: riggingPoints[0].position, force: 0 },
                { position: riggingPoints[1].position, force: 0 }
            ];
            
            // Eigengewicht der Traverse
            // Berechne das Eigengewicht basierend auf der Position der Aufhängepunkte
            const span = riggingPoints[1].position - riggingPoints[0].position;
            const trussWeightTotal = span * TRUSS_WEIGHT_KG_PER_METER;
            
            // Eigengewicht wird gleichmäßig verteilt
            forces[0].force += trussWeightTotal / 2;
            forces[1].force += trussWeightTotal / 2;
            
            // Kräfte durch Lasten
            loads.forEach(load => {
                // Prüfe, ob die Last innerhalb der Aufhängepunkte liegt
                if (load.position < riggingPoints[0].position || load.position > riggingPoints[1].position) {
                    return; // Last liegt außerhalb der Traverse
                }
                
                // Berechne die Hebelarme
                const distanceToLeft = load.position - riggingPoints[0].position;
                const distanceToRight = riggingPoints[1].position - load.position;
                const totalDistance = span;
                
                // Berechne die Kräfte basierend auf den Hebelarmen
                forces[0].force += load.weight * (distanceToRight / totalDistance);
                forces[1].force += load.weight * (distanceToLeft / totalDistance);
            });
            
            return forces;
        }
        
        // Für den Fall mit mehr als 2 Aufhängepunkten
        // Hier verwenden wir eine vereinfachte Methode, die die Last auf die nächstgelegenen Aufhängepunkte verteilt
        const forces = riggingPoints.map(point => {
            return { position: point.position, force: 0 };
        });
        
        // Eigengewicht der Traverse - auf Abschnitte zwischen Aufhängepunkten verteilen
        for (let i = 0; i < riggingPoints.length - 1; i++) {
            const span = riggingPoints[i+1].position - riggingPoints[i].position;
            const sectionWeight = span * TRUSS_WEIGHT_KG_PER_METER;
            
            // Verteile das Gewicht dieses Abschnitts auf die beiden angrenzenden Aufhängepunkte
            forces[i].force += sectionWeight / 2;
            forces[i+1].force += sectionWeight / 2;
        }
        
        // Kräfte durch Lasten
        loads.forEach(load => {
            // Finde die beiden nächstgelegenen Aufhängepunkte
            let leftIndex = -1;
            let rightIndex = -1;
            
            for (let i = 0; i < riggingPoints.length - 1; i++) {
                if (load.position >= riggingPoints[i].position && load.position <= riggingPoints[i+1].position) {
                    leftIndex = i;
                    rightIndex = i + 1;
                    break;
                }
            }
            
            // Wenn die Last außerhalb der Aufhängepunkte liegt, ignorieren
            if (leftIndex === -1 || rightIndex === -1) {
                return;
            }
            
            // Wenn die Last genau auf einem Aufhängepunkt liegt
            if (riggingPoints[leftIndex].position === load.position) {
                forces[leftIndex].force += load.weight;
                return;
            }
            
            if (riggingPoints[rightIndex].position === load.position) {
                forces[rightIndex].force += load.weight;
                return;
            }
            
            // Berechne die Kräfte basierend auf dem Abstand
            const totalDistance = riggingPoints[rightIndex].position - riggingPoints[leftIndex].position;
            const distanceToRight = load.position - riggingPoints[leftIndex].position;
            const distanceToLeft = riggingPoints[rightIndex].position - load.position;
            
            const leftRatio = distanceToLeft / totalDistance;
            const rightRatio = distanceToRight / totalDistance;
            
            forces[leftIndex].force += load.weight * leftRatio;
            forces[rightIndex].force += load.weight * rightRatio;
        });
        
        return forces;
    }

    function displayResults(forces) {
        resultsContainer.innerHTML = '';
        
        if (forces.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">Keine Ergebnisse verfügbar</p>';
            return;
        }
        
        // Berechne die Gesamtlast
        let totalLoad = 0;
        forces.forEach(force => {
            totalLoad += force.force;
        });
        
        // Zeige die Gesamtlast an
        const totalLoadElement = document.createElement('div');
        totalLoadElement.className = 'result-item';
        totalLoadElement.innerHTML = `
            <span>Gesamtlast:</span>
            <span class="force">${totalLoad.toFixed(2)} kg</span>
        `;
        resultsContainer.appendChild(totalLoadElement);
        
        // Zeige die Kräfte an den einzelnen Aufhängepunkten an
        forces.forEach((force, index) => {
            let label = force.type === 'lift' 
                ? `Traversenlift L${index + 1} (${force.position.toFixed(2)} m)` 
                : `Aufhängepunkt R${index + 1} (${force.position.toFixed(2)} m)`;
                
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            let statusClass = '';
            let statusText = '';
            
            // Prüfe Überlastung bei Liften
            if (force.type === 'lift' && force.force > liftCapacity) {
                statusClass = 'overload';
                statusText = ` <span class="warning">(Überlastung: ${(force.force - liftCapacity).toFixed(2)} kg über Kapazität)</span>`;
            }
            
            resultItem.innerHTML = `
                <span>${label}:${statusText}</span>
                <span class="force ${statusClass}">${force.force.toFixed(2)} kg</span>
            `;
            resultsContainer.appendChild(resultItem);
        });
        
        // Wenn Liftsystem aktiviert ist, zeige Standfähigkeitsberechnung
        if (useLiftSystem) {
            // Berechne die Standfähigkeit für jeden Lift
            const stabilityResults = calculateStability(forces);
            
            // Überschrift für Standfähigkeit
            const stabilityHeader = document.createElement('div');
            stabilityHeader.className = 'result-header';
            stabilityHeader.textContent = 'Standfähigkeit der Lifte:';
            resultsContainer.appendChild(stabilityHeader);
            
            // Zeige die Standfähigkeit für jeden Lift an
            stabilityResults.forEach((stability, index) => {
                const stabilityItem = document.createElement('div');
                stabilityItem.className = 'result-item';
                
                let stabilityClass = stability.isStable ? 'stable' : 'unstable';
                let stabilityText = stability.isStable 
                    ? 'Stabil' 
                    : `Instabil (benötigt ${stability.requiredWeight.toFixed(2)} kg Gegengewicht)`;
                
                stabilityItem.innerHTML = `
                    <span>Lift L${index + 1}:</span>
                    <span class="stability ${stabilityClass}">${stabilityText}</span>
                `;
                resultsContainer.appendChild(stabilityItem);
            });
        }
    }
    
    // Funktion zur Berechnung der Standfähigkeit der Lifte
    function calculateStability(forces) {
        const stabilityResults = [];
        
        // Für jeden Lift die Standfähigkeit berechnen
        forces.filter(force => force.type === 'lift').forEach((force, index) => {
            // Berechne das Kippmoment (Kraft * Hebelarm)
            const tippingMoment = force.force * (outriggerLength / 2); // Vereinfachte Annahme
            
            // Berechne das stabilisierende Moment (Liftgewicht * Hebelarm)
            const stabilizingMoment = liftWeight * outriggerLength;
            
            // Prüfe, ob der Lift stabil ist
            const isStable = stabilizingMoment >= tippingMoment;
            
            // Berechne das benötigte Gegengewicht, falls instabil
            const requiredWeight = isStable ? 0 : ((tippingMoment - stabilizingMoment) / outriggerLength);
            
            stabilityResults.push({
                liftIndex: index,
                isStable: isStable,
                tippingMoment: tippingMoment,
                stabilizingMoment: stabilizingMoment,
                requiredWeight: requiredWeight
            });
        });
        
        return stabilityResults;
    }
    
    // Drag-and-Drop Funktionen
    let draggedItemType = null;
    let draggedItemIndex = null;
    let isDragging = false;
    let dragStartX = 0;
    
    function handleRiggingDragStart(e) {
        draggedItemType = 'rigging';
        draggedItemIndex = parseInt(this.dataset.index);
        e.dataTransfer.setData('text/plain', this.style.left);
        e.dataTransfer.effectAllowed = 'move';
        isDragging = true;
    }
    
    // Diese Funktion wird nicht mehr benötigt, da wir jetzt direkte Maus-Events verwenden
    function handleLoadDragStart(e) {
        e.preventDefault();
        return false;
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    
    // Diese Funktion wird vereinfacht, da wir jetzt hauptsächlich mousemove/touchmove verwenden
    function handleDrop(e) {
        e.preventDefault();
        
        // Zurücksetzen der Drag-Variablen
        isDragging = false;
        draggedItemType = null;
        draggedItemIndex = null;
        
        // Entferne die Dragging-Klasse von allen Elementen
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(el => el.classList.remove('dragging'));
    }
    // Zustandsvariable für Lift-Positionen
    let liftPositions = [];
    
    // Funktion zum Zeichnen des Liftsystems
    function drawLiftSystem() {
        // Initialisiere die Lift-Positionen, wenn sie noch nicht gesetzt wurden
        if (liftPositions.length !== liftCount) {
            initializeLiftPositions();
        }
        
        // Zeichne die Lifte
        liftPositions.forEach((position, index) => {
            // Lift-Element
            const liftElement = document.createElement('div');
            liftElement.className = 'lift';
            liftElement.style.left = `${(position / trussLength) * 100}%`;
            liftElement.dataset.index = index;
            
            // Lift-Säule
            const liftColumn = document.createElement('div');
            liftColumn.className = 'lift-column';
            liftColumn.style.height = `${liftHeight * 20}px`; // Skalierung für die Visualisierung
            
            // Lift-Label
            const liftLabel = document.createElement('div');
            liftLabel.className = 'lift-label';
            liftLabel.textContent = `L${index + 1}`;
            
            // Lift-Kapazität
            const liftCapacityLabel = document.createElement('div');
            liftCapacityLabel.className = 'lift-capacity';
            liftCapacityLabel.textContent = `${liftCapacity} kg`;
            
            // Lift-Gewicht
            const liftWeightLabel = document.createElement('div');
            liftWeightLabel.className = 'lift-weight';
            liftWeightLabel.textContent = `${liftWeight} kg`;
            
            liftElement.appendChild(liftColumn);
            liftElement.appendChild(liftLabel);
            liftElement.appendChild(liftCapacityLabel);
            liftElement.appendChild(liftWeightLabel);
            
            // Zeichne die Ausleger
            for (let i = 0; i < 4; i++) {
                const outrigger = document.createElement('div');
                outrigger.className = 'outrigger';
                
                // Position der Ausleger (in 4 Richtungen)
                let angle = i * 90; // 0, 90, 180, 270 Grad
                outrigger.style.transform = `rotate(${angle}deg)`;
                outrigger.style.width = `${outriggerLength * 30}px`; // Skalierung für die Visualisierung
                
                liftElement.appendChild(outrigger);
            }
            
            // Direktes Verschieben mit der Maus
            liftElement.addEventListener('mousedown', function(e) {
                e.preventDefault();
                draggedItemType = 'lift';
                draggedItemIndex = index;
                isDragging = true;
                dragStartX = e.clientX;
                this.classList.add('dragging');
                
                // Verhindere Standard-Drag-and-Drop
                liftElement.ondragstart = function() { return false; };
            });
            
            // Touch-Events für mobile Geräte
            liftElement.addEventListener('touchstart', function(e) {
                e.preventDefault();
                draggedItemType = 'lift';
                draggedItemIndex = index;
                isDragging = true;
                dragStartX = e.touches[0].clientX;
                this.classList.add('dragging');
            }, { passive: false });
            
            loadsContainer.appendChild(liftElement);
            
            // Positionsmarkierung
            const posMarker = document.createElement('div');
            posMarker.className = 'position-marker lift-marker';
            posMarker.textContent = `${position.toFixed(1)} m`;
            posMarker.style.left = `${(position / trussLength) * 100}%`;
            loadsContainer.appendChild(posMarker);
        });
    }
    
    // Funktion zum Initialisieren der Lift-Positionen
    function initializeLiftPositions() {
        liftPositions = [];
        
        if (liftCount === 2) {
            // Bei 2 Liften: an den Enden
            liftPositions.push(0, trussLength);
        } else if (liftCount === 3) {
            // Bei 3 Liften: an beiden Enden und in der Mitte
            liftPositions.push(0, trussLength / 2, trussLength);
        } else if (liftCount === 4) {
            // Bei 4 Liften: an beiden Enden und gleichmäßig verteilt
            const segment = trussLength / 3;
            liftPositions.push(0, segment, 2 * segment, trussLength);
        }
    }
    
    // Funktion zum Aktualisieren der Lift-Position
    function updateLiftPosition(index, position) {
        if (position < 0) position = 0;
        if (position > trussLength) position = trussLength;
        
        liftPositions[index] = position;
        updateVisualization();
    }
    
    // Funktion zur Berechnung der Kräfte mit Liftsystem
    function calculateLiftSystemForces(riggingPoints, loads, trussWeight, trussLength) {
        // Verwende die gespeicherten Lift-Positionen
        if (liftPositions.length !== liftCount) {
            initializeLiftPositions();
        }
        
        // Sortiere die Lift-Positionen
        liftPositions.sort((a, b) => a - b);
        
        // Erstelle Lift-Objekte mit Positionen
        const lifts = liftPositions.map((position, index) => {
            return { position, force: 0, type: 'lift' };
        });
        
        // Eigengewicht der Traverse auf Abschnitte zwischen Liften verteilen
        for (let i = 0; i < lifts.length - 1; i++) {
            const span = lifts[i+1].position - lifts[i].position;
            const sectionWeight = span * TRUSS_WEIGHT_KG_PER_METER;
            
            // Verteile das Gewicht dieses Abschnitts auf die beiden angrenzenden Lifte
            lifts[i].force += sectionWeight / 2;
            lifts[i+1].force += sectionWeight / 2;
        }
        
        // Kräfte durch Lasten
        loads.forEach(load => {
            // Finde die beiden nächstgelegenen Lifte
            let leftIndex = -1;
            let rightIndex = -1;
            
            for (let i = 0; i < lifts.length - 1; i++) {
                if (load.position >= lifts[i].position && load.position <= lifts[i+1].position) {
                    leftIndex = i;
                    rightIndex = i + 1;
                    break;
                }
            }
            
            // Wenn die Last außerhalb der Lifte liegt
            if (leftIndex === -1 || rightIndex === -1) {
                // Prüfe, ob die Last links vom ersten Lift liegt
                if (load.position < lifts[0].position) {
                    lifts[0].force += load.weight;
                    return;
                }
                
                // Prüfe, ob die Last rechts vom letzten Lift liegt
                if (load.position > lifts[lifts.length - 1].position) {
                    lifts[lifts.length - 1].force += load.weight;
                    return;
                }
                
                return; // Last liegt außerhalb des Bereichs
            }
            
            // Wenn die Last genau auf einem Lift liegt
            if (lifts[leftIndex].position === load.position) {
                lifts[leftIndex].force += load.weight;
                return;
            }
            
            if (lifts[rightIndex].position === load.position) {
                lifts[rightIndex].force += load.weight;
                return;
            }
            
            // Berechne die Kräfte basierend auf dem Abstand
            const totalDistance = lifts[rightIndex].position - lifts[leftIndex].position;
            const distanceToRight = load.position - lifts[leftIndex].position;
            const distanceToLeft = lifts[rightIndex].position - load.position;
            
            const leftRatio = distanceToLeft / totalDistance;
            const rightRatio = distanceToRight / totalDistance;
            
            lifts[leftIndex].force += load.weight * leftRatio;
            lifts[rightIndex].force += load.weight * rightRatio;
        });
        
        return lifts;
    }
    
    // PDF Export Funktion
    function exportToPdf() {
        // Berechne die Kräfte, falls noch nicht geschehen
        if (resultsContainer.querySelector('.no-results')) {
            calculateForces();
        }
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = 20;
        
        // Titel
        doc.setFontSize(18);
        doc.text('FD32 Eurotruss Belastungsrechner', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
        
        // Untertitel
        doc.setFontSize(12);
        doc.text('Berechnungsergebnisse', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;
        
        // Zeichnung der Traverse mit Aufhängepunkten und Lasten
        yPos = drawTrussDiagram(doc, yPos, margin, pageWidth);
        yPos += 15;
        
        // Traverse-Informationen
        doc.setFontSize(14);
        doc.text('Traverse-Eigenschaften:', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.text(`Länge der Traverse: ${trussLength.toFixed(1)} m`, margin, yPos);
        yPos += 6;
        doc.text(`Eigengewicht pro Meter: ${TRUSS_WEIGHT_KG_PER_METER} kg/m`, margin, yPos);
        yPos += 6;
        doc.text(`Gesamtgewicht der Traverse: ${(trussLength * TRUSS_WEIGHT_KG_PER_METER).toFixed(1)} kg`, margin, yPos);
        yPos += 10;
        
        // Liftsystem-Informationen, falls aktiviert
        if (useLiftSystem) {
            doc.setFontSize(14);
            doc.text('Liftsystem:', margin, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.text(`Höhe vom Boden: ${liftHeight.toFixed(1)} m`, margin, yPos);
            yPos += 6;
            doc.text(`Anzahl der Lifte: ${liftCount}`, margin, yPos);
            yPos += 6;
            doc.text(`Tragfähigkeit pro Lift: ${liftCapacity} kg`, margin, yPos);
            yPos += 6;
            doc.text(`Gewicht pro Lift: ${liftWeight} kg`, margin, yPos);
            yPos += 6;
            doc.text(`Länge der Ausleger: ${outriggerLength.toFixed(1)} m`, margin, yPos);
            yPos += 10;
        }
        
        // Aufhängepunkte
        doc.setFontSize(14);
        doc.text('Aufhängepunkte:', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        riggingPoints.forEach((point, index) => {
            doc.text(`R${index + 1}: Position ${point.position.toFixed(1)} m`, margin, yPos);
            yPos += 6;
        });
        yPos += 4;
        
        // Lasten
        doc.setFontSize(14);
        doc.text('Lasten:', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        if (loads.length === 0) {
            doc.text('Keine Lasten definiert', margin, yPos);
            yPos += 6;
        } else {
            loads.forEach((load, index) => {
                doc.text(`Last ${index + 1}: ${load.weight} kg bei Position ${load.position.toFixed(1)} m`, margin, yPos);
                yPos += 6;
            });
        }
        yPos += 4;
        
        // Neue Seite, wenn nicht genug Platz
        if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = 20;
        }
        
        // Ergebnisse
        doc.setFontSize(14);
        doc.text('Berechnungsergebnisse:', margin, yPos);
        yPos += 8;
        
        // Berechne die Kräfte
        const trussWeightTotal = trussLength * TRUSS_WEIGHT_KG_PER_METER;
        let forces;
        
        if (useLiftSystem) {
            forces = calculateLiftSystemForces(riggingPoints, loads, trussWeightTotal, trussLength);
        } else {
            forces = calculateRiggingForces(riggingPoints, loads, trussWeightTotal, trussLength);
        }
        
        // Gesamtlast
        let totalLoad = 0;
        forces.forEach(force => {
            totalLoad += force.force;
        });
        
        doc.setFontSize(10);
        doc.text(`Gesamtlast: ${totalLoad.toFixed(2)} kg`, margin, yPos);
        yPos += 8;
        
        // Kräfte an den Aufhängepunkten oder Liften
        forces.forEach((force, index) => {
            let label = force.type === 'lift' 
                ? `Traversenlift L${index + 1} (${force.position.toFixed(2)} m)` 
                : `Aufhängepunkt R${index + 1} (${force.position.toFixed(2)} m)`;
            
            let forceText = `${force.force.toFixed(2)} kg`;
            
            // Prüfe Überlastung bei Liften
            if (force.type === 'lift' && force.force > liftCapacity) {
                forceText += ` (ÜBERLASTUNG: ${(force.force - liftCapacity).toFixed(2)} kg über Kapazität)`;
                doc.setTextColor(231, 76, 60); // Rot für Warnungen
            } else {
                doc.setTextColor(0, 0, 0); // Schwarz für normalen Text
            }
            
            doc.text(`${label}: ${forceText}`, margin, yPos);
            yPos += 6;
        });
        
        // Textfarbe zurücksetzen
        doc.setTextColor(0, 0, 0);
        
        // Wenn Liftsystem aktiviert ist, zeige Standfähigkeitsberechnung im PDF
        if (useLiftSystem) {
            // Neue Seite, wenn nicht genug Platz
            if (yPos > pageHeight - 80) {
                doc.addPage();
                yPos = 20;
            }
            
            // Überschrift für Standfähigkeit
            yPos += 10;
            doc.setFontSize(14);
            doc.text('Standfähigkeit der Lifte:', margin, yPos);
            yPos += 8;
            
            // Berechne die Standfähigkeit für jeden Lift
            const stabilityResults = calculateStability(forces);
            
            // Zeige die Standfähigkeit für jeden Lift an
            doc.setFontSize(10);
            stabilityResults.forEach((stability, index) => {
                let stabilityText = stability.isStable 
                    ? 'Stabil' 
                    : `Instabil (benötigt ${stability.requiredWeight.toFixed(2)} kg Gegengewicht)`;
                
                if (stability.isStable) {
                    doc.setTextColor(46, 204, 113); // Grün für stabil
                } else {
                    doc.setTextColor(231, 76, 60); // Rot für instabil
                }
                
                doc.text(`Lift L${index + 1}: ${stabilityText}`, margin, yPos);
                yPos += 6;
                
                // Details zur Standfähigkeit
                doc.setTextColor(0, 0, 0);
                doc.text(`  Kippmoment: ${stability.tippingMoment.toFixed(2)} kg·m`, margin, yPos);
                yPos += 6;
                doc.text(`  Stabilisierendes Moment: ${stability.stabilizingMoment.toFixed(2)} kg·m`, margin, yPos);
                yPos += 6;
            });
            
            // Textfarbe zurücksetzen
            doc.setTextColor(0, 0, 0);
        }
        
        // Fußzeile
        const today = new Date();
        const dateStr = today.toLocaleDateString('de-DE');
        doc.setFontSize(8);
        doc.text(`Erstellt am: ${dateStr}`, margin, doc.internal.pageSize.getHeight() - 10);
        doc.text('FD32 Truss Belastungsrechner', pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        
        // Speichern
        doc.save('FD32_Truss_Berechnung.pdf');
    }
    
    // Funktion zum Zeichnen der Traverse im PDF
    function drawTrussDiagram(doc, startY, margin, pageWidth) {
        const diagramWidth = pageWidth - 2 * margin;
        const diagramHeight = useLiftSystem ? 90 : 60;
        const trussHeight = 10;
        const yPos = startY;
        
        // Zeichne Überschrift
        doc.setFontSize(12);
        doc.text('Traversenaufbau:', margin, yPos);
        
        // Zeichne die Traverse
        doc.setDrawColor(100, 100, 100);
        doc.setFillColor(150, 150, 150);
        doc.rect(margin, yPos + 15, diagramWidth, trussHeight, 'F');
        
        // Zeichne Maßlinie
        doc.setDrawColor(80, 80, 80);
        doc.line(margin, yPos + 40, margin + diagramWidth, yPos + 40); // Horizontale Linie
        doc.line(margin, yPos + 38, margin, yPos + 42); // Linker Pfeil
        doc.line(margin + diagramWidth, yPos + 38, margin + diagramWidth, yPos + 42); // Rechter Pfeil
        
        // Beschriftung der Maßlinie
        doc.setFontSize(8);
        doc.text(`${trussLength.toFixed(1)} m`, margin + diagramWidth / 2, yPos + 45, { align: 'center' });
        
        // Zeichne Aufhängepunkte wenn kein Liftsystem verwendet wird
        if (!useLiftSystem) {
            doc.setDrawColor(0, 100, 200);
            doc.setFillColor(52, 152, 219); // Blau für Aufhängepunkte
            
            riggingPoints.forEach((point, index) => {
                const xPos = margin + (point.position / trussLength) * diagramWidth;
                
                // Aufhängepunkt
                doc.circle(xPos, yPos + 5, 3, 'F');
                doc.setLineDashPattern([1, 1], 0);
                doc.line(xPos, yPos + 5, xPos, yPos + 15);
                doc.setLineDashPattern([], 0);
                
                // Beschriftung
                doc.setFontSize(7);
                doc.text(`R${index + 1}`, xPos, yPos, { align: 'center' });
                doc.text(`${point.position.toFixed(1)} m`, xPos, yPos + 5, { align: 'center' });
            });
        } else {
            // Zeichne Traversenlifte
            doc.setDrawColor(44, 62, 80);
            doc.setFillColor(44, 62, 80); // Dunkelblau für Lifte
            
            // Berechne die Positionen der Lifte basierend auf der Anzahl
            const liftPositions = [];
            
            if (liftCount === 2) {
                liftPositions.push(0, trussLength);
            } else if (liftCount === 3) {
                liftPositions.push(0, trussLength / 2, trussLength);
            } else if (liftCount === 4) {
                const segment = trussLength / 3;
                liftPositions.push(0, segment, 2 * segment, trussLength);
            }
            
            liftPositions.forEach((position, index) => {
                const xPos = margin + (position / trussLength) * diagramWidth;
                
                // Liftsäule
                doc.setFillColor(44, 62, 80);
                doc.rect(xPos - 2, yPos + 25, 4, 30, 'F');
                
                // Liftplattform
                doc.setFillColor(52, 73, 94);
                doc.rect(xPos - 6, yPos + 55, 12, 4, 'F');
                
                // Beschriftung
                doc.setFontSize(7);
                doc.text(`L${index + 1}`, xPos, yPos + 65, { align: 'center' });
                doc.text(`${position.toFixed(1)} m`, xPos, yPos + 70, { align: 'center' });
                
                // Höhenangabe
                doc.setLineDashPattern([0.5, 0.5], 0);
                doc.line(xPos + 8, yPos + 25, xPos + 20, yPos + 25);
                doc.setLineDashPattern([], 0);
                doc.text(`${liftHeight.toFixed(1)} m`, xPos + 25, yPos + 27);
                
                // Zeichne die Ausleger
                doc.setDrawColor(243, 156, 18); // Orange für Ausleger
                doc.setFillColor(243, 156, 18);
                
                // Horizontale Ausleger
                doc.rect(xPos - outriggerLength * 10 - 2, yPos + 55, outriggerLength * 10, 2, 'F');
                doc.rect(xPos + 2, yPos + 55, outriggerLength * 10, 2, 'F');
                
                // Vertikale Ausleger
                doc.rect(xPos - 1, yPos + 55 + 2, 2, outriggerLength * 10, 'F');
                doc.rect(xPos - 1, yPos + 55 - outriggerLength * 10 - 2, 2, outriggerLength * 10, 'F');
                
                // Beschriftung der Ausleger
                doc.setFontSize(6);
                doc.text(`${outriggerLength.toFixed(1)} m`, xPos - outriggerLength * 5, yPos + 52, { align: 'center' });
            });
            
            // Boden anzeigen
            doc.setDrawColor(150, 150, 150);
            doc.setFillColor(200, 200, 200);
            doc.rect(margin, yPos + 59, diagramWidth, 2, 'F');
        }
        
        // Zeichne Lasten
        if (loads.length > 0) {
            doc.setDrawColor(200, 50, 50);
            doc.setFillColor(231, 76, 60); // Rot für Lasten
            
            loads.forEach((load, index) => {
                const xPos = margin + (load.position / trussLength) * diagramWidth;
                
                // Last
                doc.circle(xPos, yPos + 25, 4, 'F');
                doc.setLineDashPattern([1, 1], 0);
                doc.line(xPos, yPos + 25, xPos, yPos + 15 + trussHeight);
                doc.setLineDashPattern([], 0);
                
                // Beschriftung
                doc.setFontSize(7);
                doc.text(`${load.weight} kg`, xPos, yPos + 32, { align: 'center' });
                doc.text(`${load.position.toFixed(1)} m`, xPos, yPos + 36, { align: 'center' });
            });
        }
        
        return yPos + diagramHeight;
    }
});
