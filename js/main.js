/**
 * Main application page.
 */
'use strict';

// High level object. Could be easily accessed from Web Inspector.
var g_workspace;
var g_views;
var g_gui;
var g_examples;
var g_mapSelector;
var g_isWebkit = navigator.userAgent.toLowerCase().indexOf('webkit') > -1;
var g_keyPressEvent = g_isWebkit ? 'keydown' : 'keypress';

/*
 * On load initialization.
 */
function init() {
    g_workspace = new Workspace();
    g_views = new ViewContainer(g_workspace, document.getElementById('view-container'));
    g_mapSelector = new MapSelector(
            g_workspace,
            document.getElementById('map-selector'),
            document.getElementById('current-map-label'));

    initGUI();
    g_examples = new Examples();

    g_workspace.addEventListener(Workspace.Events.STATUS_CHANGE,
                                 onWorkspaceStatusChange);
    g_workspace.addEventListener(Workspace.Events.ERRORS_CHANGE,
                                 onWorkspaceErrorsChange);

    initKeyboardShortcuts();

    document.getElementById('open-button').onclick = chooseFilesToOpen;
    document.getElementById('current-map-label').onclick = function() {g_mapSelector.activate();};
    document.getElementById('view-container').onmousedown = function(event) {g_mapSelector.deactivate();};
    document.querySelector('dialog#errors #close').onclick = clearErrors;

    for (var e in DragAndDrop) {
        var fn = DragAndDrop[e];
        if (typeof fn != 'function') continue;
        document.addEventListener(e, DragAndDrop[e], true);
    }

    if (window.location.search) {
        var fileNames = window.location.search.substr(1).split(';');
        g_workspace.download(fileNames);
    }
}

var KEYBOARD_SHORTCUTS = {
    '38': function() { // ArrowUp
        g_mapSelector.blink();
        g_mapSelector.navigate(MapSelector.Direction.UP);
    },
    '40': function() { // ArrowDown
        g_mapSelector.blink();
        g_mapSelector.navigate(MapSelector.Direction.DOWN);
    }
};

function initKeyboardShortcuts() {
    KEYBOARD_SHORTCUTS[g_isWebkit ? '79' : '111'] = chooseFilesToOpen; // Ctrl + O
    KEYBOARD_SHORTCUTS[g_isWebkit ? '70' : '102'] = activateMapSelector; // Ctrl + F
    KEYBOARD_SHORTCUTS[g_isWebkit ? '83' : '115'] = takeSnapshot; // Ctrl + S

    document.addEventListener(g_keyPressEvent, onKeyPress, false);
}

function activateMapSelector() {
    g_mapSelector.activate();
}

function takeSnapshot() {
    var name = g_workspace.mapName || 'image';
    g_views.export().then(function(blob) {
        saveAs(blob, name + '.png', 'image/png');
    });
}

function onKeyPress(event) {
    if ((/^Mac/i).test(navigator.platform)) {
        if (event.ctrlKey || event.altKey || !event.metaKey) return;
    } else {
        if (!event.ctrlKey || event.altKey || event.metaKey) return;
    }

    var key = (event.which ? event.which : event.keyCode).toString();
    if (key in KEYBOARD_SHORTCUTS) {
        event.preventDefault();
        var handler = KEYBOARD_SHORTCUTS[key];
        handler();
        return false;
    }
}

function onWorkspaceStatusChange() {
    if (g_workspace.status) {
        document.getElementById('status').innerHTML = g_workspace.status;
        document.getElementById('status').removeAttribute('hidden');
    } else {
        document.getElementById('status').setAttribute('hidden', 'true');
    }
}

function onWorkspaceErrorsChange() {
    var dialog = document.querySelector('dialog#errors');
    var list = dialog.querySelector('ul');
    list.textContent = '';
    g_workspace.errors.forEach(function(error) {
        var item = document.createElement('li');
        item.textContent = error;
        list.appendChild(item);
    });
    if (g_workspace.errors.length == 0) {
        dialog.close();
        dialog.hidden = true;
    } else {
        dialog.hidden = false;
        if (!dialog.open) dialog.showModal();
    }
}

function clearErrors() {
    g_workspace.clearErrors();
}

/*
 * Initializing DAT.GUI (http://workshop.chromeexperiments.com/examples/gui) controls.
 */
