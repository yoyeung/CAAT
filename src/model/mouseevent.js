/**
 * See LICENSE file.
 *
 * MouseEvent is a class to hold necessary information of every mouse event related to concrete
 * scene graph Actors.
 *
 * Here it is also the logic to on mouse events, pump the correct event to the appropiate scene
 * graph Actor.
 *
 * TODO: add events for event pumping:
 *  + cancelBubling
 *
 **/


(function() {
    /**
     * This function creates a mouse event that represents a touch or mouse event.
     * @constructor
     */
	CAAT.MouseEvent = function() {
		this.point= new CAAT.Point(0,0,0);
		this.screenPoint= new CAAT.Point(0,0,0);
		return this;
	};
	
	CAAT.MouseEvent.prototype= {
		screenPoint:	null,
		point:			null,
		time:			0,
		source:			null,

        shift:          false,
        control:        false,
        alt:            false,
        meta:           false,

        sourceEvent:    null,

		init : function( x,y,sourceEvent,source,screenPoint ) {
			this.point.set(x,y);
			this.source=        source;
			this.screenPoint=   screenPoint;
            this.alt =          sourceEvent.altKey;
            this.control =      sourceEvent.ctrlKey;
            this.shift =        sourceEvent.shiftKey;
            this.meta =         sourceEvent.metaKey;
            this.sourceEvent=   sourceEvent;
            this.x=             x;
            this.y=             y;
			return this;
		},
		isAltDown : function() {
			return this.alt;
		},
		isControlDown : function() {
			return this.control;
		},
		isShiftDown : function() {
			return this.shift;
		},
        isMetaDown: function() {
            return this.meta;
        },
        getSourceEvent : function() {
            return this.sourceEvent;
        }
	};
})();

/**
 * Box2D point meter conversion ratio.
 */
CAAT.PMR= 64;

/**
 * Allow visual debugging artifacts.
 */
CAAT.DEBUG= false;
CAAT.DEBUGBB= false;    // debug bounding boxes.
CAAT.DEBUGBBCOLOR='red';

/**
 * Log function which deals with window's Console object.
 */
CAAT.log= function() {
    if(window.console){
        window.console.log( Array.prototype.slice.call(arguments) );
    }
};

CAAT.FRAME_TIME= 0;

/**
 * Flag to signal whether events are enabled for CAAT.
 */
CAAT.GlobalEventsEnabled=   false;

/**
 * Accelerometer related data.
 */
CAAT.prevOnDeviceMotion=    null;   // previous accelerometer callback function.
CAAT.onDeviceMotion=        null;   // current accelerometer callback set for CAAT.
CAAT.accelerationIncludingGravity= { x:0, y:0, z:0 };   // acceleration data.
CAAT.rotationRate= { alpha: 0, beta:0, gamma: 0 };      // angles data.

/**
 * Do not consider mouse drag gesture at least until you have dragged
 * 5 pixels in any direction.
 */
CAAT.DRAG_THRESHOLD_X=      5;
CAAT.DRAG_THRESHOLD_Y=      5;

// has the animation loop began ?
CAAT.renderEnabled= false;
CAAT.FPS=           60;

/**
 * On resize event listener
 */
CAAT.windowResizeListeners= [];

/**
 * Register an object as resize callback.
 * @param f {object{windowResized(width{number},height{number})}}
 */
CAAT.registerResizeListener= function(f) {
    CAAT.windowResizeListeners.push(f);
};

/**
 * Unregister a resize listener.
 * @param director {CAAT.Director}
 */
CAAT.unregisterResizeListener= function(director) {
    for( var i=0; i<CAAT.windowResizeListeners.length; i++ ) {
        if ( director===CAAT.windowResizeListeners[i] ) {
            CAAT.windowResizeListeners.splice(i,1);
            return;
        }
    }
};

/**
 * Pressed key codes.
 */
CAAT.keyListeners= [];

/**
 * Register key events notification function.
 * @param f {function(key {integer}, action {'down'|'up'})}
 */
CAAT.registerKeyListener= function(f) {
    CAAT.keyListeners.push(f);
};

CAAT.SHIFT_KEY=    16;
CAAT.CONTROL_KEY=  17;
CAAT.ALT_KEY=      18;
CAAT.ENTER_KEY=    13;

/**
 * Event modifiers.
 */
CAAT.KEY_MODIFIERS= {
    alt:        false,
    control:    false,
    shift:      false
};

/**
 * Define a key event.
 * @constructor
 * @param keyCode
 * @param up_or_down
 * @param modifiers
 * @param originalEvent
 */
CAAT.KeyEvent= function( keyCode, up_or_down, modifiers, originalEvent ) {
    this.keyCode= keyCode;
    this.action=  up_or_down;
    this.modifiers= modifiers;
    this.sourceEvent= originalEvent;

    this.getKeyCode= function() {
        return this.keyCode;
    };

    this.getAction= function() {
        return this.action;
    };

    this.modifiers= function() {
        return this.modifiers;
    };

    this.isShiftPressed= function() {
        return this.modifiers.shift;
    };

    this.isControlPressed= function() {
        return this.modifiers.control;
    };

    this.isAltPressed= function() {
        return this.modifiers.alt;
    };

    this.getSourceEvent= function() {
        return this.sourceEvent;
    };
};

/**
 * Enable window level input events, keys and redimension.
 */
