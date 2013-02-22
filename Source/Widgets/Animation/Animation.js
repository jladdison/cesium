/*global define*/
define(['../../Core/destroyObject',
        '../../Core/DeveloperError',
        '../../Core/ClockStep',
        '../../Core/Color',
        '../../Core/defaultValue',
        '../../ThirdParty/sprintf'
        ], function(
         destroyObject,
         DeveloperError,
         ClockStep,
         Color,
         defaultValue,
         sprintf) {
    "use strict";

    var svgNS = "http://www.w3.org/2000/svg";
    var xlinkNS = "http://www.w3.org/1999/xlink";

    var widgetForDrag;

    var gradientEnabledColor0 = Color.fromCssColorString('rgba(247,250,255,0.384)');
    var gradientEnabledColor1 = Color.fromCssColorString('rgba(143,191,255,0.216)');
    var gradientEnabledColor2 = Color.fromCssColorString('rgba(153,197,255,0.098)');
    var gradientEnabledColor3 = Color.fromCssColorString('rgba(255,255,255,0.086)');

    var gradientDisabledColor0 = Color.fromCssColorString('rgba(255,255,255,0.267)');
    var gradientDisabledColor1 = Color.fromCssColorString('rgba(255,255,255,0)');

    var gradientKnobColor = Color.fromCssColorString('rgba(66,67,68,0.3)');
    var gradientPointerColor = Color.fromCssColorString('rgba(0,0,0,0.5)');

    function getElementColor(element) {
        return Color.fromCssColorString(window.getComputedStyle(element).getPropertyValue('color'));
    }

    function subscribeAndEvaluate(observable, callback, target) {
        callback.call(target, observable());
        return observable.subscribe(callback, target);
    }

    //Dynamically builds an SVG element from a JSON object.
    function svgFromObject(obj) {
        var ele = document.createElementNS(svgNS, obj.tagName);
        for ( var field in obj) {
            if (obj.hasOwnProperty(field) && field !== 'tagName') {
                if (field === 'children') {
                    var i;
                    var len = obj.children.length;
                    for (i = 0; i < len; ++i) {
                        ele.appendChild(svgFromObject(obj.children[i]));
                    }
                } else if (field.indexOf('xlink:') === 0) {
                    ele.setAttributeNS(xlinkNS, field.substring(6), obj[field]);
                } else if (field === 'textContent') {
                    ele.textContent = obj[field];
                } else {
                    ele.setAttribute(field, obj[field]);
                }
            }
        }
        return ele;
    }

    function svgText(x, y, msg) {
        var text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('class', 'animation-svgText');

        var tspan = document.createElementNS(svgNS, 'tspan');
        tspan.textContent = msg;
        text.appendChild(tspan);
        return text;
    }

    function setShuttleRingPointer(shuttleRingPointer, knobOuter, angle) {
        shuttleRingPointer.setAttribute('transform', 'translate(100,100) rotate(' + angle + ')');
        knobOuter.setAttribute('transform', 'rotate(' + angle + ')');
    }

    var makeColorStringScratch = new Color();
    function makeColorString(background, gradient) {
        var gradientAlpha = gradient.alpha;
        var backgroundAlpha = 1.0 - gradientAlpha;
        makeColorStringScratch.red = (background.red * backgroundAlpha) + (gradient.red * gradientAlpha);
        makeColorStringScratch.green = (background.green * backgroundAlpha) + (gradient.green * gradientAlpha);
        makeColorStringScratch.blue = (background.blue * backgroundAlpha) + (gradient.blue * gradientAlpha);
        return makeColorStringScratch.toCssColorString();
    }

    function rectButton(x, y, path) {
        var button = {
            tagName : 'g',
            'class' : 'animation-rectButton',
            transform : 'translate(' + x + ',' + y + ')',
            children : [{
                tagName : 'rect',
                'class' : 'animation-buttonGlow',
                width : 32,
                height : 32,
                rx : 2,
                ry : 2
            }, {
                tagName : 'rect',
                'class' : 'animation-buttonMain',
                width : 32,
                height : 32,
                rx : 4,
                ry : 4
            }, {
                tagName : 'use',
                'class' : 'animation-buttonPath',
                'xlink:href' : path
            }, {
                tagName : 'title',
                textContent : ''
            }]
        };
        return svgFromObject(button);
    }

    function wingButton(x, y, path) {
        var button = {
            tagName : 'g',
            'class' : 'animation-rectButton',
            transform : 'translate(' + x + ',' + y + ')',
            children : [{
                tagName : 'use',
                'class' : 'animation-buttonGlow',
                'xlink:href' : '#animation_pathWingButton'
            }, {
                tagName : 'use',
                'class' : 'animation-buttonMain',
                'xlink:href' : '#animation_pathWingButton'
            }, {
                tagName : 'use',
                'class' : 'animation-buttonPath',
                'xlink:href' : path
            }, {
                tagName : 'title',
                textContent : ''
            }]
        };
        return svgFromObject(button);
    }

    function setShuttleRingFromMouse(widget, e) {
        var viewModel = widget.viewModel;
        var shuttleRingDragging = viewModel.shuttleRingDragging();

        if (shuttleRingDragging && (widgetForDrag !== widget)) {
            return;
        }

        if (e.type === 'mousedown' || (shuttleRingDragging && e.type === 'mousemove')) {
            var centerX = widget._centerX;
            var centerY = widget._centerY;
            var svg = widget._svgNode;
            var rect = svg.getBoundingClientRect();
            var clientX = e.clientX;
            var clientY = e.clientY;

            if (!shuttleRingDragging &&
                (clientX > rect.right ||
                 clientX < rect.left ||
                 clientY < rect.top ||
                 clientY > rect.bottom)) {
                return;
            }

            var pointerRect = widget._shuttleRingPointer.getBoundingClientRect();

            var x = clientX - centerX - rect.left;
            var y = clientY - centerY - rect.top;

            var angle = Math.atan2(y, x) * 180 / Math.PI + 90;
            if (angle > 180) {
                angle -= 360;
            }
            var shuttleRingAngle = viewModel.shuttleRingAngle();
            if (shuttleRingDragging || (clientX < pointerRect.right && clientX > pointerRect.left && clientY > pointerRect.top && clientY < pointerRect.bottom)) {
                widgetForDrag = widget;
                viewModel.shuttleRingDragging(true);
                viewModel.shuttleRingAngle(angle);
            } else if (angle < shuttleRingAngle) {
                viewModel.slower();
            } else if (angle > shuttleRingAngle) {
                viewModel.faster();
            }
            e.preventDefault();
            e.stopPropagation();
        } else {
            widgetForDrag = undefined;
            viewModel.shuttleRingDragging(false);
        }
    }

    //This is a private class for treating an SVG element like a button.
    //If we ever need a general purpose SVG button, we can make this generic.
    var SvgButton = function(svgElement, viewModel) {
        this.viewModel = viewModel;
        this.svgElement = svgElement;
        this._enabled = undefined;
        this._toggled = undefined;

        var that = this;
        svgElement.addEventListener('click', function() {
            var command = that.viewModel.command;
            if (command.canExecute()) {
                command();
            }
        }, true);

        //TODO: Since the animation widget uses SVG and has no HTML backing,
        //we need to wire everything up manually.  Knockout can supposedly
        //bind to SVG, so we we figure that out we can modify our SVG
        //to include the binding information directly.

        this._subscriptions = [//
        subscribeAndEvaluate(viewModel.toggled, this.setToggled, this),//
        subscribeAndEvaluate(viewModel.tooltip, this.setToolTip, this),//
        subscribeAndEvaluate(viewModel.command.canExecute, this.setEnabled, this)];
    };

    SvgButton.prototype.destroy = function() {
        var subscriptions = this._subscriptions;
        for ( var i = 0, len = subscriptions.length; i < len; i++) {
            subscriptions[i].dispose();
        }
        destroyObject(this);
    };

    SvgButton.prototype.isDestroyed = function() {
        return false;
    };

    SvgButton.prototype.setEnabled = function(enabled) {
        if (this._enabled !== enabled) {
            this._enabled = enabled;

            if (!enabled) {
                this.svgElement.setAttribute('class', 'animation-buttonDisabled');
                return;
            }

            if (this._toggled) {
                this.svgElement.setAttribute('class', 'animation-rectButton animation-buttonToggled');
                return;
            }

            this.svgElement.setAttribute('class', 'animation-rectButton');
        }
    };

    SvgButton.prototype.setToggled = function(toggled) {
        if (this._toggled !== toggled) {
            this._toggled = toggled;

            if (this._enabled) {
                if (toggled) {
                    this.svgElement.setAttribute('class', 'animation-rectButton animation-buttonToggled');
                } else {
                    this.svgElement.setAttribute('class', 'animation-rectButton');
                }
            }
        }
    };

    SvgButton.prototype.setToolTip = function(tooltip) {
        this.svgElement.getElementsByTagName('title')[0].textContent = tooltip;
    };

    function resize(that) {
        var svg = that._svgNode;

        //The width and height as the SVG was originally drawn.
        var baseWidth = 200;
        var baseHeight = 132;

        var parentWidth = defaultValue(that.parentNode.clientWidth, 0);
        var parentHeight = defaultValue(that.parentNode.clientHeight, 0);

        var width = parentWidth;
        var height = parentHeight;

        if (parentWidth === 0 && parentHeight === 0) {
            width = baseWidth;
            height = baseHeight;
        } else if (parentWidth === 0) {
            height = parentHeight;
            width = baseWidth * (parentHeight / baseHeight);
        } else if (parentHeight === 0) {
            width = parentWidth;
            height = baseHeight * (parentWidth / baseWidth);
        }

        var scaleX = width / baseWidth;
        var scaleY = height / baseHeight;

        svg.style.cssText = 'width: ' + width + 'px; height: ' + height + 'px; position: absolute; bottom: 0; left: 0;';
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

        that._topG.setAttribute('transform', 'scale(' + scaleX + ',' + scaleY + ')');

        that._centerX = Math.max(1, 100.0 * scaleX);
        that._centerY = Math.max(1, 100.0 * scaleY);
    }

    /**
     * <span style="display: block; text-align: center;">
     * <img src="images/AnimationWidget.png" width="211" height="142" alt="" style="border: none; border-radius: 5px;" />
     * <br />Animation widget
     * </span>
     * <br /><br />
     * The Animation widget provides buttons for play, pause, and reverse, along with the
     * current time and date, surrounded by a "shuttle ring" for controlling the speed of animation.
     * <br /><br />
     * The "shuttle ring" concept is borrowed from video editing, where typically a
     * "jog wheel" can be rotated to move past individual animation frames very slowly, and
     * a surrounding shuttle ring can be twisted to control direction and speed of fast playback.
     * Cesium typically treats time as continuous (not broken into pre-defined animation frames),
     * so this widget offers no jog wheel.  Instead, the shuttle ring is capable of both fast and
     * very slow playback.  Click and drag the shuttle ring pointer itself (shown above in green),
     * or click in the rest of the ring area to nudge the pointer to the next preset speed in that direction.
     * <br /><br />
     * The Animation widget also provides a "realtime" button (in the upper-left) that keeps
     * animation time in sync with the end user's system clock, typically displaying
     * "today" or "right now."  This mode is not available in {@link ClockRange.CLAMPED} or
     * {@link ClockRange.LOOP_STOP} mode if the current time is outside of {@link Clock}'s startTime and endTime.
     *
     * @alias Animation
     * @constructor
     *
     * @param {DOM Node} parentNode The parent HTML DOM node for this widget.
     * @param {AnimationViewModel} viewModel The ViewModel used by this widget.
     *
     * @exception {DeveloperError} parentNode is required.
     * @exception {DeveloperError} viewModel is required.
     *
     * @see AnimationViewModel
     * @see Clock
     *
     * @example
     * // In HTML head, include a link to Animation.css stylesheet,
     * // and in the body, include: &lt;div id="animationWidget"&gt;&lt;/div&gt;
     *
     * var clock = new Clock();
     * var clockViewModel = new ClockViewModel(clock);
     * var viewModel = new AnimationViewModel(clockViewModel);
     * var parentNode = document.getElementById("animationWidget");
     * var widget = new Animation(parentNode, viewModel);
     *
     * function tick() {
     *     clock.tick();
     *     Cesium.requestAnimationFrame(tick);
     * }
     * Cesium.requestAnimationFrame(tick);
     */
    var Animation = function(parentNode, viewModel) {
        if (typeof parentNode === 'undefined') {
            throw new DeveloperError('parentNode is required.');
        }

        if (typeof viewModel === 'undefined') {
            throw new DeveloperError('viewModel is required.');
        }

        /**
         * The viewModel
         */
        this.viewModel = viewModel;

        /**
         * The parent HTML DOM node for this widget.
         */
        this.parentNode = parentNode;

        this._centerX = 0;
        this._centerY = 0;
        this._defsElement = undefined;
        this._svgNode = undefined;
        this._topG = undefined;

        // Firefox requires SVG references to be included directly, not imported from external CSS.
        // Also, CSS minifiers get confused by this being in an external CSS file.
        var cssStyle = document.createElement('style');
        cssStyle.textContent = //
        '.animation-rectButton .animation-buttonGlow { filter: url(#animation_blurred); }\n' + //
        '.animation-rectButton .animation-buttonMain { fill: url(#animation_buttonNormal); }\n' + //
        '.animation-buttonToggled .animation-buttonMain { fill: url(#animation_buttonToggled); }\n' + //
        '.animation-rectButton:hover .animation-buttonMain { fill: url(#animation_buttonHovered); }\n' + //
        '.animation-buttonDisabled .animation-buttonMain { fill: url(#animation_buttonDisabled); }\n' + //
        '.animation-shuttleRingG .animation-shuttleRingSwoosh { fill: url(#animation_shuttleRingSwooshGradient); }\n' + //
        '.animation-shuttleRingG:hover .animation-shuttleRingSwoosh { fill: url(#animation_shuttleRingSwooshHovered); }\n' + //
        '.animation-shuttleRingPointer { fill: url(#animation_shuttleRingPointerGradient); }\n' + //
        '.animation-shuttleRingPausePointer { fill: url(#animation_shuttleRingPointerPaused); }\n' + //
        '.animation-knobOuter { fill: url(#animation_knobOuter); }\n' + //
        '.animation-knobInner { fill: url(#animation_knobInner); }\n';

        document.head.insertBefore(cssStyle, document.head.childNodes[0]);

        var themeEle = document.createElement('div');
        themeEle.className = 'animation-theme';
        themeEle.innerHTML = '<div class="animation-themeNormal"></div>' + //
        '<div class="animation-themeHover"></div>' + //
        '<div class="animation-themeSelect"></div>' + //
        '<div class="animation-themeDisabled"></div>' + //
        '<div class="animation-themeKnob"></div>' + //
        '<div class="animation-themePointer"></div>' + //
        '<div class="animation-themeSwoosh"></div>' + //
        '<div class="animation-themeSwooshHover"></div>';

        this._theme = themeEle;
        this._themeNormal = themeEle.childNodes[0];
        this._themeHover = themeEle.childNodes[1];
        this._themeSelect = themeEle.childNodes[2];
        this._themeDisabled = themeEle.childNodes[3];
        this._themeKnob = themeEle.childNodes[4];
        this._themePointer = themeEle.childNodes[5];
        this._themeSwoosh = themeEle.childNodes[6];
        this._themeSwooshHover = themeEle.childNodes[7];

        var svg = document.createElementNS(svgNS, 'svg:svg');
        this._svgNode = svg;

        // Define the XLink namespace that SVG uses
        svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', xlinkNS);

        var topG = document.createElementNS(svgNS, 'g');
        this._topG = topG;

        this._realtimeSVG = new SvgButton(wingButton(3, 4, '#animation_pathClock'), viewModel.playRealtimeViewModel);
        this._playReverseSVG = new SvgButton(rectButton(44, 99, '#animation_pathPlayReverse'), viewModel.playReverseViewModel);
        this._playForwardSVG = new SvgButton(rectButton(124, 99, '#animation_pathPlay'), viewModel.playForwardViewModel);
        this._pauseSVG = new SvgButton(rectButton(84, 99, '#animation_pathPause'), viewModel.pauseViewModel);

        var buttonsG = document.createElementNS(svgNS, 'g');
        buttonsG.appendChild(this._realtimeSVG.svgElement);
        buttonsG.appendChild(this._playReverseSVG.svgElement);
        buttonsG.appendChild(this._playForwardSVG.svgElement);
        buttonsG.appendChild(this._pauseSVG.svgElement);

        var shuttleRingBackPanel = svgFromObject({
            tagName : 'circle',
            'class' : 'animation-shuttleRingBack',
            cx : 100,
            cy : 100,
            r : 99
        });

        var shuttleRingSwooshG = svgFromObject({
            tagName : 'g',
            'class' : 'animation-shuttleRingSwoosh',
            children : [{
                tagName : 'use',
                transform : 'translate(100,97) scale(-1,1)',
                'xlink:href' : '#animation_pathSwooshFX'
            }, {
                tagName : 'use',
                transform : 'translate(100,97)',
                'xlink:href' : '#animation_pathSwooshFX'
            }, {
                tagName : 'line',
                x1 : 100,
                y1 : 8,
                x2 : 100,
                y2 : 22
            }]
        });

        this._shuttleRingPointer = svgFromObject({
            tagName : 'use',
            'class' : 'animation-shuttleRingPointer',
            'xlink:href' : '#animation_pathPointer'
        });

        var knobG = svgFromObject({
            tagName : 'g',
            transform : 'translate(100,100)'
        });

        this._knobOuter = svgFromObject({
            tagName : 'circle',
            'class' : 'animation-knobOuter',
            cx : 0,
            cy : 0,
            r : 71
        });

        var knobInnerAndShieldSize = 61;

        var knobInner = svgFromObject({
            tagName : 'circle',
            'class' : 'animation-knobInner',
            cx : 0,
            cy : 0,
            r : knobInnerAndShieldSize
        });

        this._knobDate = svgText(0, -24, '');
        this._knobTime = svgText(0, -7, '');
        this._knobStatus = svgText(0, -41, '');

        // widget shield catches clicks on the knob itself (even while DOM elements underneath are changing).
        var knobShield = svgFromObject({
            tagName : 'circle',
            'class' : 'animation-blank',
            cx : 0,
            cy : 0,
            r : knobInnerAndShieldSize
        });

        var shuttleRingBackG = document.createElementNS(svgNS, 'g');
        shuttleRingBackG.setAttribute('class', 'animation-shuttleRingG');

        parentNode.appendChild(themeEle);
        topG.appendChild(shuttleRingBackG);
        topG.appendChild(knobG);
        topG.appendChild(buttonsG);

        shuttleRingBackG.appendChild(shuttleRingBackPanel);
        shuttleRingBackG.appendChild(shuttleRingSwooshG);
        shuttleRingBackG.appendChild(this._shuttleRingPointer);

        knobG.appendChild(this._knobOuter);
        knobG.appendChild(knobInner);
        knobG.appendChild(this._knobDate);
        knobG.appendChild(this._knobTime);
        knobG.appendChild(this._knobStatus);
        knobG.appendChild(knobShield);

        svg.appendChild(topG);
        parentNode.appendChild(svg);

        var that = this;

        window.addEventListener('resize', function() {
            resize(that);
        }, true);

        var callBack = function(e) {
            setShuttleRingFromMouse(that, e);
        };
        shuttleRingBackPanel.addEventListener('mousedown', callBack, true);
        shuttleRingSwooshG.addEventListener('mousedown', callBack, true);
        document.addEventListener('mousemove', callBack, true);
        document.addEventListener('mouseup', callBack, true);
        this._shuttleRingPointer.addEventListener('mousedown', callBack, true);
        this._knobOuter.addEventListener('mousedown', callBack, true);

        //TODO: Since the animation widget uses SVG and has no HTML backing,
        //we need to wire everything up manually.  Knockout can supposedly
        //bind to SVG, so we we figure that out we can modify our SVG
        //to include the binding information directly.

        this._subscriptions = [//
        subscribeAndEvaluate(viewModel.pauseViewModel.toggled, function(value) {
            if (value) {
                that._shuttleRingPointer.setAttribute('class', 'animation-shuttleRingPausePointer');
            } else {
                that._shuttleRingPointer.setAttribute('class', 'animation-shuttleRingPointer');
            }
        }),

        subscribeAndEvaluate(viewModel.shuttleRingAngle, function(value) {
            setShuttleRingPointer(that._shuttleRingPointer, that._knobOuter, value);
        }),

        subscribeAndEvaluate(viewModel.dateLabel, function(value) {
            that._knobDate.childNodes[0].textContent = value;
        }),

        subscribeAndEvaluate(viewModel.timeLabel, function(value) {
            that._knobTime.childNodes[0].textContent = value;
        }),

        subscribeAndEvaluate(viewModel.multiplierLabel, function(value) {
            that._knobStatus.childNodes[0].textContent = value;
        })];

        this.applyThemeChanges();
        resize(this);
    };

    /**
     * Destroys the animation widget.  Should be called if permanently
     * removing the widget from layout.
     * @memberof Animation
     */
    Animation.prototype.destroy = function() {
        this.parentNode.removeChild(this._svgNode);
        this.parentNode.removeChild(this._theme);
        this._realtimeSVG.destroy();
        this._playReverseSVG.destroy();
        this._playForwardSVG.destroy();
        this._pauseSVG.destroy();

        var subscriptions = this._subscriptions;
        for ( var i = 0, len = subscriptions.length; i < len; i++) {
            subscriptions[i].dispose();
        }

        return destroyObject(this);
    };

    /**
     * @memberof Animation
     *
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    Animation.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Updates the widget to reflect any modified CSS fules for themeing.
     * @memberof Animation
     *
     * @example
     * //Switch to the cesium-darker theme.
     * document.body.className = 'cesium-darker';
     * animation.applyThemeChanges();
     */
    Animation.prototype.applyThemeChanges = function() {
        var buttonNormalBackColor = getElementColor(this._themeNormal);
        var buttonHoverBackColor = getElementColor(this._themeHover);
        var buttonToggledBackColor = getElementColor(this._themeSelect);
        var buttonDisabledBackColor = getElementColor(this._themeDisabled);
        var knobBackColor = getElementColor(this._themeKnob);
        var pointerColor = getElementColor(this._themePointer);
        var swooshColor = getElementColor(this._themeSwoosh);
        var swooshHoverColor = getElementColor(this._themeSwooshHover);

        var defsElement = svgFromObject({
            tagName : 'defs',
            children : [{
                id : 'animation_buttonNormal',
                tagName : 'linearGradient',
                x1 : '50%',
                y1 : '0%',
                x2 : '50%',
                y2 : '100%',
                children : [
                //add a 'stop-opacity' field to make translucent.
                {
                    tagName : 'stop',
                    offset : '0%',
                    'stop-color' : makeColorString(buttonNormalBackColor, gradientEnabledColor0)
                }, {
                    tagName : 'stop',
                    offset : '12%',
                    'stop-color' : makeColorString(buttonNormalBackColor, gradientEnabledColor1)
                }, {
                    tagName : 'stop',
                    offset : '46%',
                    'stop-color' : makeColorString(buttonNormalBackColor, gradientEnabledColor2)
                }, {
                    tagName : 'stop',
                    offset : '81%',
                    'stop-color' : makeColorString(buttonNormalBackColor, gradientEnabledColor3)
                }]
            }, {
                id : 'animation_buttonHovered',
                tagName : 'linearGradient',
                x1 : '50%',
                y1 : '0%',
                x2 : '50%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-color' : makeColorString(buttonHoverBackColor, gradientEnabledColor0)
                }, {
                    tagName : 'stop',
                    offset : '12%',
                    'stop-color' : makeColorString(buttonHoverBackColor, gradientEnabledColor1)
                }, {
                    tagName : 'stop',
                    offset : '46%',
                    'stop-color' : makeColorString(buttonHoverBackColor, gradientEnabledColor2)
                }, {
                    tagName : 'stop',
                    offset : '81%',
                    'stop-color' : makeColorString(buttonHoverBackColor, gradientEnabledColor3)
                }]
            }, {
                id : 'animation_buttonToggled',
                tagName : 'linearGradient',
                x1 : '50%',
                y1 : '0%',
                x2 : '50%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-color' : makeColorString(buttonToggledBackColor, gradientEnabledColor0)
                }, {
                    tagName : 'stop',
                    offset : '12%',
                    'stop-color' : makeColorString(buttonToggledBackColor, gradientEnabledColor1)
                }, {
                    tagName : 'stop',
                    offset : '46%',
                    'stop-color' : makeColorString(buttonToggledBackColor, gradientEnabledColor2)
                }, {
                    tagName : 'stop',
                    offset : '81%',
                    'stop-color' : makeColorString(buttonToggledBackColor, gradientEnabledColor3)
                }]
            }, {
                id : 'animation_buttonDisabled',
                tagName : 'linearGradient',
                x1 : '50%',
                y1 : '0%',
                x2 : '50%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-color' : makeColorString(buttonDisabledBackColor, gradientDisabledColor0)
                }, {
                    tagName : 'stop',
                    offset : '75%',
                    'stop-color' : makeColorString(buttonDisabledBackColor, gradientDisabledColor1)
                }]
            }, {
                id : 'animation_blurred',
                tagName : 'filter',
                width : '200%',
                height : '200%',
                x : '-50%',
                y : '-50%',
                children : [{
                    tagName : 'feGaussianBlur',
                    stdDeviation : 4,
                    'in' : 'SourceGraphic'
                }]
            }, {
                id : 'animation_shuttleRingSwooshGradient',
                tagName : 'linearGradient',
                x1 : '50%',
                y1 : '0%',
                x2 : '50%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-opacity' : 0.2,
                    'stop-color' : swooshColor.toCssColorString()
                }, {
                    tagName : 'stop',
                    offset : '85%',
                    'stop-opacity' : 0.85,
                    'stop-color' : swooshColor.toCssColorString()
                }, {
                    tagName : 'stop',
                    offset : '95%',
                    'stop-opacity' : 0.05,
                    'stop-color' : swooshColor.toCssColorString()
                }]
            }, {
                id : 'animation_shuttleRingSwooshHovered',
                tagName : 'linearGradient',
                x1 : '50%',
                y1 : '0%',
                x2 : '50%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-opacity' : 0.2,
                    'stop-color' : swooshHoverColor.toCssColorString()
                }, {
                    tagName : 'stop',
                    offset : '85%',
                    'stop-opacity' : 0.85,
                    'stop-color' : swooshHoverColor.toCssColorString()
                }, {
                    tagName : 'stop',
                    offset : '95%',
                    'stop-opacity' : 0.05,
                    'stop-color' : swooshHoverColor.toCssColorString()
                }]
            }, {
                id : 'animation_shuttleRingPointerGradient',
                tagName : 'linearGradient',
                x1 : '0%',
                y1 : '50%',
                x2 : '100%',
                y2 : '50%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-color' : pointerColor.toCssColorString()
                }, {
                    tagName : 'stop',
                    offset : '40%',
                    'stop-color' : pointerColor.toCssColorString()
                }, {
                    tagName : 'stop',
                    offset : '60%',
                    'stop-color' : makeColorString(pointerColor, gradientPointerColor)
                }, {
                    tagName : 'stop',
                    offset : '100%',
                    'stop-color' : makeColorString(pointerColor, gradientPointerColor)
                }]
            }, {
                id : 'animation_shuttleRingPointerPaused',
                tagName : 'linearGradient',
                x1 : '0%',
                y1 : '50%',
                x2 : '100%',
                y2 : '50%',
                children : [{
                    tagName : 'stop',
                    offset : '0%',
                    'stop-color' : '#CCC'
                }, {
                    tagName : 'stop',
                    offset : '40%',
                    'stop-color' : '#CCC'
                }, {
                    tagName : 'stop',
                    offset : '60%',
                    'stop-color' : '#555'
                }, {
                    tagName : 'stop',
                    offset : '100%',
                    'stop-color' : '#555'
                }]
            }, {
                id : 'animation_knobOuter',
                tagName : 'linearGradient',
                x1 : '20%',
                y1 : '0%',
                x2 : '90%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '5%',
                    'stop-color' : makeColorString(knobBackColor, gradientEnabledColor0)
                }, {
                    tagName : 'stop',
                    offset : '60%',
                    'stop-color' : makeColorString(knobBackColor, gradientKnobColor)
                }, {
                    tagName : 'stop',
                    offset : '85%',
                    'stop-color' : makeColorString(knobBackColor, gradientEnabledColor1)
                }]
            }, {
                id : 'animation_knobInner',
                tagName : 'linearGradient',
                x1 : '20%',
                y1 : '0%',
                x2 : '90%',
                y2 : '100%',
                children : [{
                    tagName : 'stop',
                    offset : '5%',
                    'stop-color' : makeColorString(knobBackColor, gradientKnobColor)
                }, {
                    tagName : 'stop',
                    offset : '60%',
                    'stop-color' : makeColorString(knobBackColor, gradientEnabledColor0)
                }, {
                    tagName : 'stop',
                    offset : '85%',
                    'stop-color' : makeColorString(knobBackColor, gradientEnabledColor3)
                }]
            }, {
                id : 'animation_pathReset',
                tagName : 'path',
                transform : 'translate(16,16) scale(0.85) translate(-16,-16)',
                d : 'M24.316,5.318,9.833,13.682,9.833,5.5,5.5,5.5,5.5,25.5,9.833,25.5,9.833,17.318,24.316,25.682z'
            }, {
                id : 'animation_pathPause',
                tagName : 'path',
                transform : 'translate(16,16) scale(0.85) translate(-16,-16)',
                d : 'M13,5.5,7.5,5.5,7.5,25.5,13,25.5zM24.5,5.5,19,5.5,19,25.5,24.5,25.5z'
            }, {
                id : 'animation_pathPlay',
                tagName : 'path',
                transform : 'translate(16,16) scale(0.85) translate(-16,-16)',
                d : 'M6.684,25.682L24.316,15.5L6.684,5.318V25.682z'
            }, {
                id : 'animation_pathPlayReverse',
                tagName : 'path',
                transform : 'translate(16,16) scale(-0.85,0.85) translate(-16,-16)',
                d : 'M6.684,25.682L24.316,15.5L6.684,5.318V25.682z'
            }, {
                id : 'animation_pathLoop',
                tagName : 'path',
                transform : 'translate(16,16) scale(0.85) translate(-16,-16)',
                d : 'M24.249,15.499c-0.009,4.832-3.918,8.741-8.75,8.75c-2.515,0-4.768-1.064-6.365-2.763l2.068-1.442l-7.901-3.703l0.744,8.694l2.193-1.529c2.244,2.594,5.562,4.242,9.26,4.242c6.767,0,12.249-5.482,12.249-12.249H24.249zM15.499,6.75c2.516,0,4.769,1.065,6.367,2.764l-2.068,1.443l7.901,3.701l-0.746-8.693l-2.192,1.529c-2.245-2.594-5.562-4.245-9.262-4.245C8.734,3.25,3.25,8.734,3.249,15.499H6.75C6.758,10.668,10.668,6.758,15.499,6.75z'
            }, {
                id : 'animation_pathClock',
                tagName : 'path',
                transform : 'translate(16,16) scale(0.85) translate(-16,-15.5)',
                d : 'M15.5,2.374C8.251,2.375,2.376,8.251,2.374,15.5C2.376,22.748,8.251,28.623,15.5,28.627c7.249-0.004,13.124-5.879,13.125-13.127C28.624,8.251,22.749,2.375,15.5,2.374zM15.5,25.623C9.909,25.615,5.385,21.09,5.375,15.5C5.385,9.909,9.909,5.384,15.5,5.374c5.59,0.01,10.115,4.535,10.124,10.125C25.615,21.09,21.091,25.615,15.5,25.623zM8.625,15.5c-0.001-0.552-0.448-0.999-1.001-1c-0.553,0-1,0.448-1,1c0,0.553,0.449,1,1,1C8.176,16.5,8.624,16.053,8.625,15.5zM8.179,18.572c-0.478,0.277-0.642,0.889-0.365,1.367c0.275,0.479,0.889,0.641,1.365,0.365c0.479-0.275,0.643-0.887,0.367-1.367C9.27,18.461,8.658,18.297,8.179,18.572zM9.18,10.696c-0.479-0.276-1.09-0.112-1.366,0.366s-0.111,1.09,0.365,1.366c0.479,0.276,1.09,0.113,1.367-0.366C9.821,11.584,9.657,10.973,9.18,10.696zM22.822,12.428c0.478-0.275,0.643-0.888,0.366-1.366c-0.275-0.478-0.89-0.642-1.366-0.366c-0.479,0.278-0.642,0.89-0.366,1.367C21.732,12.54,22.344,12.705,22.822,12.428zM12.062,21.455c-0.478-0.275-1.089-0.111-1.366,0.367c-0.275,0.479-0.111,1.09,0.366,1.365c0.478,0.277,1.091,0.111,1.365-0.365C12.704,22.344,12.54,21.732,12.062,21.455zM12.062,9.545c0.479-0.276,0.642-0.888,0.366-1.366c-0.276-0.478-0.888-0.642-1.366-0.366s-0.642,0.888-0.366,1.366C10.973,9.658,11.584,9.822,12.062,9.545zM22.823,18.572c-0.48-0.275-1.092-0.111-1.367,0.365c-0.275,0.479-0.112,1.092,0.367,1.367c0.477,0.275,1.089,0.113,1.365-0.365C23.464,19.461,23.3,18.848,22.823,18.572zM19.938,7.813c-0.477-0.276-1.091-0.111-1.365,0.366c-0.275,0.48-0.111,1.091,0.366,1.367s1.089,0.112,1.366-0.366C20.581,8.702,20.418,8.089,19.938,7.813zM23.378,14.5c-0.554,0.002-1.001,0.45-1.001,1c0.001,0.552,0.448,1,1.001,1c0.551,0,1-0.447,1-1C24.378,14.949,23.929,14.5,23.378,14.5zM15.501,6.624c-0.552,0-1,0.448-1,1l-0.466,7.343l-3.004,1.96c-0.478,0.277-0.642,0.889-0.365,1.365c0.275,0.479,0.889,0.643,1.365,0.367l3.305-1.676C15.39,16.99,15.444,17,15.501,17c0.828,0,1.5-0.671,1.5-1.5l-0.5-7.876C16.501,7.072,16.053,6.624,15.501,6.624zM15.501,22.377c-0.552,0-1,0.447-1,1s0.448,1,1,1s1-0.447,1-1S16.053,22.377,15.501,22.377zM18.939,21.455c-0.479,0.277-0.643,0.889-0.366,1.367c0.275,0.477,0.888,0.643,1.366,0.365c0.478-0.275,0.642-0.889,0.366-1.365C20.028,21.344,19.417,21.18,18.939,21.455z'
            }, {
                id : 'animation_pathWingButton',
                tagName : 'path',
                d : 'm 4.5,0.5 c -2.216,0 -4,1.784 -4,4 l 0,24 c 0,2.216 1.784,4 4,4 l 13.71875,0 C 22.478584,27.272785 27.273681,22.511272 32.5,18.25 l 0,-13.75 c 0,-2.216 -1.784,-4 -4,-4 l -24,0 z'
            }, {
                id : 'animation_pathPointer',
                tagName : 'path',
                d : 'M-15,-65,-15,-55,15,-55,15,-65,0,-95z'
            }, {
                id : 'animation_pathSwooshFX',
                tagName : 'path',
                d : 'm 85,0 c 0,16.617 -4.813944,35.356 -13.131081,48.4508 h 6.099803 c 8.317138,-13.0948 13.13322,-28.5955 13.13322,-45.2124 0,-46.94483 -38.402714,-85.00262 -85.7743869,-85.00262 -1.0218522,0 -2.0373001,0.0241 -3.0506131,0.0589 45.958443,1.59437 82.723058,35.77285 82.723058,81.70532 z'
            }]
        });

        if (typeof this._defsElement === 'undefined') {
            this._svgNode.appendChild(defsElement);
        } else {
            this._svgNode.replaceChild(defsElement, this._defsElement);
        }
        this._defsElement = defsElement;
    };

    return Animation;
});