function initGUI() {
    g_gui = new dat.GUI();

    var f2d = g_gui.addFolder('2D');
    f2d.add(g_workspace.scene2d, 'spotBorder', 0, 1).name('Spot border').step(0.01);

    var f3d = g_gui.addFolder('3D');
    f3d.add(g_views.g3d, 'layout', {
        'Single view': ViewGroup3D.Layout.SINGLE,
        'Double view': ViewGroup3D.Layout.DOUBLE,
        'Triple view': ViewGroup3D.Layout.TRIPLE,
        'Quadriple view': ViewGroup3D.Layout.QUADRIPLE,
    }).name('Layout');
    f3d.addColor(g_workspace.scene3d, 'color').name('Color');
    f3d.addColor(g_workspace.scene3d, 'backgroundColor').name('Background');
    f3d.add(g_workspace.scene3d.frontLight, 'intensity', 0, 3).name('Light');
    f3d.add(g_workspace.scene3d, 'spotBorder', 0, 1).name('Spot border').step(0.01);
    f3d.add(g_views, 'exportPixelRatio3d', [0.5, 1.0, 2.0, 4.0]).name('Export pixel ratio');
    var adjustment = f3d.addFolder('Adjustment');
    adjustment.add(g_workspace.scene3d.adjustment, 'alpha', -180.0, 180.0).name('0X rotation').step(1);
    adjustment.add(g_workspace.scene3d.adjustment, 'beta', -180.0, 180.0).name('0Y rotation').step(1);
    adjustment.add(g_workspace.scene3d.adjustment, 'gamma', -180.0, 180.0).name('0Z rotation').step(1);
    adjustment.add(g_workspace.scene3d.adjustment, 'x').name('X offset').step(0.1);
    adjustment.add(g_workspace.scene3d.adjustment, 'y').name('Y offset').step(0.1);
    adjustment.add(g_workspace.scene3d.adjustment, 'z').name('Z offset').step(0.1);

    var fMapping = g_gui.addFolder('Mapping');
    fMapping.add(g_workspace, 'scaleId', {'Linear': Workspace.Scale.LINEAR.id, 'Logarithmic': Workspace.Scale.LOG.id}).name('Scale');
    fMapping.add(g_workspace, 'hotspotQuantile').name('Hotspot quantile').step(0.0001);
    var colorMaps = Object.keys(ColorMap.Maps).reduce(function(m, k) {
        m[ColorMap.Maps[k].name] = k;
        return m;
    }, {});
    fMapping.add(g_workspace, 'colorMapId', colorMaps).name('Color map');

    var mapping = {
        flag: fMapping.add(g_workspace, 'autoMinMax').name('Auto MinMax'),
        min: fMapping.add(g_workspace, 'minValue').name('Min value').step(0.00001),
        max: fMapping.add(g_workspace, 'maxValue').name('Max value').step(0.00001),
    };
    g_workspace.addEventListener(Workspace.Events.AUTO_MAPPING_CHANGE,
                                 onAutoMappingChange.bind(null, mapping));
    onAutoMappingChange(mapping);

    g_workspace.addEventListener(Workspace.Events.MODE_CHANGE, function() {
        f2d.closed = (g_workspace.mode != Workspace.Mode.MODE_2D);
        f3d.closed = (g_workspace.mode != Workspace.Mode.MODE_3D);
    });
}

function onAutoMappingChange(mapping) {
    var disabled = g_workspace.autoMinMax ? '' : null;
    mapping.min.domElement.querySelector('input').setAttribute('disabled', disabled);
    mapping.max.domElement.querySelector('input').setAttribute('disabled', disabled);
    if (g_workspace.autoMinMax) {
        mapping.min.updateDisplay();
        mapping.max.updateDisplay();
    }
}

/**
 * Implementation of dropping files via system's D&D.'
 */
var DragAndDrop = {
    _counter: 0,

    dragenter: function(e) {
        e.preventDefault();
        if (++DragAndDrop._counter == 1)
            document.body.setAttribute('drop-target', '');
    },

    dragleave: function(e) {
        e.preventDefault();
        if (--DragAndDrop._counter === 0)
            document.body.removeAttribute('drop-target');
    },

    dragover: function(e) {
        e.preventDefault();
    },

    drop: function(e) {
        DragAndDrop._counter = 0;
        document.body.removeAttribute('drop-target');

        e.preventDefault();
        e.stopPropagation();

        openFiles(e.dataTransfer.files);
    }
};

function openFiles(files) {
    var handlers = findFileHandlers(files);
    for (var i = 0; i < handlers.length; i++) {
        handlers[i]();
    }
};

function findFileHandlers(files) {
    var result = [];
    for (var i = 0; i < files.length; i++) {
        var file = files[i];

        if ((/\.png$/i.test(file.name))) {
            result.push(g_workspace.loadImage.bind(g_workspace, file));
        } else if (/\.stl$/i.test(file.name)) {
            result.push(g_workspace.loadMesh.bind(g_workspace, file));
        } else if (/\.csv$/i.test(file.name)) {
            result.push(g_workspace.loadIntensities.bind(g_workspace, file));
        }
    }
    return result;
}

/**
 * Shows file open dialog.
 */
function chooseFilesToOpen() {
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.addEventListener('change', function() {
        openFiles(fileInput.files);
    });
    fileInput.click();
}

window.onload = init;
