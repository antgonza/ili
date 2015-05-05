function Scene2D() {
    this._fontSize = 0; // Hidden
    this._fontColor = '#000000';
    this._spotBorder = 0.05;
    this._views = [];
    this._imageURL = null;
    this._width = 0;
    this._height = 0;
    this._spots = null;
};

Scene2D.prototype = Object.create(null, {
    view: {
        set: function(value) {
            this._views = [value];
            this._buildContent(value.contentElement);
        }
    },

    width: {
        get: function() {
            return this._width;
        }
    },

    height: {
        get: function() {
            return this._height;
        }
    },

    hasImage: {
        get: function() {
            return !!this._imageURL;
        }
    },

    setImage: {
        value: function(imageURL, width, height) {
            if (this._imageURL) {
                URL.revokeObjectURL(this._imageURL);
            }
            this._imageURL = imageURL;
            this._width = width;
            this._height = height;

            for (var i = 0; i < this._views.length; i++) {
                this._updateImage(this._views[i].contentElement.querySelector('image'));
                this._views[i].adjustOffset();
            }
        }
    },

    resetImage: {
        value: function() {
            this.setImage(null, 0, 0);
        }
    },

    _updateImage: {
        value: function(imageElement) {
            imageElement.href.baseVal = this._imageURL || '';
            imageElement.width.baseVal.value = this._width;
            imageElement.height.baseVal.value = this._height;
        }
    },

    _buildContent: {
        value: function(contentElement) {
            var SVGNS = 'http://www.w3.org/2000/svg';
            var imageElement = document.createElementNS(SVGNS, 'image');
            this._updateImage(imageElement);
            contentElement.appendChild(imageElement);

            var defsElement = document.createElementNS(SVGNS, 'defs');
            contentElement.appendChild(defsElement);

            var spotsGroupElement = document.createElementNS(SVGNS, 'g');
            spotsGroupElement.setAttribute('id', 'spots');
            var labelsGroupElement = document.createElementNS(SVGNS, 'g');
            labelsGroupElement.setAttribute('id', 'labels');
            labelsGroupElement.setAttribute('font-size', this._fontSize);
            labelsGroupElement.setAttribute('fill', this._fontColor);
            labelsGroupElement.setAttribute('visibility', this._fontSize ? 'visible' : 'collapsed');
            contentElement.appendChild(spotsGroupElement);
            contentElement.appendChild(labelsGroupElement);

            if (this._spots) {
                this._createSpots(
                        spotsGroupElement, labelsGroupElement, defsElement);
            }
        }
    },

    spotBorder: {
        get: function() {
            return this._spotBorder;
        },

        set: function(value) {
            if (this._spotBorder == value) return;
            if (value < 0.0) value = 0.0;
            if (value > 1.0) value = 1.0;
            this._spotBorder = value;
            if (this._spots) this._updateSpots();
        }
    },

    spots: {
        get: function() {
            return this._spots;
        },

        set: function(value) {
            if (value) {
                this._spots = value.map(function(s) {
                    return {
                        x: s.x,
                        y: s.y,
                        r: s.r,
                        name: s.name,
                        intensity: s.intensity,
                    };
                });
            } else {
                this._spots = null;
                return;
            }

            for (var i = 0; i < this._views.length; i++) {
                var c = this._views[i].contentElement;
                var spotsGroupElement = c.querySelector('#spots');
                var labelsGroupElement = c.querySelector('#labels');
                var defsElement = c.querySelector('defs');
                spotsGroupElement.textContent = '';
                labelsGroupElement.textContent = '';
                defsElement.textContent = '';
                if (this._spots) {
                    this._createSpots(
                                    spotsGroupElement, labelsGroupElement, defsElement);
                }
            }
        }
    },

    updateIntensities: {
        value: function(spots) {
            if (!this._spots) return;

            for (var i = 0; i < this._spots.length; i++) {
                this._spots[i].intensity = spots[i] && spots[i].intensity;
            }
            this._updateSpots();
        }
    },

    colorMap: {
        get: function() {
            return this._colorMap;
        },

        set: function(value) {
            this._colorMap = value;
            if (this._spots) this._updateSpots();
        }
    },

    fontSize: {
        get: function() {
            return this._fontSize;
        },

        set: function(value) {
            this._fontSize = Number(value);
            this._forContentElement(function(contentElement) {
                var labelsElement = contentElement.querySelector('#labels');
                labelsElement.setAttribute('font-size', value);
                labelsElement.setAttribute('visibility', value ? 'visible' : 'collapsed');
            });
        }
    },

    fontColor: {
        get: function() {
            return this._fontColor;
        },

        set: function(value) {
            this._fontColor = value;
            this._forContentElement(function(contentElement) {
                var labelsElement = contentElement.querySelector('#labels');
                labelsElement.setAttribute('fill', value);
            });
        }
    },

    exportImage: {
        value: function(canvas) {
            return new Promise(function(accept, reject) {
                if (!this._imageURL) {
                    reject();
                    return;
                }
                var image = new Image();
                image.width = this.width;
                image.height = this.height;
                image.onload = function() {
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(image, 0, 0);
                    accept();
                };
                image.onerror = function(event) {
                    console.log('Failed to load SVG', event);
                    reject();
                }
                image.src = this._imageURL;
            }.bind(this));
        }
    },

    exportSpots: {
        value: function(canvas) {
            return new Promise(function(accept, reject) {
                if (!this.width || !this.height) {
                    reject();
                    return;
                }

                var SVGNS = 'http://www.w3.org/2000/svg';
                var svgElement = document.createElementNS(SVGNS, 'svg');
                this._buildContent(svgElement);
                svgElement.removeChild(svgElement.querySelector('image'));
                var source =
                        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                        this.width + '" height="' + this.height + '">' +
                        svgElement.innerHTML +
                        '</svg>';
                var blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
                var image = new Image();
                image.width = this.width;
                image.height = this.height;
                image.onload = function() {
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(image, 0, 0);
                    URL.revokeObjectURL(image.src);
                    accept();
                };
                image.onerror = function(event) {
                    URL.revokeObjectURL(image.src);
                    console.log('Failed to load SVG', event);
                    reject();
                }
                image.src = URL.createObjectURL(blob);
            }.bind(this));
        }
    },

    _updateSpots: {
        value: function() {
            this._forContentElement(function(contentElement) {
                this._updateSpotsGradients(contentElement.querySelector('defs'));
            }.bind(this));
        }
    },

    _updateSpotsGradients: {
        value: function(defsElement) {
            var startTime = new Date();

            var intensityColor = new THREE.Color();
            for (var i = 0; i < defsElement.childElementCount; i++) {
                var g = defsElement.children[i];
                var stop0 = g.children[0];
                var stop1 = g.children[1];

                var spot = this._spots[i];
                if (spot && !isNaN(spot.intensity)) {
                    this._colorMap.map(intensityColor, spot.intensity);
                    stop0.style.stopColor = stop1.style.stopColor =
                            intensityColor.getStyle();
                    stop0.style.stopOpacity = 1.0;
                    stop1.style.stopOpacity = this._spotBorder;
                } else {
                    stop0.style.stopColor = stop1.style.stopColor = '';
                    stop0.style.stopOpacity = stop1.style.stopOpacity = 0;
                }
            }

            var endTime = new Date();
            console.log('Recoloring time: ' +
                    (endTime.valueOf() - startTime.valueOf()) / 1000);
        }
    },

    _createSpots: {
        value: function(spotsGrpupElement, lablesGroupElement, defsElement) {
            var SVGNS = 'http://www.w3.org/2000/svg';

            var document = spotsGrpupElement.ownerDocument;

            for (var i = 0; i < this._spots.length; i++) {
                var spot = this._spots[i];

                var gradientElement = document.createElementNS(
                    SVGNS, 'radialGradient');
                gradientElement.cx.baseVal = "50%";
                gradientElement.cy.baseVal = "50%";
                gradientElement.r.baseVal = "50%";
                gradientElement.fx.baseVal = "50%";
                gradientElement.fy.baseVal = "50%";
                gradientElement.id = "spot" + i;

                gradientElement.innerHTML = '<stop offset="0%" />' +
                                            '<stop offset="100%" />';
                defsElement.appendChild(gradientElement);

                var spotElement = document.createElementNS(SVGNS, 'ellipse');
                spotElement.rx.baseVal.value = spot.r;
                spotElement.ry.baseVal.value = spot.r;
                spotElement.cx.baseVal.value = spot.x;
                spotElement.cy.baseVal.value = spot.y;
                spotElement.style.fill = 'url(#spot' + i + ')';
                spotsGrpupElement.appendChild(spotElement);

                var labelElement = document.createElementNS(SVGNS, 'text');
                labelElement.textContent = spot.name;
                labelElement.setAttribute('x', spot.x + 5);
                labelElement.setAttribute('y', spot.y);
                lablesGroupElement.appendChild(labelElement);
            }

            this._updateSpotsGradients(defsElement);
        }
    },

    _forContentElement: {
        value: function(fn) {
            for (var i = 0; i < this._views.length; i++) {
                fn(this._views[i].contentElement);
            }
        }
    },
});