CAAT.GlobalEnableEvents= function __GlobalEnableEvents() {

    if ( CAAT.GlobalEventsEnabled ) {
        return;
    }

    this.GlobalEventsEnabled= true;

    window.addEventListener('keydown',
        function(evt) {
            var key = (evt.which) ? evt.which : evt.keyCode;

            evt.preventDefault();

            if ( key===CAAT.SHIFT_KEY ) {
                CAAT.KEY_MODIFIERS.shift= true;
            } else if ( key===CAAT.CONTROL_KEY ) {
                CAAT.KEY_MODIFIERS.control= true;
            } else if ( key===CAAT.ALT_KEY ) {
                CAAT.KEY_MODIFIERS.alt= true;
            } else {
                for( var i=0; i<CAAT.keyListeners.length; i++ ) {
                    CAAT.keyListeners[i]( new CAAT.KeyEvent(
                        key,
                        'down',
                        {
                            alt:        CAAT.KEY_MODIFIERS.alt,
                            control:    CAAT.KEY_MODIFIERS.control,
                            shift:      CAAT.KEY_MODIFIERS.shift
                        },
                        evt)) ;
                }
            }
        },
        false);

    window.addEventListener('keyup',
        function(evt) {

            evt.preventDefault();

            var key = (evt.which) ? evt.which : evt.keyCode;
            if ( key===CAAT.SHIFT_KEY ) {
                CAAT.KEY_MODIFIERS.shift= false;
            } else if ( key===CAAT.CONTROL_KEY ) {
                CAAT.KEY_MODIFIERS.control= false;
            } else if ( key===CAAT.ALT_KEY ) {
                CAAT.KEY_MODIFIERS.alt= false;
            } else {

                for( var i=0; i<CAAT.keyListeners.length; i++ ) {
                    CAAT.keyListeners[i]( new CAAT.KeyEvent(
                        key,
                        'up',
                        {
                            alt:        CAAT.KEY_MODIFIERS.alt,
                            control:    CAAT.KEY_MODIFIERS.control,
                            shift:      CAAT.KEY_MODIFIERS.shift
                        },
                        evt));
                }
            }
        },
        false );

    window.addEventListener('resize',
        function(evt) {
            for( var i=0; i<CAAT.windowResizeListeners.length; i++ ) {
                CAAT.windowResizeListeners[i].windowResized(
                        window.innerWidth,
                        window.innerHeight);
            }
        },
        false);
};

/**
 * Polyfill for requestAnimationFrame.
 */
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame     ||
          function raf(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / CAAT.FPS);
          };
})();

CAAT.SET_INTERVAL=0;
/**
 * Main animation loop entry point.
 * @param fps {number} desired fps. This parameter makes no sense unless requestAnimationFrame function
 * is not present in the system.
 */
CAAT.loop= function(fps) {
    if (CAAT.renderEnabled) {
        return;
    }


    CAAT.FPS= fps || 60;
    CAAT.renderEnabled= true;
    if (CAAT.NO_PERF) {
        setInterval(
                function() {
                    var t= new Date().getTime();
                    for (var i = 0, l = CAAT.director.length; i < l; i++) {
                        CAAT.director[i].renderFrame();
                    }
                    //t= new Date().getTime()-t;
                    CAAT.FRAME_TIME= t - CAAT.SET_INTERVAL;
                    
                    CAAT.SET_INTERVAL= t;

                },
                1000 / CAAT.FPS
        );
    } else {
        CAAT.renderFrame();
    }
}


CAAT.RAF=                       0;    // requestAnimationFrame time reference.
CAAT.REQUEST_ANIMATION_FRAME_TIME=   0;
/**
 * Make a frame for each director instance present in the system.
 */
CAAT.renderFrame= function() {
    var t= new Date().getTime();
    for( var i=0, l=CAAT.director.length; i<l; i++ ) {
        CAAT.director[i].renderFrame();
    }
    t= new Date().getTime()-t;
    CAAT.FRAME_TIME= t;

    if (CAAT.RAF)   {
        CAAT.REQUEST_ANIMATION_FRAME_TIME= new Date().getTime()-CAAT.RAF;
    }
    CAAT.RAF= new Date().getTime();

    window.requestAnimFrame(CAAT.renderFrame, 0 );
}

/**
 * Set browser cursor. The preferred method for cursor change is this method.
 * @param cursor
 */
CAAT.setCursor= function(cursor) {
    if ( navigator.browser!=='iOS' ) {
        document.body.style.cursor= cursor;
    }
};

/**
 * Register and keep track of every CAAT.Director instance in the document.
 */
CAAT.RegisterDirector= function __CAATGlobal_RegisterDirector(director) {

    if ( !CAAT.director ) {
        CAAT.director=[];
    }
    CAAT.director.push(director);
    CAAT.GlobalEnableEvents();
};

/**
 * Enable at window level accelerometer events.
 */
(function() {

    function tilt(data) {
        CAAT.rotationRate= {
                alpha : 0,
                beta  : data[0],
                gamma : data[1]
            };
    }

    if (window.DeviceOrientationEvent) {
        window.addEventListener("deviceorientation", function (event) {
            tilt([event.beta, event.gamma]);
        }, true);
    } else if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', function (event) {
            tilt([event.acceleration.x * 2, event.acceleration.y * 2]);
        }, true);
    } else {
        window.addEventListener("MozOrientation", function (event) {
            tilt([-event.y * 45, event.x * 45]);
        }, true);
    }

})();