/*
The MIT License

Copyright (c) 2010-2011-2012 Ibon Tolosana [@hyperandroid]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Version: . build: 66

Created on:
DATE: 2012-12-30
TIME: 19:42:47
*/


(function(global) {

    String.prototype.endsWith= function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };

    Function.prototype.bind = Function.prototype.bind || function () {
                var fn = this;                                   // the function
                var args = Array.prototype.slice.call(arguments);  // copy the arguments.
                var obj = args.shift();                           // first parameter will be context 'this'
                return function () {
                    return fn.apply(
                        obj,
                        args.concat(Array.prototype.slice.call(arguments)));
                }
            };

    global.isArray = function (input) {
        return typeof(input) == 'object' && (input instanceof Array);
    };
    global.isString = function (input) {
        return typeof(input) == 'string';
    };
    global.isFunction = function( input ) {
        return typeof input == "function"
    }

    var initializing = false;

    // The base Class implementation (does nothing)
    var Class = function () {
    };

    // Create a new Class that inherits from this class
    Class.extend = function (extendingProt, constants, name, aliases, flags) {

        var _super = this.prototype;

        // Instantiate a base class (but only create the instance,
        // don't run the init constructor)
        initializing = true;
        var prototype = new this();
        initializing = false;

        // The dummy class constructor
        function CAATClass() {
            // All construction is actually done in the init method
            if (!initializing && this.__init) {
                this.__init.apply(this, arguments);
            }
        }

        // Populate our constructed prototype object
        CAATClass.prototype = prototype;
        // Enforce the constructor to be what we expect
        CAATClass.prototype.constructor = CAATClass;
        CAATClass.superclass = _super;
        // And make this class extendable
        CAATClass.extend = Class.extend;

        assignNamespace( name, CAATClass );
        if ( constants ) {
            constants= (isFunction(constants) ? constants() : constants);
            for( var constant in constants ) {
                if ( constants.hasOwnProperty(constant) ) {
                    CAATClass[ constant ]= constants[constant];
                }
            }
        }

        if ( aliases ) {
            if ( !isArray(aliases) ) {
                aliases= [aliases];
            }
            for( var i=0; i<aliases.length; i++ ) {
                ensureNamespace( aliases[i] );
                var ns= assignNamespace( aliases[i], CAATClass );

                // assign constants to alias classes.
                if ( constants ) {
                    for( var constant in constants ) {
                        if ( constants.hasOwnProperty(constant) ) {
                            ns[ constant ]= constants[constant];
                        }
                    }
                }
            }
        }

        extendingProt= (isFunction(extendingProt) ? extendingProt() : extendingProt);

        // Copy the properties over onto the new prototype
        for (var fname in extendingProt) {
            // Check if we're overwriting an existing function
            prototype[fname] = ( (fname === "__init" || (flags && flags.decorated) ) && isFunction(extendingProt[fname]) && isFunction(_super[fname]) ) ?
                (function (name, fn) {
                    return function () {
                        var tmp = this.__super;
                        this.__super = _super[name];
                        var ret = fn.apply(this, arguments);
                        this.__super = tmp;
                        return ret;
                    };
                })(fname, extendingProt[fname]) :

                extendingProt[fname];
        }

        return CAATClass;
    }

    var Node= function( obj ) { //name, dependencies, callback ) {
        this.name= obj.defines;
        this.extendWith= obj.extendsWith;
        this.callback= obj.onCreate;
        this.callbackPreCreation= obj.onPreCreate;
        this.dependencies= obj.depends;
        this.baseClass= obj.extendsClass;
        this.aliases= obj.aliases;
        this.constants= obj.constants;
        this.decorated= obj.decorated;

        this.children= [];

        return this;
    };

    Node.prototype= {
        children:       null,
        name:           null,
        extendWith:     null,
        callback:       null,
        dependencies:   null,
        baseClass:      null,
        aliases:        null,
        constants:      null,

        decorated:      false,

        solved:         false,
        visited:        false,

        status : function() {
            console.log("  Module: "+this.name+
                (this.dependencies.length ?
                    (" unsolved_deps:["+this.dependencies+"]") :
                    " no dependencies.")+
                ( this.solved ? " solved" : " ------> NOT solved.")
            );
        },

        removeDependency : function( modulename ) {
            for( var i=0; i<this.dependencies.length; i++ ) {
                if ( this.dependencies[i]===modulename ) {
                    this.dependencies.splice(i,1);
                    break;
                }
            }


        },

        assignDependency : function( node ) {

            var i;
            for( i=0; i<this.dependencies.length; i++ ) {
                if ( this.dependencies[i] === node.name ) {
                    this.children.push( node );
                    this.dependencies.splice(i,1);
//                    console.log("Added dependency: "+node.name+" on "+this.name);
                    break;
                }
            }
        },

        isSolved : function() {
            return this.solved;
        },

        solveDeep : function() {

            if ( this.visited ) {
                return true;
            }

            this.visited= true;

            if ( this.solved ) {
                return true;
            }

            if ( this.dependencies.length!==0 ) {
                return false;
            }

            var b= true;
            for( var i=0; i<this.children.length; i++ ) {
                if (! this.children[i].solveDeep() ) {
                    return false;
                }
            }

            //////
            this.__initModule();

            this.solved= true;
            mm.solved( this );

            return true;
        },

        __initModule : function() {

            var c= null;
            if ( this.baseClass ) {
                c= findClass( this.baseClass );

                if ( !c ) {
                    console.log("  "+this.name+" -> Can't extend non-existant class: "+this.baseClass );
                    return;
                }

                c= c.extend(
                    this.extendWith,
                    this.constants,
                    this.name,
                    this.aliases,
                    { decorated : this.decorated } );

            } else {
                c= Class.extend(
                    this.extendWith,
                    this.constants,
                    this.name,
                    this.aliases,
                    { decorated : this.decorated } );
            }

            console.log("Created module: "+this.name);

            if ( this.callback ) {
                this.callback();
            }

        }
    };

    var ScriptFile= function(path, module) {
        this.path= path;
        this.module= module;
        return this;
    }

    ScriptFile.prototype= {
        path : null,
        processed: false,
        module: null,

        setProcessed : function() {
            this.processed= true;
        },

        isProcessed : function() {
            return this.processed;
        }
    };

    var ModuleManager= function() {
        this.nodes= [];
        this.loadedFiles= [];
        this.path= {};
        this.solveListener= [];
        this.orderedSolvedModules= [];
        this.readyListener= [];

        return this;
    };

    ModuleManager.baseURL= "";
    ModuleManager.modulePath= {};
    ModuleManager.sortedModulePath= [];
    ModuleManager.symbol= {};

    ModuleManager.prototype= {

        nodes:      null,           // built nodes.
        loadedFiles:null,           // list of loaded files. avoid loading each file more than once
        solveListener: null,        // listener for a module solved
        readyListener: null,        // listener for all modules solved
        orderedSolvedModules: null, // order in which modules where solved.

        addSolvedListener : function( modulename, callback ) {
            this.solveListener.push( {
                name : modulename,
                callback : callback
            });
        },

        solved : function( module ) {
            var i;

            for( i=0; i<this.solveListener.length; i++ ) {
                if ( this.solveListener[i].name===module.name) {
                    this.solveListener[i].callback();
                }
            }

            this.orderedSolvedModules.push( module );

            this.notifyReady();
        },

        notifyReady : function() {
            var i;

            for( i=0; i<this.nodes.length; i++ ) {
                if ( !this.nodes[i].isSolved() ) {
                    return;
                }
            }

            // if there's any pending files to be processed, still not notify about being solved.
            for( i=0; i<this.loadedFiles.length; i++ ) {
                if ( !this.loadedFiles[i].isProcessed() ) {
                    // aun hay ficheros sin procesar, no notificar.
                    return;
                }
            }

            /**
             * Make ModuleManager.bring reentrant.
             */
            var me= this;
            var arr= Array.prototype.slice.call(this.readyListener);
            setTimeout( function() {
                for( var i=0; i<arr.length; i++ ) {
                    arr[i]();
                }
            }, 0 );

            this.readyListener= [];
        },

        status : function() {
            for( var i=0; i<this.nodes.length; i++ ) {
                this.nodes[i].status();
            }
        },

        module : function( obj ) {//name, dependencies, callback ) {

            var node, nnode, i;

            if ( this.isModuleScheduledToSolve( obj.defines ) ) {
//                console.log("Discarded module: "+obj.class+" (already loaded)");
                return this;
            }

            if ( obj.onPreCreate ) {
//                console.log("  --> "+obj.defines+" onPrecreation");
                try {
                    obj.onPreCreate();
                } catch(e) {
                    console.log("  -> catched "+e+" on module "+obj.defines+" preCreation.");
                }
            }

            if (!obj.depends ) {
                obj.depends= [];
            }

            var dependencies= obj.depends;

            if ( dependencies ) {
                if ( !isArray(dependencies) ) {
                    dependencies= [ dependencies ];
                    obj.depends= dependencies;
                }
            }

            // elimina dependencias ya resueltas en otras cargas.
            i=0;
            while( i<dependencies.length ) {
                if ( this.alreadySolved( dependencies[i] ) ) {
                     dependencies.splice(i,1);
                } else {
                    i++;
                }
            }

            nnode= new Node( obj );

            // asignar nuevo nodo a quien lo tenga como dependencia.
            for( var i=0; i<this.nodes.length; i++ ) {
                this.nodes[i].assignDependency(nnode);
            }
            this.nodes.push( nnode );

            /**
             * Making dependency resolution a two step process will allow us to pack all modules into one
             * single file so that the module manager does not have to load external files.
             * Useful when CAAt has been packed into one single bundle.
             */

            /**
             * remove already loaded modules dependencies.
             */
            for( i=0; i<obj.depends.length;  ) {

                if ( this.isModuleScheduledToSolve( obj.depends[i] ) ) {
                    var dep= this.findNode( obj.depends[i] );
                    if ( null!==dep ) {
                        nnode.assignDependency( dep );
                    } else {
                        //// ERRR
                        alert("Module loaded and does not exist in loaded modules nodes. "+obj.depends[i]);
                        i++;
                    }
                } else {
                    i+=1;
                }
            }

            /**
             * now, for the rest of non solved dependencies, load their files.
             */
            (function(mm, obj) {
                setTimeout( function() {
                    for( i=0; i<obj.depends.length; i++ ) {
                        mm.loadFile( obj.depends[i] );
                    }
                }, 0 );
            })(this, obj);

            return this;

        },

        findNode : function( name ) {
            for( var i=0; i<this.nodes.length; i++ ) {
                if ( this.nodes[i].name===name ) {
                    return this.nodes[i];
                }
            }

            return null;
        } ,

        alreadySolved : function( name ) {
            for( var i= 0; i<this.nodes.length; i++ ) {
                if ( this.nodes[i].name===name && this.nodes[i].isSolved() ) {
                    return true;
                }
            }

            return false;
        },

        exists : function(path) {
            var path= path.split(".");
            var root= global;

            for( var i=0; i<path.length; i++ ) {
                if (!root[path[i]]) {
                    return false;
                }

                root= root[path[i]];
            }

            return true;
        },

        loadFile : function( module ) {


            if (this.exists(module)) {
                return;
            }

            var path= this.getPath( module );

            // avoid loading any js file more than once.
            for( var i=0; i<this.loadedFiles.length; i++ ) {
                if ( this.loadedFiles[i].path===path ) {
                    return;
                }
            }

            var sf= new ScriptFile( path, module );
            this.loadedFiles.push( sf );

            var node= document.createElement("script");
            node.type = 'text/javascript';
            node.charset = 'utf-8';
            node.async = true;
            node.addEventListener('load', this.moduleLoaded.bind(this), false);
            node.addEventListener('error', this.moduleErrored.bind(this), false);
            node.setAttribute('module-name', module);
            node.src = path+(!DEBUG ? "?"+(new Date().getTime()) : "");

            document.getElementsByTagName('head')[0].appendChild( node );

        },

        /**
         * Resolve a module name.
         *
         *  + if the module ends with .js
         *    if starts with /, return as is.
         *    else reppend baseURL and return.
         *
         * @param module
         */
        getPath : function( module ) {

            // endsWith
            if ( module.endsWith(".js") ) {
                if ( module.charAt(0)!=="/" ) {
                    module= ModuleManager.baseURL+module;
                } else {
                    module= module.substring(1);
                }
                return module;
            }

            var i, symbol;

            for( symbol in ModuleManager.symbol ) {
                if ( module===symbol ) {
                    return  ModuleManager.baseURL + ModuleManager.symbol[symbol];
                }
            }

            //for( var modulename in ModuleManager.modulePath ) {
            for( i=0; i<ModuleManager.sortedModulePath.length; i++ ) {
                var modulename= ModuleManager.sortedModulePath[i];

                if ( ModuleManager.modulePath.hasOwnProperty(modulename) ) {
                    var path= ModuleManager.modulePath[modulename];

                    // startsWith
                    if ( module.indexOf(modulename)===0 ) {
                        // +1 to skip '.' class separator.
                        var nmodule= module.substring(modulename.length + 1);

                        /**
                         * Avoid name clash:
                         * CAAT.Foundation and CAAT.Foundation.Timer will both be valid for
                         * CAAT.Foundation.Timer.TimerManager module.
                         * So in the end, the module name can't have '.' after chopping the class
                         * namespace.
                         */

                        nmodule= nmodule.replace(/\./g,"/");

                        //if ( nmodule.indexOf(".")===-1 ) {
                            nmodule= path+nmodule+".js";
                            return ModuleManager.baseURL + nmodule;
                        //}
                    }
                }
            }

            // what's that ??!?!?!?
            return ModuleManager.baseURL + module.replace(/\./g,"/") + ".js";
        },

        isModuleScheduledToSolve : function( name ) {
            for( var i=0; i<this.nodes.length; i++ ) {
                if ( this.nodes[i].name===name ) {
                    return true;
                }
            }
            return false;
        },

        moduleLoaded : function(e) {
            if (e.type==="load") {

                var node = e.currentTarget || e.srcElement || e.target;
                var mod= node.getAttribute("module-name");

                // marcar fichero de modulo como procesado.
                for( var i=0; i<this.loadedFiles.length; i++ ) {
                    if ( this.loadedFiles[i].module===mod ) {
                        this.loadedFiles[i].setProcessed();
                        break;
                    }
                }

                for( var i=0; i<this.nodes.length; i++ ) {
                    this.nodes[i].removeDependency( mod );
                }

                for( var i=0; i<this.nodes.length; i++ ) {
                    for( var j=0; j<this.nodes.length; j++ ) {
                        this.nodes[j].visited= false;
                    }
                    this.nodes[i].solveDeep();
                }

                /**
                 * Despues de cargar un fichero, este puede contener un modulo o no.
                 * Si todos los ficheros que se cargan fueran bibliotecas, nunca se pasaria de aqui porque
                 * no se hace una llamada a solveDeep, y notificacion a solved, y de ahí a notifyReady.
                 * Por eso se hace aqui una llamada a notifyReady, aunque pueda ser redundante.
                 */
                var me= this;
                setTimeout(function() {
                    me.notifyReady();
                }, 0 );
            }
        },

        moduleErrored : function(e) {
            var node = e.currentTarget || e.srcElement;
            console.log("Error loading module: "+ node.getAttribute("module-name") );
        },

        solvedInOrder : function() {
            for( var i=0; i<this.orderedSolvedModules.length; i++ ) {
                console.log(this.orderedSolvedModules[i].name);
            }
        },

        solveAll : function() {
            for( var i=0; i<this.nodes.length; i++ ) {
                this.nodes[i].solveDeep();
            }
        },

        onReady : function( f ) {
            this.readyListener.push(f);
        }

    };

    function ensureNamespace( qualifiedClassName ) {
        var ns= qualifiedClassName.split(".");
        var _global= global;
        for( var i=0; i<ns.length-1; i++ ) {
            if ( !_global[ns[i]] ) {
                _global[ns[i]]= {};
            }
            _global= _global[ns[i]];
        }
    }

    /**
     *
     * Create a namespace object from a string.
     *
     * @param namespace {string}
     * @param obj {object}
     * @return {object} the namespace object
     */
    function assignNamespace( namespace, obj ) {
        var ns= namespace.split(".");
        var _global= global;
        for( var i=0; i<ns.length-1; i++ ) {
            if ( !_global[ns[i]] ) {
                console.log("    Error assigning value to namespace :"+namespace+". '"+ns[i]+"' does not exist.");
                return null;
            }

            _global= _global[ns[i]];
        }

        _global[ ns[ns.length-1] ]= obj;

        return _global[ ns[ns.length-1] ];
    }

    function findClass( qualifiedClassName ) {
        var ns= qualifiedClassName.split(".");
        var _global= global;
        for( var i=0; i<ns.length; i++ ) {
            if ( !_global[ns[i]] ) {
                return null;
            }

            _global= _global[ns[i]];
        }

        return _global;
    }

    var mm= new ModuleManager();
    var DEBUG= false;

    global.CAAT= global.CAAT || {};

    /**
     *
     * @param obj {
     *   defines{string},             // class name
     *   depends{Array<string>=},   // dependencies class names
     *   extendsClass{string},            // class to extend from
     *   extensdWith{object},        // actual prototype to extend
     *   aliases{Array<string>},    // other class names
     *   onCreation{function=}        // optional callback to call after class creation.
     *   onPreCreation{function=}        // optional callback to call after namespace class creation.
     * }
     */
    CAAT.Module= function loadModule(obj) {

        if (!obj.defines) {
            console.error("Bad module definition: "+obj);
            return;
        }

        ensureNamespace(obj.defines);

        mm.module( obj );

    };

    CAAT.ModuleManager= {};

    CAAT.ModuleManager.baseURL= function(baseURL) {

        if ( !baseURL ) {
            return CAAT.Module;
        }

        if (!baseURL.endsWith("/") ) {
            baseURL= baseURL + "/";
        }

        ModuleManager.baseURL= baseURL;
        return CAAT.ModuleManager;
    };

    CAAT.ModuleManager.setModulePath= function( module, path ) {

        if ( !path.endsWith("/") ) {
            path= path + "/";
        }

        if ( !ModuleManager.modulePath[module] ) {
            ModuleManager.modulePath[ module ]= path;

            ModuleManager.sortedModulePath.push( module );
            ModuleManager.sortedModulePath.sort( function(a,b) {
                return a<b;
            } );
        }
        return CAAT.ModuleManager;
    };

    CAAT.ModuleManager.symbol= function( symbol, path ) {

        if ( !ModuleManager.symbol[symbol] ) {
            ModuleManager.symbol[symbol]= path;
        }

        return CAAT.ModuleManager;
    };

    CAAT.ModuleManager.bring= function( file ) {

        if ( !isArray(file) ) {
            file= [file];
        }

        for( var i=0; i<file.length; i++ ) {
            mm.loadFile( file[i] );
        }

        return CAAT.ModuleManager;
    };

    CAAT.ModuleManager.status= function() {
        mm.status();
    }

    CAAT.ModuleManager.addModuleSolvedListener= function(modulename,callback) {
        mm.addSolveListener( modulename, callback );
        return CAAT.ModuleManager;
    }

    CAAT.ModuleManager.load= function(file, onload, onerror) {
        var node= document.createElement("script");
        node.type = 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        if ( onload ) {
            node.addEventListener('load', onload, false);
        }
        if ( onerror ) {
            node.addEventListener('error', onerror, false);
        }

        node.addEventListener("load", function( ) {
            mm.solveAll();
        }, false);

        node.src = file+(!DEBUG ? "?"+(new Date().getTime()) : "");

        document.getElementsByTagName('head')[0].appendChild( node );

        // maybe this file has all the modules needed so no more file loading/module resolution must be performed.

    }

    CAAT.ModuleManager.solvedInOrder= function() {
        mm.solvedInOrder();
    }

    CAAT.ModuleManager.onReady= function(f) {
        mm.onReady(f);
        return CAAT.ModuleManager;
    }

    CAAT.ModuleManager.solveAll= function() {
        mm.solveAll();
    }

    CAAT.ModuleManager.debug= function(d) {
        DEBUG= d;
        return CAAT.ModuleManager;
    }

})(this);
/**
 * See LICENSE file.
 *
 **/

CAAT.Module( {
    defines: "CAAT.Core.Constants",

    extendsWith: function() {

        /**
         * This function makes the system obey decimal point calculations for actor's position, size, etc.
         * This may speed things up in some browsers, but at the cost of affecting visuals (like in rotating
         * objects).
         *
         * Latest Chrome (20+) is not affected by this.
         *
         * Default CAAT.Matrix try to speed things up.
         *
         * @param clamp {boolean}
         */
        CAAT.setCoordinateClamping= function( clamp ) {
            if ( clamp ) {
                CAAT.Matrix.prototype.transformRenderingContext= CAAT.Matrix.prototype.transformRenderingContext_Clamp;
                CAAT.Matrix.prototype.transformRenderingContextSet= CAAT.Matrix.prototype.transformRenderingContextSet_Clamp;
                CAAT.Math.Matrix.prototype.transformRenderingContext= CAAT.Matrix.prototype.transformRenderingContext_Clamp;
                CAAT.Math.Matrix.prototype.transformRenderingContextSet= CAAT.Matrix.prototype.transformRenderingContextSet_Clamp;
            } else {
                CAAT.Matrix.prototype.transformRenderingContext= CAAT.Matrix.prototype.transformRenderingContext_NoClamp;
                CAAT.Matrix.prototype.transformRenderingContextSet= CAAT.Matrix.prototype.transformRenderingContextSet_NoClamp;
                CAAT.Math.Matrix.prototype.transformRenderingContext= CAAT.Matrix.prototype.transformRenderingContext_NoClamp;
                CAAT.Math.Matrix.prototype.transformRenderingContextSet= CAAT.Matrix.prototype.transformRenderingContextSet_NoClamp;
            }
        };

        /**
         * Log function which deals with window's Console object.
         */
        CAAT.log= function() {
            if(window.console){
                window.console.log( Array.prototype.slice.call(arguments) );
            }
        };

        /**
         * Control how CAAT.Font and CAAT.TextActor control font ascent/descent values.
         * 0 means it will guess values from a font height
         * 1 means it will try to use css to get accurate ascent/descent values and fall back to the previous method
         *   in case it couldn't.
         *
         * @type {Number}
         */
        CAAT.CSS_TEXT_METRICS=      0;

        CAAT.GLRENDER= false;

        /**
         * DEBUGGING CONSTANTS
         */
        CAAT.DEBUG= false;              // set this variable before building CAAT.Director intances to
                                    // enable debug panel.
        CAAT.DEBUGBB= false;            // show Bounding Boxes
        CAAT.DEBUGBBBCOLOR = '#00f';      // Bounding Boxes color.
        CAAT.DEBUGAABB = false;         // debug axis aligned bounding boxes.
        CAAT.DEBUGAABBCOLOR = '#f00';
        CAAT.DEBUG_DIRTYRECTS= false;    // if CAAT.Director.setClear uses CLEAR_DIRTY_RECTS, this will show them
                                    // on screen.

        /**
         * Do not consider mouse drag gesture at least until you have dragged
         * DRAG_THRESHOLD_X and DRAG_THRESHOLD_Y pixels.
         * This is suitable for tablets, where just by touching, drag events are delivered.
         */
        CAAT.DRAG_THRESHOLD_X=      5;
        CAAT.DRAG_THRESHOLD_Y=      5;

        return {
        }
    }
} );

extend = function (subc, superc) {
    var subcp = subc.prototype;

    // Class pattern.
    var CAATObject = function () {
    };
    CAATObject.prototype = superc.prototype;

    subc.prototype = new CAATObject();       // chain prototypes.
    subc.superclass = superc.prototype;
    subc.prototype.constructor = subc;

    // Reset constructor. See Object Oriented Javascript for an in-depth explanation of this.
    if (superc.prototype.constructor === Object.prototype.constructor) {
        superc.prototype.constructor = superc;
    }

    // los metodos de superc, que no esten en esta clase, crear un metodo que
    // llama al metodo de superc.
    for (var method in subcp) {
        if (subcp.hasOwnProperty(method)) {
            subc.prototype[method] = subcp[method];

            /**
             * Sintactic sugar to add a __super attribute on every overriden method.
             * Despite comvenient, it slows things down by 5fps.
             *
             * Uncomment at your own risk.
             *
             // tenemos en super un metodo con igual nombre.
             if ( superc.prototype[method]) {
            subc.prototype[method]= (function(fn, fnsuper) {
                return function() {
                    var prevMethod= this.__super;

                    this.__super= fnsuper;

                    var retValue= fn.apply(
                            this,
                            Array.prototype.slice.call(arguments) );

                    this.__super= prevMethod;

                    return retValue;
                };
            })(subc.prototype[method], superc.prototype[method]);
        }
             */

        }
    }
};


extendWith = function (base, subclass, with_object) {
    var CAATObject = function () {
    };

    CAATObject.prototype = base.prototype;

    subclass.prototype = new CAATObject();
    subclass.superclass = base.prototype;
    subclass.prototype.constructor = subclass;

    if (base.prototype.constructor === Object.prototype.constructor) {
        base.prototype.constructor = base;
    }

    if (with_object) {
        for (var method in with_object) {
            if (with_object.hasOwnProperty(method)) {
                subclass.prototype[ method ] = with_object[method];
                /*
                 if ( base.prototype[method]) {
                 subclass.prototype[method]= (function(fn, fnsuper) {
                 return function() {
                 var prevMethod= this.__super;
                 this.__super= fnsuper;
                 var retValue= fn.apply(this, arguments );
                 this.__super= prevMethod;

                 return retValue;
                 };
                 })(subclass.prototype[method], base.prototype[method]);
                 }
                 /**/
            }
        }
    }
};

/**
 * Dynamic Proxy for an object or wrap/decorate a function.
 *
 * @param object
 * @param preMethod
 * @param postMethod
 * @param errorMethod
 */
proxy = function (object, preMethod, postMethod, errorMethod) {

    // proxy a function
    if (typeof object === 'function') {

        if (object.__isProxy) {
            return object;
        }

        return (function (fn) {

            var proxyfn = function () {
                if (preMethod) {
                    preMethod({
                        fn:fn,
                        arguments:Array.prototype.slice.call(arguments)});
                }
                var retValue = null;
                try {
                    // apply original function call with itself as context
                    retValue = fn.apply(fn, Array.prototype.slice.call(arguments));
                    // everything went right on function call, then call
                    // post-method hook if present
                    if (postMethod) {
                        retValue = postMethod({
                            fn:fn,
                            arguments:Array.prototype.slice.call(arguments)});
                    }
                } catch (e) {
                    // an exeception was thrown, call exception-method hook if
                    // present and return its result as execution result.
                    if (errorMethod) {
                        retValue = errorMethod({
                            fn:fn,
                            arguments:Array.prototype.slice.call(arguments),
                            exception:e});
                    } else {
                        // since there's no error hook, just throw the exception
                        throw e;
                    }
                }

                // return original returned value to the caller.
                return retValue;
            };
            proxyfn.__isProxy = true;

            for (var method in fn) {
                if (fn.hasOwnProperty(method) && typeof fn[method] !== "function") {
                    if (method !== "__object" && method !== "__isProxy") {
                        (function (proxyfn, fn, method) {
                            proxyfn.__defineGetter__(method, function () {
                                return fn[method];
                            });
                            proxyfn.__defineSetter__(method, function (vale) {
                                fn[method] = vale;
                            });
                        })(proxyfn, fn, method);
                    }
                }
            }


            return proxyfn;

        })(object);
    }

    /**
     * If not a function then only non privitive objects can be proxied.
     * If it is a previously created proxy, return the proxy itself.
     */
    if (typeof object !== 'object' ||
        isArray(object) ||
        isString(object) ||
        object.__isProxy) {

        return object;
    }

    // Our proxy object class.
    var cproxy = function () {
    };
    // A new proxy instance.
    var proxy = new cproxy();
    // hold the proxied object as member. Needed to assign proper
    // context on proxy method call.
    proxy.__object = object;
    proxy.__isProxy = true;

    // For every element in the object to be proxied
    for (var method in object) {

        // only function members
        if (object.hasOwnProperty(method) && typeof object[method] === 'function') {
            // add to the proxy object a method of equal signature to the
            // method present at the object to be proxied.
            // cache references of object, function and function name.
            proxy[method] = (function (proxy, fn, method) {
                return function () {
                    // call pre-method hook if present.
                    if (preMethod) {
                        preMethod({
                            object:proxy.__object,
                            method:method,
                            arguments:Array.prototype.slice.call(arguments)});
                    }
                    var retValue = null;
                    try {
                        // apply original object call with proxied object as
                        // function context.
                        retValue = fn.apply(proxy.__object, arguments);
                        // everything went right on function call, the call
                        // post-method hook if present
                        if (postMethod) {
                            postMethod({
                                object:proxy.__object,
                                method:method,
                                arguments:Array.prototype.slice.call(arguments)});
                        }
                    } catch (e) {
                        // an exeception was thrown, call exception-method hook if
                        // present and return its result as execution result.
                        if (errorMethod) {
                            retValue = errorMethod({
                                object:proxy.__object,
                                method:method,
                                arguments:Array.prototype.slice.call(arguments),
                                exception:e});
                        } else {
                            // since there's no error hook, just throw the exception
                            throw e;
                        }
                    }

                    // return original returned value to the caller.
                    return retValue;
                };
            })(proxy, object[method], method);
        } else {
            if (method !== "__object" && method !== "__isProxy") {
                (function (proxy, method) {
                    proxy.__defineGetter__(method, function () {
                        return proxy.__object[method];
                    });
                    proxy.__defineSetter__(method, function (vale) {
                        proxy.__object[method] = vale;
                    });
                })(proxy, method);
            }
        }
    }

    // return our newly created and populated of functions proxy object.
    return proxy;
};

/** proxy sample usage

 var c0= new Meetup.C1(5);

 var cp1= proxy(
 c1,
 function() {
        console.log('pre method on object: ',
                arguments[0].object.toString(),
                arguments[0].method,
                arguments[0].arguments );
    },
 function() {
        console.log('post method on object: ',
                arguments[0].object.toString(),
                arguments[0].method,
                arguments[0].arguments );

    },
 function() {
        console.log('exception on object: ',
                arguments[0].object.toString(),
                arguments[0].method,
                arguments[0].arguments,
                arguments[0].exception);

        return -1;
    });
 **/

proxify = function (ns, preMethod, postMethod, errorMethod, getter, setter) {

    var nns = "__" + ns + "__";

    var obj = window;
    var path = ns.split(".");
    while (path.length > 1) {
        obj = obj[ path.shift() ];
    }

    window[nns] = obj[path];

    (function (root, obj, path, nns, ns) {
        var newC = function () {
            console.log("Creating object of type proxy[" + ns + "]");
            var obj = new root[nns](Array.prototype.slice.call(arguments));

            obj.____name = ns;
            return proxyObject(obj, preMethod, postMethod, errorMethod, getter, setter);

        };

        // set new constructor function prototype as previous one.
        newC.prototype = root[nns].prototype;

        for (var method in obj[path]) {
            if (obj[path].hasOwnProperty(method) && typeof obj[path][method] !== "function") {
                if (method !== "__object" && method !== "__isProxy") {
                    (function (prevConstructor, method, newC) {
                        newC.__defineGetter__(method, function () {
                            return prevConstructor[method];
                        });
                        newC.__defineSetter__(method, function (vale) {
                            prevConstructor[method] = vale;
                        });
                    })(obj[path], method, newC);
                }
            }
        }

        obj[path] = newC;

    })(window, obj, path, nns, ns);

};

proxyObject = function (object, preMethod, postMethod, errorMethod, getter, setter) {

    /**
     * If not a function then only non privitive objects can be proxied.
     * If it is a previously created proxy, return the proxy itself.
     */
    if (typeof object !== 'object' ||
        isArray(object) ||
        isString(object) ||
        object.__isProxy) {

        return object;
    }

    // hold the proxied object as member. Needed to assign proper
    // context on proxy method call.
    object.$proxy__isProxy = true;

    // For every element in the object to be proxied
    for (var method in object) {

        if (!object.hasOwnProperty(method)) {
            continue;
        }

        if (method === "constructor") {
            continue;
        }

        // only function members
        if (typeof object[method] === 'function') {

            var fn = object[method];
            object["$proxy__" + method] = fn;

            object[method] = (function (object, fn, fnname) {
                return function () {

                    var args = Array.prototype.slice.call(arguments);

                    // call pre-method hook if present.
                    if (preMethod) {
                        preMethod({
                            object:object,
                            objectName:object.____name,
                            method:fnname,
                            arguments:args });
                    }
                    var retValue = null;
                    try {
                        // apply original object call with proxied object as
                        // function context.
                        retValue = fn.apply(object, args);
                        // everything went right on function call, the call
                        // post-method hook if present
                        if (postMethod) {
                            /*var rr= */
                            postMethod({
                                object:object,
                                objectName:object.____name,
                                method:fnname,
                                arguments:args });
                            /*
                             if ( typeof rr!=="undefined" ) {
                             //retValue= rr;
                             }
                             */
                        }
                    } catch (e) {
                        // an exeception was thrown, call exception-method hook if
                        // present and return its result as execution result.
                        if (errorMethod) {
                            retValue = errorMethod({
                                object:object,
                                objectName:object.____name,
                                method:fnname,
                                arguments:args,
                                exception:e});
                        } else {
                            // since there's no error hook, just throw the exception
                            throw e;
                        }
                    }

                    // return original returned value to the caller.
                    return retValue;
                };
            })(object, fn, method);
        } else {
            if (method !== "____name") {
                (function (object, attribute, getter, setter) {

                    object["$proxy__" + attribute] = object[attribute];

                    object.__defineGetter__(attribute, function () {
                        if (getter) {
                            getter(object.____name, attribute);
                        }
                        return object["$proxy__" + attribute];
                    });
                    object.__defineSetter__(attribute, function (value) {
                        object["$proxy__" + attribute] = value;
                        if (setter) {
                            setter(object.____name, attribute, value);
                        }
                    });
                })(object, method, getter, setter);
            }
        }
    }

    // return our newly created and populated with functions proxied object.
    return object;
}

CAAT.Module({
    defines : "CAAT.Core.Class",
    extendsWith : function() {

        /**
         * See LICENSE file.
         *
         * Extend a prototype with another to form a classical OOP inheritance procedure.
         *
         * @param subc {object} Prototype to define the base class
         * @param superc {object} Prototype to be extended (derived class).
         */


        return {

        };
    }
});/**
 * See LICENSE file.
 *
 **/

CAAT.Module( {
    defines:    "CAAT.Math.Bezier",
    depends:    ["CAAT.Math.Curve"],
    extendsClass:    "CAAT.Math.Curve",
    aliases:    ["CAAT.Bezier"],
    extendsWith:    function() {
            return {

            cubic:		false,

            applyAsPath : function( director ) {

                var cc= this.coordlist;

                if ( this.cubic ) {
                    director.ctx.bezierCurveTo(
                        cc[1].x,
                        cc[1].y,
                        cc[2].x,
                        cc[2].y,
                        cc[3].x,
                        cc[3].y
                    );
                } else {
                    director.ctx.quadraticCurveTo(
                        cc[1].x,
                        cc[1].y,
                        cc[2].x,
                        cc[2].y
                    );
                }
                return this;
            },
            isQuadric : function() {
                return !this.cubic;
            },
            isCubic : function() {
                return this.cubic;
            },
            /**
             * Set this curve as a cubic bezier defined by the given four control points.
             * @param cp0x {number}
             * @param cp0y {number}
             * @param cp1x {number}
             * @param cp1y {number}
             * @param cp2x {number}
             * @param cp2y {number}
             * @param cp3x {number}
             * @param cp3y {number}
             */
            setCubic : function( cp0x,cp0y, cp1x,cp1y, cp2x,cp2y, cp3x,cp3y ) {

                this.coordlist= [];

                this.coordlist.push( new CAAT.Math.Point().set(cp0x, cp0y ) );
                this.coordlist.push( new CAAT.Math.Point().set(cp1x, cp1y ) );
                this.coordlist.push( new CAAT.Math.Point().set(cp2x, cp2y ) );
                this.coordlist.push( new CAAT.Math.Point().set(cp3x, cp3y ) );

                this.cubic= true;
                this.update();

                return this;
            },
            /**
             * Set this curve as a quadric bezier defined by the three control points.
             * @param cp0x {number}
             * @param cp0y {number}
             * @param cp1x {number}
             * @param cp1y {number}
             * @param cp2x {number}
             * @param cp2y {number}
             */
            setQuadric : function(cp0x,cp0y, cp1x,cp1y, cp2x,cp2y ) {

                this.coordlist= [];

                this.coordlist.push( new CAAT.Math.Point().set(cp0x, cp0y ) );
                this.coordlist.push( new CAAT.Math.Point().set(cp1x, cp1y ) );
                this.coordlist.push( new CAAT.Math.Point().set(cp2x, cp2y ) );

                this.cubic= false;
                this.update();

                return this;
            },
            setPoints : function( points ) {
                if ( points.length===3 ) {
                    this.coordlist= points;
                    this.cubic= false;
                    this.update();
                } else if (points.length===4 ) {
                    this.coordlist= points;
                    this.cubic= true;
                    this.update();
                } else {
                    throw 'points must be an array of 3 or 4 CAAT.Point instances.'
                }

                return this;
            },
            /**
             * Paint this curve.
             * @param director {CAAT.Director}
             */
            paint : function( director ) {
                if ( this.cubic ) {
                    this.paintCubic(director);
                } else {
                    this.paintCuadric( director );
                }

                CAAT.Math.Bezier.superclass.paint.call(this,director);

            },
            /**
             * Paint this quadric Bezier curve. Each time the curve is drawn it will be solved again from 0 to 1 with
             * CAAT.Bezier.k increments.
             *
             * @param director {CAAT.Director}
             * @private
             */
            paintCuadric : function( director ) {
                var x1,y1;
                x1 = this.coordlist[0].x;
                y1 = this.coordlist[0].y;

                var ctx= director.ctx;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x1,y1);

                var point= new CAAT.Math.Point();
                for(var t=this.k;t<=1+this.k;t+=this.k){
                    this.solve(point,t);
                    ctx.lineTo(point.x, point.y );
                }

                ctx.stroke();
                ctx.restore();

            },
            /**
             * Paint this cubic Bezier curve. Each time the curve is drawn it will be solved again from 0 to 1 with
             * CAAT.Bezier.k increments.
             *
             * @param director {CAAT.Director}
             * @private
             */
            paintCubic : function( director ) {

                var x1,y1;
                x1 = this.coordlist[0].x;
                y1 = this.coordlist[0].y;

                var ctx= director.ctx;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x1,y1);

                var point= new CAAT.Math.Point();
                for(var t=this.k;t<=1+this.k;t+=this.k){
                    this.solve(point,t);
                    ctx.lineTo(point.x, point.y );
                }

                ctx.stroke();
                ctx.restore();
            },
            /**
             * Solves the curve for any given parameter t.
             * @param point {CAAT.Point} the point to store the solved value on the curve.
             * @param t {number} a number in the range 0..1
             */
            solve : function(point,t) {
                if ( this.cubic ) {
                    return this.solveCubic(point,t);
                } else {
                    return this.solveQuadric(point,t);
                }
            },
            /**
             * Solves a cubic Bezier.
             * @param point {CAAT.Point} the point to store the solved value on the curve.
             * @param t {number} the value to solve the curve for.
             */
            solveCubic : function(point,t) {

                var t2= t*t;
                var t3= t*t2;

                var cl= this.coordlist;
                var cl0= cl[0];
                var cl1= cl[1];
                var cl2= cl[2];
                var cl3= cl[3];

                point.x=(
                    cl0.x + t * (-cl0.x * 3 + t * (3 * cl0.x-
                    cl0.x*t)))+t*(3*cl1.x+t*(-6*cl1.x+
                    cl1.x*3*t))+t2*(cl2.x*3-cl2.x*3*t)+
                    cl3.x * t3;

                point.y=(
                        cl0.y+t*(-cl0.y*3+t*(3*cl0.y-
                        cl0.y*t)))+t*(3*cl1.y+t*(-6*cl1.y+
                        cl1.y*3*t))+t2*(cl2.y*3-cl2.y*3*t)+
                        cl3.y * t3;

                return point;
            },
            /**
             * Solves a quadric Bezier.
             * @param point {CAAT.Point} the point to store the solved value on the curve.
             * @param t {number} the value to solve the curve for.
             */
            solveQuadric : function(point,t) {
                var cl= this.coordlist;
                var cl0= cl[0];
                var cl1= cl[1];
                var cl2= cl[2];
                var t1= 1-t;

                point.x= t1*t1*cl0.x + 2*t1*t*cl1.x + t*t*cl2.x;
                point.y= t1*t1*cl0.y + 2*t1*t*cl1.y + t*t*cl2.y;

                return point;
            }
        }
    }
});
CAAT.Module({
    defines:"CAAT.Math.CatmullRom",
    depends:["CAAT.Math.Curve"],
    extendsClass:"CAAT.Math.Curve",
    aliases:["CAAT.CatmullRom"],
    extendsWith:function () {
        return {

            /**
             * Set curve control points.
             * @param p0 <CAAT.Point>
             * @param p1 <CAAT.Point>
             * @param p2 <CAAT.Point>
             * @param p3 <CAAT.Point>
             */
            setCurve:function (p0, p1, p2, p3) {

                this.coordlist = [];
                this.coordlist.push(p0);
                this.coordlist.push(p1);
                this.coordlist.push(p2);
                this.coordlist.push(p3);

                this.update();

                return this;
            },
            /**
             * Paint the contour by solving again the entire curve.
             * @param director {CAAT.Director}
             */
            paint:function (director) {

                var x1, y1;

                // Catmull rom solves from point 1 !!!

                x1 = this.coordlist[1].x;
                y1 = this.coordlist[1].y;

                var ctx = director.ctx;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x1, y1);

                var point = new CAAT.Point();

                for (var t = this.k; t <= 1 + this.k; t += this.k) {
                    this.solve(point, t);
                    ctx.lineTo(point.x, point.y);
                }

                ctx.stroke();
                ctx.restore();

                CAAT.Math.CatmullRom.superclass.paint.call(this, director);
            },
            /**
             * Solves the curve for any given parameter t.
             * @param point {CAAT.Point} the point to store the solved value on the curve.
             * @param t {number} a number in the range 0..1
             */
            solve:function (point, t) {
                var c = this.coordlist;

                // Handy from CAKE. Thanks.
                var af = ((-t + 2) * t - 1) * t * 0.5
                var bf = (((3 * t - 5) * t) * t + 2) * 0.5
                var cf = ((-3 * t + 4) * t + 1) * t * 0.5
                var df = ((t - 1) * t * t) * 0.5

                point.x = c[0].x * af + c[1].x * bf + c[2].x * cf + c[3].x * df;
                point.y = c[0].y * af + c[1].y * bf + c[2].y * cf + c[3].y * df;

                return point;

            },

            applyAsPath:function (director) {

                var ctx = director.ctx;

                var point = new CAAT.Math.Point();

                for (var t = this.k; t <= 1 + this.k; t += this.k) {
                    this.solve(point, t);
                    ctx.lineTo(point.x, point.y);
                }

                return this;
            },

            /**
             * Return the first curve control point.
             * @return {CAAT.Point}
             */
            endCurvePosition:function () {
                return this.coordlist[ this.coordlist.length - 2 ];
            },
            /**
             * Return the last curve control point.
             * @return {CAAT.Point}
             */
            startCurvePosition:function () {
                return this.coordlist[ 1 ];
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 **/

CAAT.Module({
    defines:"CAAT.Math.Curve",
    depends:["CAAT.Math.Point"],
    extendsWith:function () {

        return {
            coordlist:null,
            k:0.05,
            length:-1,
            interpolator:false,
            HANDLE_SIZE:20,
            drawHandles:true,

            /**
             * Paint the curve control points.
             * @param director {CAAT.Director}
             */
            paint:function (director) {
                if (false === this.drawHandles) {
                    return;
                }

                var cl = this.coordlist;
                var ctx = director.ctx;

                // control points
                ctx.save();
                ctx.beginPath();

                ctx.strokeStyle = '#a0a0a0';
                ctx.moveTo(cl[0].x, cl[0].y);
                ctx.lineTo(cl[1].x, cl[1].y);
                ctx.stroke();
                if (this.cubic) {
                    ctx.moveTo(cl[2].x, cl[2].y);
                    ctx.lineTo(cl[3].x, cl[3].y);
                    ctx.stroke();
                }


                ctx.globalAlpha = 0.5;
                for (var i = 0; i < this.coordlist.length; i++) {
                    ctx.fillStyle = '#7f7f00';
                    var w = this.HANDLE_SIZE / 2;
                    ctx.beginPath();
                    ctx.arc(cl[i].x, cl[i].y, w, 0, 2 * Math.PI, false);
                    ctx.fill();
                }

                ctx.restore();
            },
            /**
             * Signal the curve has been modified and recalculate curve length.
             */
            update:function () {
                this.calcLength();
            },
            /**
             * This method must be overriden by subclasses. It is called whenever the curve must be solved for some time=t.
             * The t parameter must be in the range 0..1
             * @param point {CAAT.Point} to store curve solution for t.
             * @param t {number}
             * @return {CAAT.Point} the point parameter.
             */
            solve:function (point, t) {
            },
            /**
             * Get an array of points defining the curve contour.
             * @param numSamples {number} number of segments to get.
             */
            getContour:function (numSamples) {
                var contour = [], i;

                for (i = 0; i <= numSamples; i++) {
                    var point = new CAAT.Math.Point();
                    this.solve(point, i / numSamples);
                    contour.push(point);
                }

                return contour;
            },
            /**
             * Calculates a curve bounding box.
             *
             * @param rectangle {CAAT.Rectangle} a rectangle to hold the bounding box.
             * @return {CAAT.Rectangle} the rectangle parameter.
             */
            getBoundingBox:function (rectangle) {
                if (!rectangle) {
                    rectangle = new CAAT.Math.Rectangle();
                }

                // thanks yodesoft.com for spotting the first point is out of the BB
                rectangle.setEmpty();
                rectangle.union(this.coordlist[0].x, this.coordlist[0].y);

                var pt = new CAAT.Math.Point();
                for (var t = this.k; t <= 1 + this.k; t += this.k) {
                    this.solve(pt, t);
                    rectangle.union(pt.x, pt.y);
                }

                return rectangle;
            },
            /**
             * Calculate the curve length by incrementally solving the curve every substep=CAAT.Curve.k. This value defaults
             * to .05 so at least 20 iterations will be performed.
             *
             * @return {number} the approximate curve length.
             */
            calcLength:function () {
                var x1, y1;
                x1 = this.coordlist[0].x;
                y1 = this.coordlist[0].y;
                var llength = 0;
                var pt = new CAAT.Math.Point();
                for (var t = this.k; t <= 1 + this.k; t += this.k) {
                    this.solve(pt, t);
                    llength += Math.sqrt((pt.x - x1) * (pt.x - x1) + (pt.y - y1) * (pt.y - y1));
                    x1 = pt.x;
                    y1 = pt.y;
                }

                this.length = llength;
                return llength;
            },
            /**
             * Return the cached curve length.
             * @return {number} the cached curve length.
             */
            getLength:function () {
                return this.length;
            },
            /**
             * Return the first curve control point.
             * @return {CAAT.Point}
             */
            endCurvePosition:function () {
                return this.coordlist[ this.coordlist.length - 1 ];
            },
            /**
             * Return the last curve control point.
             * @return {CAAT.Point}
             */
            startCurvePosition:function () {
                return this.coordlist[ 0 ];
            },

            setPoints:function (points) {
            },

            setPoint:function (point, index) {
                if (index >= 0 && index < this.coordlist.length) {
                    this.coordlist[index] = point;
                }
            },
            /**
             *
             * @param director <=CAAT.Director>
             */
            applyAsPath:function (director) {
            }
        }
    }

});

CAAT.Module({
    defines:"CAAT.Math.Dimension",
    aliases:["CAAT.Dimension"],
    extendsWith:function () {
        return {

            width:0,
            height:0,

            __init:function (w, h) {
                this.width = w;
                this.height = h;
                return this;
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 **/


CAAT.Module({
    defines:"CAAT.Math.Matrix",
    depends:["CAAT.Math.Point"],
    aliases:["CAAT.Matrix"],
    onCreate : function() {
        CAAT.Math.Matrix.prototype.transformRenderingContext= CAAT.Math.Matrix.prototype.transformRenderingContext_NoClamp;
        CAAT.Math.Matrix.prototype.transformRenderingContextSet= CAAT.Math.Matrix.prototype.transformRenderingContextSet_NoClamp;
    },
    extendsWith:function () {
        return {
            matrix:null,

            __init:function () {
                this.matrix = [
                    1.0, 0.0, 0.0,
                    0.0, 1.0, 0.0, 0.0, 0.0, 1.0 ];

                if (typeof Float32Array !== "undefined") {
                    this.matrix = new Float32Array(this.matrix);
                }

                return this;
            },

            /**
             * Transform a point by this matrix. The parameter point will be modified with the transformation values.
             * @param point {CAAT.Point}.
             * @return {CAAT.Point} the parameter point.
             */
            transformCoord:function (point) {
                var x = point.x;
                var y = point.y;

                var tm = this.matrix;

                point.x = x * tm[0] + y * tm[1] + tm[2];
                point.y = x * tm[3] + y * tm[4] + tm[5];

                return point;
            },
            /**
             * Create a new rotation matrix and set it up for the specified angle in radians.
             * @param angle {number}
             * @return {CAAT.Matrix} a matrix object.
             *
             * @static
             */
            rotate:function (angle) {
                var m = new CAAT.Math.Matrix();
                m.setRotation(angle);
                return m;
            },
            setRotation:function (angle) {

                this.identity();

                var tm = this.matrix;
                var c = Math.cos(angle);
                var s = Math.sin(angle);
                tm[0] = c;
                tm[1] = -s;
                tm[3] = s;
                tm[4] = c;

                return this;
            },
            /**
             * Create a scale matrix.
             * @param scalex {number} x scale magnitude.
             * @param scaley {number} y scale magnitude.
             *
             * @return {CAAT.Matrix} a matrix object.
             *
             * @static
             */
            scale:function (scalex, scaley) {
                var m = new CAAT.Math.Matrix();

                m.matrix[0] = scalex;
                m.matrix[4] = scaley;

                return m;
            },
            setScale:function (scalex, scaley) {
                this.identity();

                this.matrix[0] = scalex;
                this.matrix[4] = scaley;

                return this;
            },
            /**
             * Create a translation matrix.
             * @param x {number} x translation magnitude.
             * @param y {number} y translation magnitude.
             *
             * @return {CAAT.Matrix} a matrix object.
             * @static
             *
             */
            translate:function (x, y) {
                var m = new CAAT.Math.Matrix();

                m.matrix[2] = x;
                m.matrix[5] = y;

                return m;
            },
            /**
             * Sets this matrix as a translation matrix.
             * @param x
             * @param y
             */
            setTranslate:function (x, y) {
                this.identity();

                this.matrix[2] = x;
                this.matrix[5] = y;

                return this;
            },
            /**
             * Copy into this matrix the given matrix values.
             * @param matrix {CAAT.Matrix}
             * @return this
             */
            copy:function (matrix) {
                matrix = matrix.matrix;

                var tmatrix = this.matrix;
                tmatrix[0] = matrix[0];
                tmatrix[1] = matrix[1];
                tmatrix[2] = matrix[2];
                tmatrix[3] = matrix[3];
                tmatrix[4] = matrix[4];
                tmatrix[5] = matrix[5];
                tmatrix[6] = matrix[6];
                tmatrix[7] = matrix[7];
                tmatrix[8] = matrix[8];

                return this;
            },
            /**
             * Set this matrix to the identity matrix.
             * @return this
             */
            identity:function () {

                var m = this.matrix;
                m[0] = 1.0;
                m[1] = 0.0;
                m[2] = 0.0;

                m[3] = 0.0;
                m[4] = 1.0;
                m[5] = 0.0;

                m[6] = 0.0;
                m[7] = 0.0;
                m[8] = 1.0;

                return this;
            },
            /**
             * Multiply this matrix by a given matrix.
             * @param m {CAAT.Matrix}
             * @return this
             */
            multiply:function (m) {

                var tm = this.matrix;
                var mm = m.matrix;

                var tm0 = tm[0];
                var tm1 = tm[1];
                var tm2 = tm[2];
                var tm3 = tm[3];
                var tm4 = tm[4];
                var tm5 = tm[5];
                var tm6 = tm[6];
                var tm7 = tm[7];
                var tm8 = tm[8];

                var mm0 = mm[0];
                var mm1 = mm[1];
                var mm2 = mm[2];
                var mm3 = mm[3];
                var mm4 = mm[4];
                var mm5 = mm[5];
                var mm6 = mm[6];
                var mm7 = mm[7];
                var mm8 = mm[8];

                tm[0] = tm0 * mm0 + tm1 * mm3 + tm2 * mm6;
                tm[1] = tm0 * mm1 + tm1 * mm4 + tm2 * mm7;
                tm[2] = tm0 * mm2 + tm1 * mm5 + tm2 * mm8;
                tm[3] = tm3 * mm0 + tm4 * mm3 + tm5 * mm6;
                tm[4] = tm3 * mm1 + tm4 * mm4 + tm5 * mm7;
                tm[5] = tm3 * mm2 + tm4 * mm5 + tm5 * mm8;
                tm[6] = tm6 * mm0 + tm7 * mm3 + tm8 * mm6;
                tm[7] = tm6 * mm1 + tm7 * mm4 + tm8 * mm7;
                tm[8] = tm6 * mm2 + tm7 * mm5 + tm8 * mm8;

                return this;
            },
            /**
             * Premultiply this matrix by a given matrix.
             * @param m {CAAT.Matrix}
             * @return this
             */
            premultiply:function (m) {

                var m00 = m.matrix[0] * this.matrix[0] + m.matrix[1] * this.matrix[3] + m.matrix[2] * this.matrix[6];
                var m01 = m.matrix[0] * this.matrix[1] + m.matrix[1] * this.matrix[4] + m.matrix[2] * this.matrix[7];
                var m02 = m.matrix[0] * this.matrix[2] + m.matrix[1] * this.matrix[5] + m.matrix[2] * this.matrix[8];

                var m10 = m.matrix[3] * this.matrix[0] + m.matrix[4] * this.matrix[3] + m.matrix[5] * this.matrix[6];
                var m11 = m.matrix[3] * this.matrix[1] + m.matrix[4] * this.matrix[4] + m.matrix[5] * this.matrix[7];
                var m12 = m.matrix[3] * this.matrix[2] + m.matrix[4] * this.matrix[5] + m.matrix[5] * this.matrix[8];

                var m20 = m.matrix[6] * this.matrix[0] + m.matrix[7] * this.matrix[3] + m.matrix[8] * this.matrix[6];
                var m21 = m.matrix[6] * this.matrix[1] + m.matrix[7] * this.matrix[4] + m.matrix[8] * this.matrix[7];
                var m22 = m.matrix[6] * this.matrix[2] + m.matrix[7] * this.matrix[5] + m.matrix[8] * this.matrix[8];

                this.matrix[0] = m00;
                this.matrix[1] = m01;
                this.matrix[2] = m02;

                this.matrix[3] = m10;
                this.matrix[4] = m11;
                this.matrix[5] = m12;

                this.matrix[6] = m20;
                this.matrix[7] = m21;
                this.matrix[8] = m22;


                return this;
            },
            /**
             * Creates a new inverse matrix from this matrix.
             * @return {CAAT.Matrix} an inverse matrix.
             */
            getInverse:function () {
                var tm = this.matrix;

                var m00 = tm[0];
                var m01 = tm[1];
                var m02 = tm[2];
                var m10 = tm[3];
                var m11 = tm[4];
                var m12 = tm[5];
                var m20 = tm[6];
                var m21 = tm[7];
                var m22 = tm[8];

                var newMatrix = new CAAT.Math.Matrix();

                var determinant = m00 * (m11 * m22 - m21 * m12) - m10 * (m01 * m22 - m21 * m02) + m20 * (m01 * m12 - m11 * m02);
                if (determinant === 0) {
                    return null;
                }

                var m = newMatrix.matrix;

                m[0] = m11 * m22 - m12 * m21;
                m[1] = m02 * m21 - m01 * m22;
                m[2] = m01 * m12 - m02 * m11;

                m[3] = m12 * m20 - m10 * m22;
                m[4] = m00 * m22 - m02 * m20;
                m[5] = m02 * m10 - m00 * m12;

                m[6] = m10 * m21 - m11 * m20;
                m[7] = m01 * m20 - m00 * m21;
                m[8] = m00 * m11 - m01 * m10;

                newMatrix.multiplyScalar(1 / determinant);

                return newMatrix;
            },
            /**
             * Multiply this matrix by a scalar.
             * @param scalar {number} scalar value
             *
             * @return this
             */
            multiplyScalar:function (scalar) {
                var i;

                for (i = 0; i < 9; i++) {
                    this.matrix[i] *= scalar;
                }

                return this;
            },

            /**
             *
             * @param ctx
             */
            transformRenderingContextSet_NoClamp:function (ctx) {
                var m = this.matrix;
                ctx.setTransform(m[0], m[3], m[1], m[4], m[2], m[5]);
                return this;
            },

            /**
             *
             * @param ctx
             */
            transformRenderingContext_NoClamp:function (ctx) {
                var m = this.matrix;
                ctx.transform(m[0], m[3], m[1], m[4], m[2], m[5]);
                return this;
            },

            /**
             *
             * @param ctx
             */
            transformRenderingContextSet_Clamp:function (ctx) {
                var m = this.matrix;
                ctx.setTransform(m[0], m[3], m[1], m[4], m[2] >> 0, m[5] >> 0);
                return this;
            },

            /**
             *
             * @param ctx
             */
            transformRenderingContext_Clamp:function (ctx) {
                var m = this.matrix;
                ctx.transform(m[0], m[3], m[1], m[4], m[2] >> 0, m[5] >> 0);
                return this;
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 **/

CAAT.Module({
    defines:"CAAT.Math.Matrix3",
    aliases:["CAAT.Matrix3"],
    extendsWith:function () {
        return {
            matrix:null,

            fmatrix:null,

            __init:function () {
                this.matrix = [
                    [1, 0, 0, 0],
                    [0, 1, 0, 0],
                    [0, 0, 1, 0],
                    [0, 0, 0, 1]
                ];

                this.fmatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

                return this;
            },

            transformCoord:function (point) {
                var x = point.x;
                var y = point.y;
                var z = point.z;

                point.x = x * this.matrix[0][0] + y * this.matrix[0][1] + z * this.matrix[0][2] + this.matrix[0][3];
                point.y = x * this.matrix[1][0] + y * this.matrix[1][1] + z * this.matrix[1][2] + this.matrix[1][3];
                point.z = x * this.matrix[2][0] + y * this.matrix[2][1] + z * this.matrix[2][2] + this.matrix[2][3];

                return point;
            },
            initialize:function (x0, y0, z0, x1, y1, z1, x2, y2, z2) {
                this.identity();
                this.matrix[0][0] = x0;
                this.matrix[0][1] = y0;
                this.matrix[0][2] = z0;

                this.matrix[1][0] = x1;
                this.matrix[1][1] = y1;
                this.matrix[1][2] = z1;

                this.matrix[2][0] = x2;
                this.matrix[2][1] = y2;
                this.matrix[2][2] = z2;

                return this;
            },
            initWithMatrix:function (matrixData) {
                this.matrix = matrixData;
                return this;
            },
            flatten:function () {
                var d = this.fmatrix;
                var s = this.matrix;
                d[ 0] = s[0][0];
                d[ 1] = s[1][0];
                d[ 2] = s[2][0];
                d[ 3] = s[3][0];

                d[ 4] = s[0][1];
                d[ 5] = s[1][1];
                d[ 6] = s[2][1];
                d[ 7] = s[2][1];

                d[ 8] = s[0][2];
                d[ 9] = s[1][2];
                d[10] = s[2][2];
                d[11] = s[3][2];

                d[12] = s[0][3];
                d[13] = s[1][3];
                d[14] = s[2][3];
                d[15] = s[3][3];

                return this.fmatrix;
            },

            /**
             * Set this matrix to identity matrix.
             * @return this
             */
            identity:function () {
                for (var i = 0; i < 4; i++) {
                    for (var j = 0; j < 4; j++) {
                        this.matrix[i][j] = (i === j) ? 1.0 : 0.0;
                    }
                }

                return this;
            },
            /**
             * Get this matri'x internal representation data. The bakced structure is a 4x4 array of number.
             */
            getMatrix:function () {
                return this.matrix;
            },
            /**
             * Multiply this matrix by a created rotation matrix. The rotation matrix is set up to rotate around
             * xy axis.
             *
             * @param xy {Number} radians to rotate.
             *
             * @return this
             */
            rotateXY:function (xy) {
                return this.rotate(xy, 0, 0);
            },
            /**
             * Multiply this matrix by a created rotation matrix. The rotation matrix is set up to rotate around
             * xz axis.
             *
             * @param xz {Number} radians to rotate.
             *
             * @return this
             */
            rotateXZ:function (xz) {
                return this.rotate(0, xz, 0);
            },
            /**
             * Multiply this matrix by a created rotation matrix. The rotation matrix is set up to rotate aroind
             * yz axis.
             *
             * @param yz {Number} radians to rotate.
             *
             * @return this
             */
            rotateYZ:function (yz) {
                return this.rotate(0, 0, yz);
            },
            /**
             *
             * @param xy
             * @param xz
             * @param yz
             */
            setRotate:function (xy, xz, yz) {
                var m = this.rotate(xy, xz, yz);
                this.copy(m);
                return this;
            },
            /**
             * Creates a matrix to represent arbitrary rotations around the given planes.
             * @param xy {number} radians to rotate around xy plane.
             * @param xz {number} radians to rotate around xz plane.
             * @param yz {number} radians to rotate around yz plane.
             *
             * @return {CAAT.Matrix3} a newly allocated matrix.
             * @static
             */
            rotate:function (xy, xz, yz) {
                var res = new CAAT.Math.Matrix3();
                var s, c, m;

                if (xy !== 0) {
                    m = new CAAT.Math.Math.Matrix3();
                    s = Math.sin(xy);
                    c = Math.cos(xy);
                    m.matrix[1][1] = c;
                    m.matrix[1][2] = -s;
                    m.matrix[2][1] = s;
                    m.matrix[2][2] = c;
                    res.multiply(m);
                }

                if (xz !== 0) {
                    m = new CAAT.Math.Matrix3();
                    s = Math.sin(xz);
                    c = Math.cos(xz);
                    m.matrix[0][0] = c;
                    m.matrix[0][2] = -s;
                    m.matrix[2][0] = s;
                    m.matrix[2][2] = c;
                    res.multiply(m);
                }

                if (yz !== 0) {
                    m = new CAAT.Math.Matrix3();
                    s = Math.sin(yz);
                    c = Math.cos(yz);
                    m.matrix[0][0] = c;
                    m.matrix[0][1] = -s;
                    m.matrix[1][0] = s;
                    m.matrix[1][1] = c;
                    res.multiply(m);
                }

                return res;
            },
            /**
             * Creates a new matrix being a copy of this matrix.
             * @return {CAAT.Matrix3} a newly allocated matrix object.
             */
            getClone:function () {
                var m = new CAAT.Math.Matrix3();
                m.copy(this);
                return m;
            },
            /**
             * Multiplies this matrix by another matrix.
             *
             * @param n {CAAT.Matrix3} a CAAT.Matrix3 object.
             * @return this
             */
            multiply:function (m) {
                var n = this.getClone();

                var nm = n.matrix;
                var n00 = nm[0][0];
                var n01 = nm[0][1];
                var n02 = nm[0][2];
                var n03 = nm[0][3];

                var n10 = nm[1][0];
                var n11 = nm[1][1];
                var n12 = nm[1][2];
                var n13 = nm[1][3];

                var n20 = nm[2][0];
                var n21 = nm[2][1];
                var n22 = nm[2][2];
                var n23 = nm[2][3];

                var n30 = nm[3][0];
                var n31 = nm[3][1];
                var n32 = nm[3][2];
                var n33 = nm[3][3];

                var mm = m.matrix;
                var m00 = mm[0][0];
                var m01 = mm[0][1];
                var m02 = mm[0][2];
                var m03 = mm[0][3];

                var m10 = mm[1][0];
                var m11 = mm[1][1];
                var m12 = mm[1][2];
                var m13 = mm[1][3];

                var m20 = mm[2][0];
                var m21 = mm[2][1];
                var m22 = mm[2][2];
                var m23 = mm[2][3];

                var m30 = mm[3][0];
                var m31 = mm[3][1];
                var m32 = mm[3][2];
                var m33 = mm[3][3];

                this.matrix[0][0] = n00 * m00 + n01 * m10 + n02 * m20 + n03 * m30;
                this.matrix[0][1] = n00 * m01 + n01 * m11 + n02 * m21 + n03 * m31;
                this.matrix[0][2] = n00 * m02 + n01 * m12 + n02 * m22 + n03 * m32;
                this.matrix[0][3] = n00 * m03 + n01 * m13 + n02 * m23 + n03 * m33;

                this.matrix[1][0] = n10 * m00 + n11 * m10 + n12 * m20 + n13 * m30;
                this.matrix[1][1] = n10 * m01 + n11 * m11 + n12 * m21 + n13 * m31;
                this.matrix[1][2] = n10 * m02 + n11 * m12 + n12 * m22 + n13 * m32;
                this.matrix[1][3] = n10 * m03 + n11 * m13 + n12 * m23 + n13 * m33;

                this.matrix[2][0] = n20 * m00 + n21 * m10 + n22 * m20 + n23 * m30;
                this.matrix[2][1] = n20 * m01 + n21 * m11 + n22 * m21 + n23 * m31;
                this.matrix[2][2] = n20 * m02 + n21 * m12 + n22 * m22 + n23 * m32;
                this.matrix[2][3] = n20 * m03 + n21 * m13 + n22 * m23 + n23 * m33;

                return this;
            },
            /**
             * Pre multiplies this matrix by a given matrix.
             *
             * @param m {CAAT.Matrix3} a CAAT.Matrix3 object.
             *
             * @return this
             */
            premultiply:function (m) {
                var n = this.getClone();

                var nm = n.matrix;
                var n00 = nm[0][0];
                var n01 = nm[0][1];
                var n02 = nm[0][2];
                var n03 = nm[0][3];

                var n10 = nm[1][0];
                var n11 = nm[1][1];
                var n12 = nm[1][2];
                var n13 = nm[1][3];

                var n20 = nm[2][0];
                var n21 = nm[2][1];
                var n22 = nm[2][2];
                var n23 = nm[2][3];

                var n30 = nm[3][0];
                var n31 = nm[3][1];
                var n32 = nm[3][2];
                var n33 = nm[3][3];

                var mm = m.matrix;
                var m00 = mm[0][0];
                var m01 = mm[0][1];
                var m02 = mm[0][2];
                var m03 = mm[0][3];

                var m10 = mm[1][0];
                var m11 = mm[1][1];
                var m12 = mm[1][2];
                var m13 = mm[1][3];

                var m20 = mm[2][0];
                var m21 = mm[2][1];
                var m22 = mm[2][2];
                var m23 = mm[2][3];

                var m30 = mm[3][0];
                var m31 = mm[3][1];
                var m32 = mm[3][2];
                var m33 = mm[3][3];

                this.matrix[0][0] = n00 * m00 + n01 * m10 + n02 * m20;
                this.matrix[0][1] = n00 * m01 + n01 * m11 + n02 * m21;
                this.matrix[0][2] = n00 * m02 + n01 * m12 + n02 * m22;
                this.matrix[0][3] = n00 * m03 + n01 * m13 + n02 * m23 + n03;
                this.matrix[1][0] = n10 * m00 + n11 * m10 + n12 * m20;
                this.matrix[1][1] = n10 * m01 + n11 * m11 + n12 * m21;
                this.matrix[1][2] = n10 * m02 + n11 * m12 + n12 * m22;
                this.matrix[1][3] = n10 * m03 + n11 * m13 + n12 * m23 + n13;
                this.matrix[2][0] = n20 * m00 + n21 * m10 + n22 * m20;
                this.matrix[2][1] = n20 * m01 + n21 * m11 + n22 * m21;
                this.matrix[2][2] = n20 * m02 + n21 * m12 + n22 * m22;
                this.matrix[2][3] = n20 * m03 + n21 * m13 + n22 * m23 + n23;

                return this;
            },
            /**
             * Set this matrix translation values to be the given parameters.
             *
             * @param x {number} x component of translation point.
             * @param y {number} y component of translation point.
             * @param z {number} z component of translation point.
             *
             * @return this
             */
            setTranslate:function (x, y, z) {
                this.identity();
                this.matrix[0][3] = x;
                this.matrix[1][3] = y;
                this.matrix[2][3] = z;
                return this;
            },
            /**
             * Create a translation matrix.
             * @param x {number}
             * @param y {number}
             * @param z {number}
             * @return {CAAT.Matrix3} a new matrix.
             */
            translate:function (x, y, z) {
                var m = new CAAT.Math.Matrix3();
                m.setTranslate(x, y, z);
                return m;
            },
            setScale:function (sx, sy, sz) {
                this.identity();
                this.matrix[0][0] = sx;
                this.matrix[1][1] = sy;
                this.matrix[2][2] = sz;
                return this;
            },
            scale:function (sx, sy, sz) {
                var m = new CAAT.Math.Matrix3();
                m.setScale(sx, sy, sz);
                return m;
            },
            /**
             * Set this matrix as the rotation matrix around the given axes.
             * @param xy {number} radians of rotation around z axis.
             * @param xz {number} radians of rotation around y axis.
             * @param yz {number} radians of rotation around x axis.
             *
             * @return this
             */
            rotateModelView:function (xy, xz, yz) {
                var sxy = Math.sin(xy);
                var sxz = Math.sin(xz);
                var syz = Math.sin(yz);
                var cxy = Math.cos(xy);
                var cxz = Math.cos(xz);
                var cyz = Math.cos(yz);

                this.matrix[0][0] = cxz * cxy;
                this.matrix[0][1] = -cxz * sxy;
                this.matrix[0][2] = sxz;
                this.matrix[0][3] = 0;
                this.matrix[1][0] = syz * sxz * cxy + sxy * cyz;
                this.matrix[1][1] = cyz * cxy - syz * sxz * sxy;
                this.matrix[1][2] = -syz * cxz;
                this.matrix[1][3] = 0;
                this.matrix[2][0] = syz * sxy - cyz * sxz * cxy;
                this.matrix[2][1] = cyz * sxz * sxy + syz * cxy;
                this.matrix[2][2] = cyz * cxz;
                this.matrix[2][3] = 0;
                this.matrix[3][0] = 0;
                this.matrix[3][1] = 0;
                this.matrix[3][2] = 0;
                this.matrix[3][3] = 1;

                return this;
            },
            /**
             * Copy a given matrix values into this one's.
             * @param m {CAAT.Matrix} a matrix
             *
             * @return this
             */
            copy:function (m) {
                for (var i = 0; i < 4; i++) {
                    for (var j = 0; j < 4; j++) {
                        this.matrix[i][j] = m.matrix[i][j];
                    }
                }

                return this;
            },
            /**
             * Calculate this matrix's determinant.
             * @return {number} matrix determinant.
             */
            calculateDeterminant:function () {

                var mm = this.matrix;
                var m11 = mm[0][0], m12 = mm[0][1], m13 = mm[0][2], m14 = mm[0][3],
                    m21 = mm[1][0], m22 = mm[1][1], m23 = mm[1][2], m24 = mm[1][3],
                    m31 = mm[2][0], m32 = mm[2][1], m33 = mm[2][2], m34 = mm[2][3],
                    m41 = mm[3][0], m42 = mm[3][1], m43 = mm[3][2], m44 = mm[3][3];

                return  m14 * m22 * m33 * m41 +
                    m12 * m24 * m33 * m41 +
                    m14 * m23 * m31 * m42 +
                    m13 * m24 * m31 * m42 +

                    m13 * m21 * m34 * m42 +
                    m11 * m23 * m34 * m42 +
                    m14 * m21 * m32 * m43 +
                    m11 * m24 * m32 * m43 +

                    m13 * m22 * m31 * m44 +
                    m12 * m23 * m31 * m44 +
                    m12 * m21 * m33 * m44 +
                    m11 * m22 * m33 * m44 +

                    m14 * m23 * m32 * m41 -
                    m13 * m24 * m32 * m41 -
                    m13 * m22 * m34 * m41 -
                    m12 * m23 * m34 * m41 -

                    m14 * m21 * m33 * m42 -
                    m11 * m24 * m33 * m42 -
                    m14 * m22 * m31 * m43 -
                    m12 * m24 * m31 * m43 -

                    m12 * m21 * m34 * m43 -
                    m11 * m22 * m34 * m43 -
                    m13 * m21 * m32 * m44 -
                    m11 * m23 * m32 * m44;
            },
            /**
             * Return a new matrix which is this matrix's inverse matrix.
             * @return {CAAT.Matrix3} a new matrix.
             */
            getInverse:function () {
                var mm = this.matrix;
                var m11 = mm[0][0], m12 = mm[0][1], m13 = mm[0][2], m14 = mm[0][3],
                    m21 = mm[1][0], m22 = mm[1][1], m23 = mm[1][2], m24 = mm[1][3],
                    m31 = mm[2][0], m32 = mm[2][1], m33 = mm[2][2], m34 = mm[2][3],
                    m41 = mm[3][0], m42 = mm[3][1], m43 = mm[3][2], m44 = mm[3][3];

                var m2 = new CAAT.Math.Matrix3();
                m2.matrix[0][0] = m23 * m34 * m42 + m24 * m32 * m43 + m22 * m33 * m44 - m24 * m33 * m42 - m22 * m34 * m43 - m23 * m32 * m44;
                m2.matrix[0][1] = m14 * m33 * m42 + m12 * m34 * m43 + m13 * m32 * m44 - m12 * m33 * m44 - m13 * m34 * m42 - m14 * m32 * m43;
                m2.matrix[0][2] = m13 * m24 * m42 + m12 * m23 * m44 + m14 * m22 * m43 - m12 * m24 * m43 - m13 * m22 * m44 - m14 * m23 * m42;
                m2.matrix[0][3] = m14 * m23 * m32 + m12 * m24 * m33 + m13 * m22 * m34 - m13 * m24 * m32 - m14 * m22 * m33 - m12 * m23 * m34;

                m2.matrix[1][0] = m24 * m33 * m41 + m21 * m34 * m43 + m23 * m31 * m44 - m23 * m34 * m41 - m24 * m31 * m43 - m21 * m33 * m44;
                m2.matrix[1][1] = m13 * m34 * m41 + m14 * m31 * m43 + m11 * m33 * m44 - m14 * m33 * m41 - m11 * m34 * m43 - m13 * m31 * m44;
                m2.matrix[1][2] = m14 * m23 * m41 + m11 * m24 * m43 + m13 * m21 * m44 - m13 * m24 * m41 - m14 * m21 * m43 - m11 * m23 * m44;
                m2.matrix[1][3] = m13 * m24 * m31 + m14 * m21 * m33 + m11 * m23 * m34 - m14 * m23 * m31 - m11 * m24 * m33 - m13 * m21 * m34;

                m2.matrix[2][0] = m22 * m34 * m41 + m24 * m31 * m42 + m21 * m32 * m44 - m24 * m32 * m41 - m21 * m34 * m42 - m22 * m31 * m44;
                m2.matrix[2][1] = m14 * m32 * m41 + m11 * m34 * m42 + m12 * m31 * m44 - m11 * m32 * m44 - m12 * m34 * m41 - m14 * m31 * m42;
                m2.matrix[2][2] = m13 * m24 * m41 + m14 * m21 * m42 + m11 * m22 * m44 - m14 * m22 * m41 - m11 * m24 * m42 - m12 * m21 * m44;
                m2.matrix[2][3] = m14 * m22 * m31 + m11 * m24 * m32 + m12 * m21 * m34 - m11 * m22 * m34 - m12 * m24 * m31 - m14 * m21 * m32;

                m2.matrix[3][0] = m23 * m32 * m41 + m21 * m33 * m42 + m22 * m31 * m43 - m22 * m33 * m41 - m23 * m31 * m42 - m21 * m32 * m43;
                m2.matrix[3][1] = m12 * m33 * m41 + m13 * m31 * m42 + m11 * m32 * m43 - m13 * m32 * m41 - m11 * m33 * m42 - m12 * m31 * m43;
                m2.matrix[3][2] = m13 * m22 * m41 + m11 * m23 * m42 + m12 * m21 * m43 - m11 * m22 * m43 - m12 * m23 * m41 - m13 * m21 * m42;
                m2.matrix[3][3] = m12 * m23 * m31 + m13 * m21 * m32 + m11 * m22 * m33 - m13 * m22 * m31 - m11 * m23 * m32 - m12 * m21 * m33;

                return m2.multiplyScalar(1 / this.calculateDeterminant());
            },
            /**
             * Multiply this matrix by a scalar.
             * @param scalar {number} scalar value
             *
             * @return this
             */
            multiplyScalar:function (scalar) {
                var i, j;

                for (i = 0; i < 4; i++) {
                    for (j = 0; j < 4; j++) {
                        this.matrix[i][j] *= scalar;
                    }
                }

                return this;
            }

        }
    }

});
/**
 * See LICENSE file.
 *
 **/
CAAT.Module( {

    defines:        "CAAT.Math.Point",
    aliases:        ["CAAT.Point"],
    extendsWith:    function() {
        return {

            /**
             *
             * A point defined by two coordinates.
             *
             * @param xpos {number}
             * @param ypos {number}
             *
             * @constructor
             */
            x:  0,
                y:  0,
            z:  0,

            __init : function(xpos, ypos, zpos) {
            this.x= xpos;
            this.y= ypos;
            this.z= zpos||0;
            return this;
        },

            /**
             * Sets this point coordinates.
             * @param x {number}
             * @param y {number}
             *
             * @return this
             */
            set : function(x,y,z) {
            this.x= x;
            this.y= y;
            this.z= z||0;
            return this;
        },
            /**
             * Create a new CAAT.Point equal to this one.
             * @return {CAAT.Point}
             */
            clone : function() {
                var p= new CAAT.Math.Point(this.x, this.y, this.z );
                return p;
            },
            /**
             * Translate this point to another position. The final point will be (point.x+x, point.y+y)
             * @param x {number}
             * @param y {number}
             *
             * @return this
             */
            translate : function(x,y,z) {
                this.x+= x;
                this.y+= y;
                this.z+= z;

                return this;
            },
            /**
             * Translate this point to another point.
             * @param aPoint {CAAT.Point}
             * @return this
             */
            translatePoint: function(aPoint) {
                this.x += aPoint.x;
                this.y += aPoint.y;
                this.z += aPoint.z;
                return this;
            },
            /**
             * Substract a point from this one.
             * @param aPoint {CAAT.Point}
             * @return this
             */
            subtract: function(aPoint) {
                this.x -= aPoint.x;
                this.y -= aPoint.y;
                this.z -= aPoint.z;
                return this;
            },
            /**
             * Multiply this point by a scalar.
             * @param factor {number}
             * @return this
             */
            multiply: function(factor) {
                this.x *= factor;
                this.y *= factor;
                this.z *= factor;
                return this;
            },
            /**
             * Rotate this point by an angle. The rotation is held by (0,0) coordinate as center.
             * @param angle {number}
             * @return this
             */
            rotate: function(angle) {
                var x = this.x, y = this.y;
                this.x = x * Math.cos(angle) - Math.sin(angle) * y;
                this.y = x * Math.sin(angle) + Math.cos(angle) * y;
                this.z = 0;
                return this;
            },
            /**
             *
             * @param angle {number}
             * @return this
             */
            setAngle: function(angle) {
                var len = this.getLength();
                this.x = Math.cos(angle) * len;
                this.y = Math.sin(angle) * len;
                this.z = 0;
                return this;
            },
            /**
             *
             * @param length {number}
             * @return this
             */
            setLength: function(length)	{
                var len = this.getLength();
                if (len)this.multiply(length / len);
                else this.x = this.y = this.z = length;
                return this;
            },
            /**
             * Normalize this point, that is, both set coordinates proportionally to values raning 0..1
             * @return this
             */
            normalize: function() {
                var len = this.getLength();
                this.x /= len;
                this.y /= len;
                this.z /= len;
                return this;
            },
            /**
             * Return the angle from -Pi to Pi of this point.
             * @return {number}
             */
            getAngle: function() {
                return Math.atan2(this.y, this.x);
            },
            /**
             * Set this point coordinates proportinally to a maximum value.
             * @param max {number}
             * @return this
             */
            limit: function(max) {
                var aLenthSquared = this.getLengthSquared();
                if(aLenthSquared+0.01 > max*max)
                {
                    var aLength = Math.sqrt(aLenthSquared);
                    this.x= (this.x/aLength) * max;
                    this.y= (this.y/aLength) * max;
                    this.z= (this.z/aLength) * max;
                }
                return this;
            },
            /**
             * Get this point's lenght.
             * @return {number}
             */
            getLength: function() {
                var length = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
                if ( length < 0.005 && length > -0.005) return 0.000001;
                return length;

            },
            /**
             * Get this point's squared length.
             * @return {number}
             */
            getLengthSquared: function() {
                var lengthSquared = this.x*this.x + this.y*this.y + this.z*this.z;
                if ( lengthSquared < 0.005 && lengthSquared > -0.005) return 0;
                return lengthSquared;
            },
            /**
             * Get the distance between two points.
             * @param point {CAAT.Point}
             * @return {number}
             */
            getDistance: function(point) {
                var deltaX = this.x - point.x;
                var deltaY = this.y - point.y;
                var deltaZ = this.z - point.z;
                return Math.sqrt( deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ );
            },
            /**
             * Get the squared distance between two points.
             * @param point {CAAT.Point}
             * @return {number}
             */
            getDistanceSquared: function(point) {
                var deltaX = this.x - point.x;
                var deltaY = this.y - point.y;
                var deltaZ = this.z - point.z;
                return deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ;
            },
            /**
             * Get a string representation.
             * @return {string}
             */
            toString: function() {
                return "(CAAT.Math.Point)" +
                    " x:" + String(Math.round(Math.floor(this.x*10))/10) +
                    " y:" + String(Math.round(Math.floor(this.y*10))/10) +
                    " z:" + String(Math.round(Math.floor(this.z*10))/10);
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 */


CAAT.Module( {
    defines:        "CAAT.Math.Rectangle",
    aliases:        ["CAAT.Rectangle"],
    extendsWith:    function() {
        return {

            __init : function( x,y,w,h ) {
                this.setLocation(x,y);
                this.setDimension(w,h);
            },

            x:		0,
            y:		0,
            x1:		0,
            y1:		0,
            width:	-1,
            height:	-1,

            setEmpty : function() {
                this.width=     -1;
                this.height=    -1;
                this.x=         0;
                this.y=         0;
                this.x1=        0;
                this.y1=        0;
                return this;
            },
            /**
             * Set this rectangle's location.
             * @param x {number}
             * @param y {number}
             */
            setLocation: function( x,y ) {
                this.x= x;
                this.y= y;
                this.x1= this.x+this.width;
                this.y1= this.y+this.height;
                return this;
            },
            /**
             * Set this rectangle's dimension.
             * @param w {number}
             * @param h {number}
             */
            setDimension : function( w,h ) {
                this.width= w;
                this.height= h;
                this.x1= this.x+this.width;
                this.y1= this.y+this.height;
                return this;
            },
            setBounds : function( x,y,w,h ) {
                this.setLocation( x, y );
                this.setDimension( w, h );
                return this;
            },
            /**
             * Return whether the coordinate is inside this rectangle.
             * @param px {number}
             * @param py {number}
             *
             * @return {boolean}
             */
            contains : function(px,py) {
                //return px>=0 && px<this.width && py>=0 && py<this.height;
                return px>=this.x && px<this.x1 && py>=this.y && py<this.y1;
            },
            /**
             * Return whether this rectangle is empty, that is, has zero dimension.
             * @return {boolean}
             */
            isEmpty : function() {
                return this.width===-1 && this.height===-1;
            },
            /**
             * Set this rectangle as the union of this rectangle and the given point.
             * @param px {number}
             * @param py {number}
             */
            union : function(px,py) {

                if ( this.isEmpty() ) {
                    this.x= px;
                    this.x1= px;
                    this.y= py;
                    this.y1= py;
                    this.width=0;
                    this.height=0;
                    return;
                }

                this.x1= this.x+this.width;
                this.y1= this.y+this.height;

                if ( py<this.y ) {
                    this.y= py;
                }
                if ( px<this.x ) {
                    this.x= px;
                }
                if ( py>this.y1 ) {
                    this.y1= py;
                }
                if ( px>this.x1 ){
                    this.x1= px;
                }

                this.width= this.x1-this.x;
                this.height= this.y1-this.y;
            },
            unionRectangle : function( rectangle ) {
                this.union( rectangle.x , rectangle.y  );
                this.union( rectangle.x1, rectangle.y  );
                this.union( rectangle.x,  rectangle.y1 );
                this.union( rectangle.x1, rectangle.y1 );
                return this;
            },
            intersects : function( r ) {
                if ( r.isEmpty() || this.isEmpty() ) {
                    return false;
                }

                if ( r.x1<= this.x ) {
                    return false;
                }
                if ( r.x >= this.x1 ) {
                    return false;
                }
                if ( r.y1<= this.y ) {
                    return false;
                }

                return r.y < this.y1;
            },

            intersectsRect : function( x,y,w,h ) {
                if ( -1===w || -1===h ) {
                    return false;
                }

                var x1= x+w-1;
                var y1= y+h-1;

                if ( x1< this.x ) {
                    return false;
                }
                if ( x > this.x1 ) {
                    return false;
                }
                if ( y1< this.y ) {
                    return false;
                }
                return y <= this.y1;

            },

            intersect : function( i, r ) {
                if ( typeof r==='undefined' ) {
                    r= new CAAT.Math.Rectangle();
                }

                r.x= Math.max( this.x, i.x );
                r.y= Math.max( this.y, i.y );
                r.x1=Math.min( this.x1, i.x1 );
                r.y1=Math.min( this.y1, i.y1 );
                r.width= r.x1-r.x;
                r.height=r.y1-r.y;

                return r;
            }
        }
	}
});
/**
 * See LICENSE file.
 *
 * Partially based on Robert Penner easing equations.
 * http://www.robertpenner.com/easing/
 *
 *
 **/

CAAT.Module({
    defines:"CAAT.Behavior.Interpolator",
    depends:["CAAT.Math.Point"],
    aliases:["CAAT.Interpolator"],
    constants : {
        /**
         *
         */
        enumerateInterpolators: function () {
            return [
                new CAAT.Behavior.Interpolator().createLinearInterpolator(false, false), 'Linear pingpong=false, inverse=false',
                new CAAT.Behavior.Interpolator().createLinearInterpolator(true, false), 'Linear pingpong=true, inverse=false',

                new CAAT.Behavior.Interpolator().createLinearInterpolator(false, true), 'Linear pingpong=false, inverse=true',
                new CAAT.Behavior.Interpolator().createLinearInterpolator(true, true), 'Linear pingpong=true, inverse=true',

                new CAAT.Behavior.Interpolator().createExponentialInInterpolator(2, false), 'ExponentialIn pingpong=false, exponent=2',
                new CAAT.Behavior.Interpolator().createExponentialOutInterpolator(2, false), 'ExponentialOut pingpong=false, exponent=2',
                new CAAT.Behavior.Interpolator().createExponentialInOutInterpolator(2, false), 'ExponentialInOut pingpong=false, exponent=2',
                new CAAT.Behavior.Interpolator().createExponentialInInterpolator(2, true), 'ExponentialIn pingpong=true, exponent=2',
                new CAAT.Behavior.Interpolator().createExponentialOutInterpolator(2, true), 'ExponentialOut pingpong=true, exponent=2',
                new CAAT.Behavior.Interpolator().createExponentialInOutInterpolator(2, true), 'ExponentialInOut pingpong=true, exponent=2',

                new CAAT.Behavior.Interpolator().createExponentialInInterpolator(4, false), 'ExponentialIn pingpong=false, exponent=4',
                new CAAT.Behavior.Interpolator().createExponentialOutInterpolator(4, false), 'ExponentialOut pingpong=false, exponent=4',
                new CAAT.Behavior.Interpolator().createExponentialInOutInterpolator(4, false), 'ExponentialInOut pingpong=false, exponent=4',
                new CAAT.Behavior.Interpolator().createExponentialInInterpolator(4, true), 'ExponentialIn pingpong=true, exponent=4',
                new CAAT.Behavior.Interpolator().createExponentialOutInterpolator(4, true), 'ExponentialOut pingpong=true, exponent=4',
                new CAAT.Behavior.Interpolator().createExponentialInOutInterpolator(4, true), 'ExponentialInOut pingpong=true, exponent=4',

                new CAAT.Behavior.Interpolator().createExponentialInInterpolator(6, false), 'ExponentialIn pingpong=false, exponent=6',
                new CAAT.Behavior.Interpolator().createExponentialOutInterpolator(6, false), 'ExponentialOut pingpong=false, exponent=6',
                new CAAT.Behavior.Interpolator().createExponentialInOutInterpolator(6, false), 'ExponentialInOut pingpong=false, exponent=6',
                new CAAT.Behavior.Interpolator().createExponentialInInterpolator(6, true), 'ExponentialIn pingpong=true, exponent=6',
                new CAAT.Behavior.Interpolator().createExponentialOutInterpolator(6, true), 'ExponentialOut pingpong=true, exponent=6',
                new CAAT.Behavior.Interpolator().createExponentialInOutInterpolator(6, true), 'ExponentialInOut pingpong=true, exponent=6',

                new CAAT.Behavior.Interpolator().createBounceInInterpolator(false), 'BounceIn pingpong=false',
                new CAAT.Behavior.Interpolator().createBounceOutInterpolator(false), 'BounceOut pingpong=false',
                new CAAT.Behavior.Interpolator().createBounceInOutInterpolator(false), 'BounceInOut pingpong=false',
                new CAAT.Behavior.Interpolator().createBounceInInterpolator(true), 'BounceIn pingpong=true',
                new CAAT.Behavior.Interpolator().createBounceOutInterpolator(true), 'BounceOut pingpong=true',
                new CAAT.Behavior.Interpolator().createBounceInOutInterpolator(true), 'BounceInOut pingpong=true',

                new CAAT.Behavior.Interpolator().createElasticInInterpolator(1.1, 0.4, false), 'ElasticIn pingpong=false, amp=1.1, d=.4',
                new CAAT.Behavior.Interpolator().createElasticOutInterpolator(1.1, 0.4, false), 'ElasticOut pingpong=false, amp=1.1, d=.4',
                new CAAT.Behavior.Interpolator().createElasticInOutInterpolator(1.1, 0.4, false), 'ElasticInOut pingpong=false, amp=1.1, d=.4',
                new CAAT.Behavior.Interpolator().createElasticInInterpolator(1.1, 0.4, true), 'ElasticIn pingpong=true, amp=1.1, d=.4',
                new CAAT.Behavior.Interpolator().createElasticOutInterpolator(1.1, 0.4, true), 'ElasticOut pingpong=true, amp=1.1, d=.4',
                new CAAT.Behavior.Interpolator().createElasticInOutInterpolator(1.1, 0.4, true), 'ElasticInOut pingpong=true, amp=1.1, d=.4',

                new CAAT.Behavior.Interpolator().createElasticInInterpolator(1.0, 0.2, false), 'ElasticIn pingpong=false, amp=1.0, d=.2',
                new CAAT.Behavior.Interpolator().createElasticOutInterpolator(1.0, 0.2, false), 'ElasticOut pingpong=false, amp=1.0, d=.2',
                new CAAT.Behavior.Interpolator().createElasticInOutInterpolator(1.0, 0.2, false), 'ElasticInOut pingpong=false, amp=1.0, d=.2',
                new CAAT.Behavior.Interpolator().createElasticInInterpolator(1.0, 0.2, true), 'ElasticIn pingpong=true, amp=1.0, d=.2',
                new CAAT.Behavior.Interpolator().createElasticOutInterpolator(1.0, 0.2, true), 'ElasticOut pingpong=true, amp=1.0, d=.2',
                new CAAT.Behavior.Interpolator().createElasticInOutInterpolator(1.0, 0.2, true), 'ElasticInOut pingpong=true, amp=1.0, d=.2'
            ];
        }        
    },
    extendsWith:function () {

        return {

            interpolated:null, // a coordinate holder for not building a new CAAT.Point for each interpolation call.
            paintScale:90, // the size of the interpolation draw on screen in pixels.

            __init:function () {
                this.interpolated = new CAAT.Math.Point(0, 0, 0);
                return this;
            },

            /**
             * Set a linear interpolation function.
             *
             * @param bPingPong {boolean}
             * @param bInverse {boolean} will values will be from 1 to 0 instead of 0 to 1 ?.
             */
            createLinearInterpolator:function (bPingPong, bInverse) {
                /**
                 * Linear and inverse linear interpolation function.
                 * @param time {number}
                 */
                this.getPosition = function getPosition(time) {

                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    if (bInverse !== null && bInverse) {
                        time = 1 - time;
                    }

                    return this.interpolated.set(orgTime, time);
                };

                return this;
            },
            createBackOutInterpolator:function (bPingPong) {
                this.getPosition = function getPosition(time) {
                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    time = time - 1;
                    var overshoot = 1.70158;

                    return this.interpolated.set(
                        orgTime,
                        time * time * ((overshoot + 1) * time + overshoot) + 1);
                };

                return this;
            },
            /**
             * Set an exponential interpolator function. The function to apply will be Math.pow(time,exponent).
             * This function starts with 0 and ends in values of 1.
             *
             * @param exponent {number} exponent of the function.
             * @param bPingPong {boolean}
             */
            createExponentialInInterpolator:function (exponent, bPingPong) {
                this.getPosition = function getPosition(time) {
                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }
                    return this.interpolated.set(orgTime, Math.pow(time, exponent));
                };

                return this;
            },
            /**
             * Set an exponential interpolator function. The function to apply will be 1-Math.pow(time,exponent).
             * This function starts with 1 and ends in values of 0.
             *
             * @param exponent {number} exponent of the function.
             * @param bPingPong {boolean}
             */
            createExponentialOutInterpolator:function (exponent, bPingPong) {
                this.getPosition = function getPosition(time) {
                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }
                    return this.interpolated.set(orgTime, 1 - Math.pow(1 - time, exponent));
                };

                return this;
            },
            /**
             * Set an exponential interpolator function. Two functions will apply:
             * Math.pow(time*2,exponent)/2 for the first half of the function (t<0.5) and
             * 1-Math.abs(Math.pow(time*2-2,exponent))/2 for the second half (t>=.5)
             * This function starts with 0 and goes to values of 1 and ends with values of 0.
             *
             * @param exponent {number} exponent of the function.
             * @param bPingPong {boolean}
             */
            createExponentialInOutInterpolator:function (exponent, bPingPong) {
                this.getPosition = function getPosition(time) {
                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }
                    if (time * 2 < 1) {
                        return this.interpolated.set(orgTime, Math.pow(time * 2, exponent) / 2);
                    }

                    return this.interpolated.set(orgTime, 1 - Math.abs(Math.pow(time * 2 - 2, exponent)) / 2);
                };

                return this;
            },
            /**
             * Creates a Quadric bezier curbe as interpolator.
             *
             * @param p0 {CAAT.Math.Point}
             * @param p1 {CAAT.Math.Point}
             * @param p2 {CAAT.Math.Point}
             * @param bPingPong {boolean} a boolean indicating if the interpolator must ping-pong.
             */
            createQuadricBezierInterpolator:function (p0, p1, p2, bPingPong) {
                this.getPosition = function getPosition(time) {
                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    time = (1 - time) * (1 - time) * p0.y + 2 * (1 - time) * time * p1.y + time * time * p2.y;

                    return this.interpolated.set(orgTime, time);
                };

                return this;
            },
            /**
             * Creates a Cubic bezier curbe as interpolator.
             *
             * @param p0 {CAAT.Math.Point}
             * @param p1 {CAAT.Math.Point}
             * @param p2 {CAAT.Math.Point}
             * @param p3 {CAAT.Math.Point}
             * @param bPingPong {boolean} a boolean indicating if the interpolator must ping-pong.
             */
            createCubicBezierInterpolator:function (p0, p1, p2, p3, bPingPong) {
                this.getPosition = function getPosition(time) {
                    var orgTime = time;

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    var t2 = time * time;
                    var t3 = time * t2;

                    time = (p0.y + time * (-p0.y * 3 + time * (3 * p0.y -
                        p0.y * time))) + time * (3 * p1.y + time * (-6 * p1.y +
                        p1.y * 3 * time)) + t2 * (p2.y * 3 - p2.y * 3 * time) +
                        p3.y * t3;

                    return this.interpolated.set(orgTime, time);
                };

                return this;
            },
            createElasticOutInterpolator:function (amplitude, p, bPingPong) {
                this.getPosition = function getPosition(time) {

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    if (time === 0) {
                        return {x:0, y:0};
                    }
                    if (time === 1) {
                        return {x:1, y:1};
                    }

                    var s = p / (2 * Math.PI) * Math.asin(1 / amplitude);
                    return this.interpolated.set(
                        time,
                        (amplitude * Math.pow(2, -10 * time) * Math.sin((time - s) * (2 * Math.PI) / p) + 1 ));
                };
                return this;
            },
            createElasticInInterpolator:function (amplitude, p, bPingPong) {
                this.getPosition = function getPosition(time) {

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    if (time === 0) {
                        return {x:0, y:0};
                    }
                    if (time === 1) {
                        return {x:1, y:1};
                    }

                    var s = p / (2 * Math.PI) * Math.asin(1 / amplitude);
                    return this.interpolated.set(
                        time,
                        -(amplitude * Math.pow(2, 10 * (time -= 1)) * Math.sin((time - s) * (2 * Math.PI) / p) ));
                };

                return this;
            },
            createElasticInOutInterpolator:function (amplitude, p, bPingPong) {
                this.getPosition = function getPosition(time) {

                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    var s = p / (2 * Math.PI) * Math.asin(1 / amplitude);
                    time *= 2;
                    if (time <= 1) {
                        return this.interpolated.set(
                            time,
                            -0.5 * (amplitude * Math.pow(2, 10 * (time -= 1)) * Math.sin((time - s) * (2 * Math.PI) / p)));
                    }

                    return this.interpolated.set(
                        time,
                        1 + 0.5 * (amplitude * Math.pow(2, -10 * (time -= 1)) * Math.sin((time - s) * (2 * Math.PI) / p)));
                };

                return this;
            },
            /**
             * @param time {number}
             * @private
             */
            bounce:function (time) {
                if ((time /= 1) < (1 / 2.75)) {
                    return {x:time, y:7.5625 * time * time};
                } else if (time < (2 / 2.75)) {
                    return {x:time, y:7.5625 * (time -= (1.5 / 2.75)) * time + 0.75};
                } else if (time < (2.5 / 2.75)) {
                    return {x:time, y:7.5625 * (time -= (2.25 / 2.75)) * time + 0.9375};
                } else {
                    return {x:time, y:7.5625 * (time -= (2.625 / 2.75)) * time + 0.984375};
                }
            },
            createBounceOutInterpolator:function (bPingPong) {
                this.getPosition = function getPosition(time) {
                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }
                    return this.bounce(time);
                };

                return this;
            },
            createBounceInInterpolator:function (bPingPong) {

                this.getPosition = function getPosition(time) {
                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }
                    var r = this.bounce(1 - time);
                    r.y = 1 - r.y;
                    return r;
                };

                return this;
            },
            createBounceInOutInterpolator:function (bPingPong) {

                this.getPosition = function getPosition(time) {
                    if (bPingPong) {
                        if (time < 0.5) {
                            time *= 2;
                        } else {
                            time = 1 - (time - 0.5) * 2;
                        }
                    }

                    var r;
                    if (time < 0.5) {
                        r = this.bounce(1 - time * 2);
                        r.y = (1 - r.y) * 0.5;
                        return r;
                    }
                    r = this.bounce(time * 2 - 1, bPingPong);
                    r.y = r.y * 0.5 + 0.5;
                    return r;
                };

                return this;
            },
            /**
             * Paints an interpolator on screen.
             * @param ctx {CanvasRenderingContext}
             */
            paint:function (ctx) {

                ctx.save();
                ctx.beginPath();

                ctx.moveTo(0, this.getPosition(0).y * this.paintScale);

                for (var i = 0; i <= this.paintScale; i++) {
                    ctx.lineTo(i, this.getPosition(i / this.paintScale).y * this.paintScale);
                }

                ctx.strokeStyle = 'black';
                ctx.stroke();
                ctx.restore();
            },
            /**
             * Gets an array of coordinates which define the polyline of the intepolator's curve contour.
             * Values for both coordinates range from 0 to 1.
             * @param iSize {number} an integer indicating the number of contour segments.
             * @return array{CAAT.Point} of object of the form {x:float, y:float}.
             */
            getContour:function (iSize) {
                var contour = [];
                for (var i = 0; i <= iSize; i++) {
                    contour.push({x:i / iSize, y:this.getPosition(i / iSize).y});
                }

                return contour;
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 * Behaviors are keyframing elements.
 * By using a BehaviorContainer, you can specify different actions on any animation Actor.
 * An undefined number of Behaviors can be defined for each Actor.
 *
 * There're the following Behaviors:
 *  + AlphaBehavior:   controls container/actor global alpha.
 *  + RotateBehavior:  takes control of rotation affine transform.
 *  + ScaleBehavior:   takes control of scaling on x and y axis affine transform.
 *  + Scale1Behavior:  takes control of scaling on x or y axis affine transform.
 *  + PathBehavior:    takes control of translating an Actor/ActorContainer across a path [ie. pathSegment collection].
 *  + GenericBehavior: applies a behavior to any given target object's property, or notifies a callback.
 *
 *
 **/

CAAT.Module({
    defines:        "CAAT.Behavior.BaseBehavior",
    constants:      {
        Status: {
            NOT_STARTED: 0,
            STARTED:    1,
            EXPIRED:    2
        }
    },
    depends:        ["CAAT.Behavior.Interpolator"],
    extendsWith:   function() {

        var DefaultInterpolator=    new CAAT.Behavior.Interpolator().createLinearInterpolator(false);
        var DefaultInterpolatorPP=  new CAAT.Behavior.Interpolator().createLinearInterpolator(true);

        return {
            /**
             * Behavior base class.
             *
             * <p>
             * A behavior is defined by a frame time (behavior duration) and a behavior application function called interpolator.
             * In its default form, a behaviour is applied linearly, that is, the same amount of behavior is applied every same
             * time interval.
             * <p>
             * A concrete Behavior, a rotateBehavior in example, will change a concrete Actor's rotationAngle during the specified
             * period.
             * <p>
             * A behavior is guaranteed to notify (if any observer is registered) on behavior expiration.
             * <p>
             * A behavior can keep an unlimited observers. Observers are objects of the form:
             * <p>
             * <code>
             * {
             *      behaviorExpired : function( behavior, time, actor);
             *      behaviorApplied : function( behavior, time, normalizedTime, actor, value);
             * }
             * </code>
             * <p>
             * <strong>behaviorExpired</strong>: function( behavior, time, actor). This method will be called for any registered observer when
             * the scene time is greater than behavior's startTime+duration. This method will be called regardless of the time
             * granurality.
             * <p>
             * <strong>behaviorApplied</strong> : function( behavior, time, normalizedTime, actor, value). This method will be called once per
             * frame while the behavior is not expired and is in frame time (behavior startTime>=scene time). This method can be
             * called multiple times.
             * <p>
             * Every behavior is applied to a concrete Actor.
             * Every actor must at least define an start and end value. The behavior will set start-value at behaviorStartTime and
             * is guaranteed to apply end-value when scene time= behaviorStartTime+behaviorDuration.
             * <p>
             * You can set behaviors to apply forever that is cyclically. When a behavior is cycle=true, won't notify
             * behaviorExpired to its registered observers.
             * <p>
             * Other Behaviors simply must supply with the method <code>setForTime(time, actor)</code> overriden.
             *
             * @constructor
             */
            __init:function () {
                this.lifecycleListenerList = [];
                this.setDefaultInterpolator();
                return this;
            },

            lifecycleListenerList:null, // observer list.
            behaviorStartTime:-1, // scene time to start applying the behavior
            behaviorDuration:-1, // behavior duration in ms.
            cycleBehavior:false, // apply forever ?

            status: CAAT.Behavior.BaseBehavior.Status.NOT_STARTED, // Status.NOT_STARTED

            interpolator:null, // behavior application function. linear by default.
            actor:null, // actor the Behavior acts on.
            id:0, // an integer id suitable to identify this behavior by number.

            timeOffset:0,

            doValueApplication:true,

            solved:true,

            discardable:false, // is true, this behavior will be removed from the this.actor instance when it expires.

            setValueApplication:function (apply) {
                this.doValueApplication = apply;
                return this;
            },

            setTimeOffset:function (offset) {
                this.timeOffset = offset;
                return this;
            },

            setStatus : function(st) {
                this.status= st;
                return this;
            },

            /**
             * Sets this behavior id.
             * @param id an integer.
             *
             */
            setId:function (id) {
                this.id = id;
                return this;
            },
            /**
             * Sets the default interpolator to a linear ramp, that is, behavior will be applied linearly.
             * @return this
             */
            setDefaultInterpolator:function () {
                this.interpolator = DefaultInterpolator;
                return this;
            },
            /**
             * Sets default interpolator to be linear from 0..1 and from 1..0.
             * @return this
             */
            setPingPong:function () {
                this.interpolator = DefaultInterpolatorPP;
                return this;
            },

            /**
             * Sets behavior start time and duration.
             * Scene time will be the time of the scene the behavior actor is bound to.
             * @param startTime {number} an integer indicating behavior start time in scene time in ms..
             * @param duration {number} an integer indicating behavior duration in ms.
             */
            setFrameTime:function (startTime, duration) {
                this.behaviorStartTime = startTime;
                this.behaviorDuration = duration;
                this.status =CAAT.Behavior.BaseBehavior.Status.NOT_STARTED;

                return this;
            },
            /**
             * Sets behavior start time and duration but instead as setFrameTime which sets initial time as absolute time
             * regarding scene's time, it uses a relative time offset from current scene time.
             * a call to
             *   setFrameTime( scene.time, duration ) is equivalent to
             *   setDelayTime( 0, duration )
             * @param delay {number}
             * @param duration {number}
             */
            setDelayTime:function (delay, duration) {
                this.behaviorStartTime = delay;
                this.behaviorDuration = duration;
                this.status =CAAT.Behavior.BaseBehavior.Status.NOT_STARTED;
                this.solved = false;
                this.expired = false;

                return this;

            },
            setOutOfFrameTime:function () {
                this.status =CAAT.Behavior.BaseBehavior.Status.EXPIRED;
                this.behaviorStartTime = Number.MAX_VALUE;
                this.behaviorDuration = 0;
                return this;
            },
            /**
             * Changes behavior default interpolator to another instance of CAAT.Interpolator.
             * If the behavior is not defined by CAAT.Interpolator factory methods, the interpolation function must return
             * its values in the range 0..1. The behavior will only apply for such value range.
             * @param interpolator a CAAT.Interpolator instance.
             */
            setInterpolator:function (interpolator) {
                this.interpolator = interpolator;
                return this;
            },
            /**
             * This method must no be called directly.
             * The director loop will call this method in orther to apply actor behaviors.
             * @param time the scene time the behaviro is being applied at.
             * @param actor a CAAT.Actor instance the behavior is being applied to.
             */
            apply:function (time, actor) {

                if (!this.solved) {
                    this.behaviorStartTime += time;
                    this.solved = true;
                }

                time += this.timeOffset * this.behaviorDuration;

                var orgTime = time;
                if (this.isBehaviorInTime(time, actor)) {
                    time = this.normalizeTime(time);
                    this.fireBehaviorAppliedEvent(
                        actor,
                        orgTime,
                        time,
                        this.setForTime(time, actor));
                }
            },

            /**
             * Sets the behavior to cycle, ie apply forever.
             * @param bool a boolean indicating whether the behavior is cycle.
             */
            setCycle:function (bool) {
                this.cycleBehavior = bool;
                return this;
            },
            /**
             * Adds an observer to this behavior.
             * @param behaviorListener an observer instance.
             */
            addListener:function (behaviorListener) {
                this.lifecycleListenerList.push(behaviorListener);
                return this;
            },
            /**
             * Remove all registered listeners to the behavior.
             */
            emptyListenerList:function () {
                this.lifecycleListenerList = [];
                return this;
            },
            /**
             * @return an integer indicating the behavior start time in ms..
             */
            getStartTime:function () {
                return this.behaviorStartTime;
            },
            /**
             * @return an integer indicating the behavior duration time in ms.
             */
            getDuration:function () {
                return this.behaviorDuration;

            },
            /**
             * Chekcs whether the behaviour is in scene time.
             * In case it gets out of scene time, and has not been tagged as expired, the behavior is expired and observers
             * are notified about that fact.
             * @param time the scene time to check the behavior against.
             * @param actor the actor the behavior is being applied to.
             * @return a boolean indicating whether the behavior is in scene time.
             */
            isBehaviorInTime:function (time, actor) {

                var st= CAAT.Behavior.BaseBehavior.Status;

                if (this.status === st.EXPIRED || this.behaviorStartTime < 0) {
                    return false;
                }

                if (this.cycleBehavior) {
                    if (time >= this.behaviorStartTime) {
                        time = (time - this.behaviorStartTime) % this.behaviorDuration + this.behaviorStartTime;
                    }
                }

                if (time > this.behaviorStartTime + this.behaviorDuration) {
                    if (this.status !== st.EXPIRED) {
                        this.setExpired(actor, time);
                    }

                    return false;
                }

                if (this.status === st.NOT_STARTED) {
                    this.status = st.STARTED;
                    this.fireBehaviorStartedEvent(actor, time);
                }

                return this.behaviorStartTime <= time; // && time<this.behaviorStartTime+this.behaviorDuration;
            },

            fireBehaviorStartedEvent:function (actor, time) {
                for (var i = 0, l = this.lifecycleListenerList.length; i < l; i++) {
                    var b = this.lifecycleListenerList[i];
                    if (b.behaviorStarted) {
                        b.behaviorStarted(this, time, actor);
                    }
                }
            },

            /**
             * Notify observers about expiration event.
             * @param actor a CAAT.Actor instance
             * @param time an integer with the scene time the behavior was expired at.
             */
            fireBehaviorExpiredEvent:function (actor, time) {
                for (var i = 0, l = this.lifecycleListenerList.length; i < l; i++) {
                    var b = this.lifecycleListenerList[i];
                    if (b.behaviorExpired) {
                        b.behaviorExpired(this, time, actor);
                    }
                }
            },
            /**
             * Notify observers about behavior being applied.
             * @param actor a CAAT.Actor instance the behavior is being applied to.
             * @param time the scene time of behavior application.
             * @param normalizedTime the normalized time (0..1) considering 0 behavior start time and 1
             * behaviorStartTime+behaviorDuration.
             * @param value the value being set for actor properties. each behavior will supply with its own value version.
             */
            fireBehaviorAppliedEvent:function (actor, time, normalizedTime, value) {
                for (var i = 0, l = this.lifecycleListenerList.length; i < l; i++) {
                    var b = this.lifecycleListenerList[i];
                    if (b.behaviorApplied) {
                        b.behaviorApplied(this, time, normalizedTime, actor, value);
                    }
                }
            },
            /**
             * Convert scene time into something more manageable for the behavior.
             * behaviorStartTime will be 0 and behaviorStartTime+behaviorDuration will be 1.
             * the time parameter will be proportional to those values.
             * @param time the scene time to be normalized. an integer.
             */
            normalizeTime:function (time) {
                time = time - this.behaviorStartTime;
                if (this.cycleBehavior) {
                    time %= this.behaviorDuration;
                }

                return this.interpolator.getPosition(time / this.behaviorDuration).y;
            },
            /**
             * Sets the behavior as expired.
             * This method must not be called directly. It is an auxiliary method to isBehaviorInTime method.
             * @param actor {CAAT.Actor}
             * @param time {integer} the scene time.
             *
             * @private
             */
            setExpired:function (actor, time) {
                // set for final interpolator value.
                this.status = CAAT.Behavior.BaseBehavior.Status.EXPIRED;
                this.setForTime(this.interpolator.getPosition(1).y, actor);
                this.fireBehaviorExpiredEvent(actor, time);

                if (this.discardable) {
                    this.actor.removeBehavior(this);
                }
            },
            /**
             * This method must be overriden for every Behavior breed.
             * Must not be called directly.
             * @param actor {CAAT.Actor} a CAAT.Actor instance.
             * @param time {number} an integer with the scene time.
             *
             * @private
             */
            setForTime:function (time, actor) {

            },
            /**
             * @param overrides
             */
            initialize:function (overrides) {
                if (overrides) {
                    for (var i in overrides) {
                        this[i] = overrides[i];
                    }
                }

                return this;
            },

            getPropertyName:function () {
                return "";
            }
        }
    }
});



CAAT.Module({
    defines:"CAAT.Behavior.AlphaBehavior",
    aliases:["CAAT.AlphaBehavior"],
    depends:["CAAT.Behavior.BaseBehavior"],
    extendsClass:"CAAT.Behavior.BaseBehavior",
    extendsWith:function () {
        return {

            startAlpha:0,
            endAlpha:0,

            getPropertyName:function () {
                return "opacity";
            },

            /**
             * Applies corresponding alpha transparency value for a given time.
             *
             * @param time the time to apply the scale for.
             * @param actor the target actor to set transparency for.
             * @return {number} the alpha value set. Normalized from 0 (total transparency) to 1 (total opacity)
             */
            setForTime:function (time, actor) {

                CAAT.Behavior.AlphaBehavior.superclass.setForTime.call(this, time, actor);

                var alpha = (this.startAlpha + time * (this.endAlpha - this.startAlpha));
                if (this.doValueApplication) {
                    actor.setAlpha(alpha);
                }
                return alpha;
            },
            /**
             * Set alpha transparency minimum and maximum value.
             * This value can be coerced by Actor's property isGloblAlpha.
             *
             * @param start {number} a float indicating the starting alpha value.
             * @param end {number} a float indicating the ending alpha value.
             */
            setValues:function (start, end) {
                this.startAlpha = start;
                this.endAlpha = end;
                return this;
            },

            calculateKeyFrameData:function (time) {
                time = this.interpolator.getPosition(time).y;
                return  (this.startAlpha + time * (this.endAlpha - this.startAlpha));
            },

            /**
             * @param prefix {string} browser vendor prefix
             * @param name {string} keyframes animation name
             * @param keyframessize {number} number of keyframes to generate
             * @override
             */
            calculateKeyFramesData:function (prefix, name, keyframessize) {

                if (typeof keyframessize === 'undefined') {
                    keyframessize = 100;
                }
                keyframessize >>= 0;

                var i;
                var kfr;
                var kfd = "@-" + prefix + "-keyframes " + name + " {";

                for (i = 0; i <= keyframessize; i++) {
                    kfr = "" +
                        (i / keyframessize * 100) + "%" + // percentage
                        "{" +
                        "opacity: " + this.calculateKeyFrameData(i / keyframessize) +
                        "}";

                    kfd += kfr;
                }

                kfd += "}";

                return kfd;
            }
        }
    }
});
CAAT.Module({
    defines:"CAAT.Behavior.ContainerBehavior",
    depends:["CAAT.Behavior.BaseBehavior", "CAAT.Behavior.GenericBehavior"],
    aliases: ["CAAT.ContainerBehavior"],
    extendsClass : "CAAT.Behavior.BaseBehavior",
    extendsWith:function () {

        return {

            behaviors:null, // contained behaviors array

            __init:function () {
                this.__super();
                this.behaviors = [];
                return this;
            },

            /**
             * Proportionally change this container duration to its children.
             * @param duration {number} new duration in ms.
             * @return this;
             */
            conformToDuration:function (duration) {
                this.duration = duration;

                var f = duration / this.duration;
                var bh;
                for (var i = 0; i < this.behaviors.length; i++) {
                    bh = this.behaviors[i];
                    bh.setFrameTime(bh.getStartTime() * f, bh.getDuration() * f);
                }

                return this;
            },

            getBehaviorById : function(id) {
                for( var i=0; i<this.behaviors.length; i++ ) {
                    if ( this.behaviors[i].id===id ) {
                        return this.behaviors[i];
                    }
                }

                return null;
            },

            /**
             * Adds a new behavior to the container.
             * @param behavior
             *
             * @override
             */
            addBehavior:function (behavior) {
                this.behaviors.push(behavior);
                behavior.addListener(this);
                return this;
            },
            /**
             * Applies every contained Behaviors.
             * The application time the contained behaviors will receive will be ContainerBehavior related and not the
             * received time.
             * @param time an integer indicating the time to apply the contained behaviors at.
             * @param actor a CAAT.Foundation.Actor instance indicating the actor to apply the behaviors for.
             */
            apply:function (time, actor) {

                if (!this.solved) {
                    this.behaviorStartTime += time;
                    this.solved = true;
                }

                time += this.timeOffset * this.behaviorDuration;

                if (this.isBehaviorInTime(time, actor)) {
                    time -= this.getStartTime();
                    if (this.cycleBehavior) {
                        time %= this.getDuration();
                    }

                    var bh = this.behaviors;
                    for (var i = 0; i < bh.length; i++) {
                        bh[i].apply(time, actor);
                    }
                }
            },
            /**
             * This method is the observer implementation for every contained behavior.
             * If a container is Cycle=true, won't allow its contained behaviors to be expired.
             * @param behavior a CAAT.Behavior.BaseBehavior instance which has been expired.
             * @param time an integer indicating the time at which has become expired.
             * @param actor a CAAT.Foundation.Actor the expired behavior is being applied to.
             */
            behaviorExpired:function (behavior, time, actor) {
                if (this.cycleBehavior) {
                    behavior.setStatus(CAAT.Behavior.BaseBehavior.Status.STARTED);
                }
            },
            /**
             * Implementation method of the behavior.
             * Just call implementation method for its contained behaviors.
             * @param time{number} an integer indicating the time the behavior is being applied at.
             * @param actor{CAAT.Foundation.Actor} an actor the behavior is being applied to.
             */
            setForTime:function (time, actor) {
                var bh = this.behaviors;
                for (var i = 0; i < bh.length; i++) {
                    bh[i].setForTime(time, actor);
                }

                return null;
            },

            setExpired:function (actor, time) {

                //CAAT.Behavior.ContainerBehavior.superclass.setExpired.call(this, actor, time);

                var bh = this.behaviors;
                // set for final interpolator value.
                for (var i = 0; i < bh.length; i++) {
                    var bb = bh[i];
                    if ( bb.status !== CAAT.Behavior.BaseBehavior.Status.EXPIRED) {
                        bb.setExpired(actor, time - this.behaviorStartTime);
                    }
                }

                /**
                 * moved here from the beggining of the method.
                 * allow for expiration observers to reset container behavior and its sub-behaviors
                 * to redeem.
                 */
                CAAT.Behavior.ContainerBehavior.superclass.setExpired.call(this, actor, time);

                return this;
            },

            setFrameTime:function (start, duration) {
                CAAT.Behavior.ContainerBehavior.superclass.setFrameTime.call(this, start, duration);

                var bh = this.behaviors;
                for (var i = 0; i < bh.length; i++) {
                    bh[i].setStatus(CAAT.Behavior.BaseBehavior.Status.NOT_STARTED);
                }
                return this;
            },

            setDelayTime:function (start, duration) {
                CAAT.Behavior.ContainerBehavior.superclass.setDelayTime.call(this, start, duration);

                var bh = this.behaviors;
                for (var i = 0; i < bh.length; i++) {
                    bh[i].setStatus(CAAT.Behavior.BaseBehavior.Status.NOT_STARTED);
                }
                return this;
            },

            calculateKeyFrameData:function (referenceTime, prefix, prevValues) {

                var i;
                var bh;

                var retValue = {};
                var time;
                var cssRuleValue;
                var cssProperty;
                var property;

                for (i = 0; i < this.behaviors.length; i++) {
                    bh = this.behaviors[i];
                    if (bh.status !== CAAT.Behavior.BehaviorConstants.Status.EXPIRED && !(bh instanceof CAAT.Behavior.GenericBehavior)) {

                        // ajustar tiempos:
                        //  time es tiempo normalizado a duracion de comportamiento contenedor.
                        //      1.- desnormalizar
                        time = referenceTime * this.behaviorDuration;

                        //      2.- calcular tiempo relativo de comportamiento respecto a contenedor
                        if (bh.behaviorStartTime <= time && bh.behaviorStartTime + bh.behaviorDuration >= time) {
                            //      3.- renormalizar tiempo reltivo a comportamiento.
                            time = (time - bh.behaviorStartTime) / bh.behaviorDuration;

                            //      4.- obtener valor de comportamiento para tiempo normalizado relativo a contenedor
                            cssRuleValue = bh.calculateKeyFrameData(time);
                            cssProperty = bh.getPropertyName(prefix);

                            if (typeof retValue[cssProperty] === 'undefined') {
                                retValue[cssProperty] = "";
                            }

                            //      5.- asignar a objeto, par de propiedad/valor css
                            retValue[cssProperty] += cssRuleValue + " ";
                        }

                    }
                }


                var tr = "";
                var pv;

                function xx(pr) {
                    if (retValue[pr]) {
                        tr += retValue[pr];
                    } else {
                        if (prevValues) {
                            pv = prevValues[pr];
                            if (pv) {
                                tr += pv;
                                retValue[pr] = pv;
                            }
                        }
                    }

                }

                xx('translate');
                xx('rotate');
                xx('scale');

                var keyFrameRule = "";

                if (tr) {
                    keyFrameRule = '-' + prefix + '-transform: ' + tr + ';';
                }

                tr = "";
                xx('opacity');
                if (tr) {
                    keyFrameRule += ' opacity: ' + tr + ';';
                }

                return {
                    rules:keyFrameRule,
                    ret:retValue
                };

            },

            /**
             *
             * @param prefix
             * @param name
             * @param keyframessize
             */
            calculateKeyFramesData:function (prefix, name, keyframessize) {

                if (this.duration === Number.MAX_VALUE) {
                    return "";
                }

                if (typeof keyframessize === 'undefined') {
                    keyframessize = 100;
                }

                var i;
                var prevValues = null;
                var kfd = "@-" + prefix + "-keyframes " + name + " {";
                var ret;
                var time;
                var kfr;

                for (i = 0; i <= keyframessize; i++) {
                    time = this.interpolator.getPosition(i / keyframessize).y;
                    ret = this.calculateKeyFrameData(time, prefix, prevValues);
                    kfr = "" +
                        (i / keyframessize * 100) + "%" + // percentage
                        "{" + ret.rules + "}\n";

                    prevValues = ret.ret;
                    kfd += kfr;
                }

                kfd += "}";

                return kfd;
            }

        }
    }
});
CAAT.Module({
    defines:"CAAT.Behavior.GenericBehavior",
    depends:["CAAT.Behavior.BaseBehavior"],
    aliases:["CAAT.GenericBehavior"],
    extendsClass:"CAAT.Behavior.BaseBehavior",
    extendsWith:function () {

        return {

            start:0,
            end:0,
            target:null,
            property:null,
            callback:null,

            /**
             * Sets the target objects property to the corresponding value for the given time.
             * If a callback function is defined, it is called as well.
             *
             * @param time {number} the scene time to apply the behavior at.
             * @param actor {CAAT.Actor} a CAAT.Actor object instance.
             */
            setForTime:function (time, actor) {
                var value = this.start + time * (this.end - this.start);
                if (this.callback) {
                    this.callback(value, this.target, actor);
                }

                if (this.property) {
                    this.target[this.property] = value;
                }
            },
            /**
             * Defines the values to apply this behavior.
             *
             * @param start {number} initial behavior value.
             * @param end {number} final behavior value.
             * @param target {object} an object. Usually a CAAT.Actor.
             * @param property {string} target object's property to set value to.
             * @param callback {function} a function of the form <code>function( target, value )</code>.
             */
            setValues:function (start, end, target, property, callback) {
                this.start = start;
                this.end = end;
                this.target = target;
                this.property = property;
                this.callback = callback;
                return this;
            }
        };
    }
});
CAAT.Module({
    defines:"CAAT.Behavior.PathBehavior",
    aliases: ["CAAT.PathBehavior"],
    depends:[
        "CAAT.Behavior.BaseBehavior",
        "CAAT.Foundation.SpriteImage"
    ],
    constants : {
        autorotate: {
            LEFT_TO_RIGHT:  0,
            RIGHT_TO_LEFT:  1,
            FREE:           2
        }
    },
    extendsClass : "CAAT.Behavior.BaseBehavior",
    extendsWith:function () {

        return {

            path:null, // the path to traverse
            autoRotate:false, // set whether the actor must be rotated tangentially to the path.
            prevX:-1, // private, do not use.
            prevY:-1, // private, do not use.

            autoRotateOp: CAAT.Behavior.PathBehavior.autorotate.FREE,

            getPropertyName:function () {
                return "translate";
            },

            /**
             * Sets an actor rotation to be heading from past to current path's point.
             * Take into account that this will be incompatible with rotation Behaviors
             * since they will set their own rotation configuration.
             * @param autorotate {boolean}
             * @param autorotateOp {CAAT.PathBehavior.autorotate} whether the sprite is drawn heading to the right.
             * @return this.
             */
            setAutoRotate:function (autorotate, autorotateOp) {
                this.autoRotate = autorotate;
                if (autorotateOp !== undefined) {
                    this.autoRotateOp = autorotateOp;
                }
                return this;
            },
            /**
             * Set the behavior path.
             * The path can be any length, and will take behaviorDuration time to be traversed.
             * @param {CAAT.Path}
                *
             * @deprecated
             */
            setPath:function (path) {
                this.path = path;
                return this;
            },

            /**
             * Set the behavior path.
             * The path can be any length, and will take behaviorDuration time to be traversed.
             * @param {CAAT.Path}
                * @return this
             */
            setValues:function (path) {
                return this.setPath(path);
            },

            /**
             * @see Actor.setPositionAnchor
             * @deprecated
             * @param tx a float with xoffset.
             * @param ty a float with yoffset.
             */
            setTranslation:function (tx, ty) {
                return this;
            },

            calculateKeyFrameData:function (time) {
                time = this.interpolator.getPosition(time).y;
                var point = this.path.getPosition(time);
                return "translateX(" + point.x + "px) translateY(" + point.y + "px)";
            },

            calculateKeyFramesData:function (prefix, name, keyframessize) {

                if (typeof keyframessize === 'undefined') {
                    keyframessize = 100;
                }
                keyframessize >>= 0;

                var i;
                var kfr;
                var time;
                var kfd = "@-" + prefix + "-keyframes " + name + " {";

                for (i = 0; i <= keyframessize; i++) {
                    kfr = "" +
                        (i / keyframessize * 100) + "%" + // percentage
                        "{" +
                        "-" + prefix + "-transform:" + this.calculateKeyFrameData(i / keyframessize) +
                        "}";

                    kfd += kfr;
                }

                kfd += "}";

                return kfd;
            },

            /**
             * Translates the Actor to the corresponding time path position.
             * If autoRotate=true, the actor is rotated as well. The rotation anchor will (if set) always be ANCHOR_CENTER.
             * @param time an integer indicating the time the behavior is being applied at.
             * @param actor a CAAT.Actor instance to be translated.
             * @return {object} an object of the form <code>{ x: {float}, y: {float}�}</code>.
             */
            setForTime:function (time, actor) {

                if (!this.path) {
                    return {
                        x:actor.x,
                        y:actor.y
                    };
                }

                var point = this.path.getPosition(time);

                if (this.autoRotate) {

                    if (-1 === this.prevX && -1 === this.prevY) {
                        this.prevX = point.x;
                        this.prevY = point.y;
                    }

                    var ax = point.x - this.prevX;
                    var ay = point.y - this.prevY;

                    if (ax === 0 && ay === 0) {
                        actor.setLocation(point.x, point.y);
                        return { x:actor.x, y:actor.y };
                    }

                    var angle = Math.atan2(ay, ax);
                    var si = CAAT.Foundation.SpriteImage;
                    var pba = CAAT.Behavior.PathBehavior.autorotate;

                    // actor is heading left to right
                    if (this.autoRotateOp === pba.LEFT_TO_RIGHT) {
                        if (this.prevX <= point.x) {
                            actor.setImageTransformation(si.TR_NONE);
                        }
                        else {
                            actor.setImageTransformation(si.TR_FLIP_HORIZONTAL);
                            angle += Math.PI;
                        }
                    } else if (this.autoRotateOp === pba.RIGHT_TO_LEFT) {
                        if (this.prevX <= point.x) {
                            actor.setImageTransformation(si.TR_FLIP_HORIZONTAL);
                        }
                        else {
                            actor.setImageTransformation(si.TR_NONE);
                            angle -= Math.PI;
                        }
                    }

                    actor.setRotation(angle);

                    this.prevX = point.x;
                    this.prevY = point.y;

                    var modulo = Math.sqrt(ax * ax + ay * ay);
                    ax /= modulo;
                    ay /= modulo;
                }

                if (this.doValueApplication) {
                    actor.setLocation(point.x, point.y);
                    return { x:actor.x, y:actor.y };
                } else {
                    return {
                        x:point.x,
                        y:point.y
                    };
                }


            },
            /**
             * Get a point on the path.
             * If the time to get the point at is in behaviors frame time, a point on the path will be returned, otherwise
             * a default {x:-1, y:-1} point will be returned.
             *
             * @param time {number} the time at which the point will be taken from the path.
             * @return {object} an object of the form {x:float y:float}
             */
            positionOnTime:function (time) {
                if (this.isBehaviorInTime(time, null)) {
                    time = this.normalizeTime(time);
                    return this.path.getPosition(time);
                }

                return {x:-1, y:-1};

            }
        };
    }
});
CAAT.Module({
    defines:"CAAT.Behavior.RotateBehavior",
    extendsClass: "CAAT.Behavior.BaseBehavior",
    depends:[
        "CAAT.Behavior.BaseBehavior",
        "CAAT.Foundation.Actor"
    ],
    aliases: ["CAAT.RotateBehavior"],
    extendsWith:function () {

        return {

            __init:function () {
                this.__super();
                this.anchor = CAAT.Foundation.Actor.ANCHOR_CENTER;
                return this;
            },

            startAngle:0, // behavior start angle
            endAngle:0, // behavior end angle
            anchorX:.50, // rotation center x.
            anchorY:.50, // rotation center y.

            getPropertyName:function () {
                return "rotate";
            },

            /**
             * Behavior application function.
             * Do not call directly.
             * @param time an integer indicating the application time.
             * @param actor a CAAT.Actor the behavior will be applied to.
             * @return the set angle.
             */
            setForTime:function (time, actor) {
                var angle = this.startAngle + time * (this.endAngle - this.startAngle);

                if (this.doValueApplication) {
                    actor.setRotationAnchored(angle, this.anchorX, this.anchorY);
                }

                return angle;

            },
            /**
             * Set behavior bound values.
             * if no anchorx,anchory values are supplied, the behavior will assume
             * 50% for both values, that is, the actor's center.
             *
             * Be aware the anchor values are supplied in <b>RELATIVE PERCENT</b> to
             * actor's size.
             *
             * @param startAngle {float} indicating the starting angle.
             * @param endAngle {float} indicating the ending angle.
             * @param anchorx {float} the percent position for anchorX
             * @param anchory {float} the percent position for anchorY
             */
            setValues:function (startAngle, endAngle, anchorx, anchory) {
                this.startAngle = startAngle;
                this.endAngle = endAngle;
                if (typeof anchorx !== 'undefined' && typeof anchory !== 'undefined') {
                    this.anchorX = anchorx;
                    this.anchorY = anchory;
                }
                return this;
            },
            /**
             * @deprecated
             * Use setValues instead
             * @param start
             * @param end
             */
            setAngles:function (start, end) {
                return this.setValues(start, end);
            },
            /**
             * Set the behavior rotation anchor. Use this method when setting an exact percent
             * by calling setValues is complicated.
             * @see CAAT.Actor
             * @param anchor any of CAAT.Actor.prototype.ANCHOR_* constants.
             *
             * These parameters are to set a custom rotation anchor point. if <code>anchor==CAAT.Actor.ANCHOR_CUSTOM
             * </code> the custom rotation point is set.
             * @param rx
             * @param ry
             *
             */
            setAnchor:function (actor, rx, ry) {
                this.anchorX = rx / actor.width;
                this.anchorY = ry / actor.height;
                return this;
            },


            calculateKeyFrameData:function (time) {
                time = this.interpolator.getPosition(time).y;
                return "rotate(" + (this.startAngle + time * (this.endAngle - this.startAngle)) + "rad)";
            },

            /**
             * @param prefix {string} browser vendor prefix
             * @param name {string} keyframes animation name
             * @param keyframessize {integer} number of keyframes to generate
             * @override
             */
            calculateKeyFramesData:function (prefix, name, keyframessize) {

                if (typeof keyframessize === 'undefined') {
                    keyframessize = 100;
                }
                keyframessize >>= 0;

                var i;
                var kfr;
                var kfd = "@-" + prefix + "-keyframes " + name + " {";

                for (i = 0; i <= keyframessize; i++) {
                    kfr = "" +
                        (i / keyframessize * 100) + "%" + // percentage
                        "{" +
                        "-" + prefix + "-transform:" + this.calculateKeyFrameData(i / keyframessize) +
                        "}\n";

                    kfd += kfr;
                }

                kfd += "}";

                return kfd;
            }

        };

    }
});
CAAT.Module({

    defines:"CAAT.Behavior.Scale1Behavior",
    depends:[
        "CAAT.Behavior.BaseBehavior",
        "CAAT.Foundation.Actor"
    ],
    aliases: ["CAAT.Scale1Behavior"],
    constants : {
        Axis : {
            X:  0,
            Y:  1
        }
    },
    extendsClass:"CAAT.Behavior.BaseBehavior",
    extendsWith:function () {

        return {

            __init:function () {
                this.__super();
                this.anchor = CAAT.Foundation.Actor.ANCHOR_CENTER;
                return this;
            },

            startScale:1,
            endScale:1,
            anchorX:.50,
            anchorY:.50,

            sx:1,
            sy:1,

            applyOnX:true,

            /**
             *
             * @param axis {Axis}
             */
            applyOnAxis:function (axis) {
                if (axis === CAAT.Behavior.Scale1Behavior.Axis.X) {
                    this.applyOnX = false;
                } else {
                    this.applyOnX = true;
                }
            },

            getPropertyName:function () {
                return "scale";
            },

            /**
             * Applies corresponding scale values for a given time.
             *
             * @param time the time to apply the scale for.
             * @param actor the target actor to Scale.
             * @return {object} an object of the form <code>{ scaleX: {float}, scaleY: {float}�}</code>
             */
            setForTime:function (time, actor) {

                var scale = this.startScale + time * (this.endScale - this.startScale);

                // Firefox 3.x & 4, will crash animation if either scaleX or scaleY equals 0.
                if (0 === scale) {
                    scale = 0.01;
                }

                if (this.doValueApplication) {
                    if (this.applyOnX) {
                        actor.setScaleAnchored(scale, actor.scaleY, this.anchorX, this.anchorY);
                    } else {
                        actor.setScaleAnchored(actor.scaleX, scale, this.anchorX, this.anchorY);
                    }
                }

                return scale;
            },
            /**
             * Define this scale behaviors values.
             *
             * Be aware the anchor values are supplied in <b>RELATIVE PERCENT</b> to
             * actor's size.
             *
             * @param start {number} initial X axis scale value.
             * @param end {number} final X axis scale value.
             * @param anchorx {float} the percent position for anchorX
             * @param anchory {float} the percent position for anchorY
             *
             * @return this.
             */
            setValues:function (start, end, applyOnX, anchorx, anchory) {
                this.startScale = start;
                this.endScale = end;
                this.applyOnX = !!applyOnX;

                if (typeof anchorx !== 'undefined' && typeof anchory !== 'undefined') {
                    this.anchorX = anchorx;
                    this.anchorY = anchory;
                }

                return this;
            },
            /**
             * Set an exact position scale anchor. Use this method when it is hard to
             * set a thorough anchor position expressed in percentage.
             * @param actor
             * @param x
             * @param y
             */
            setAnchor:function (actor, x, y) {
                this.anchorX = x / actor.width;
                this.anchorY = y / actor.height;

                return this;
            },

            calculateKeyFrameData:function (time) {
                var scale;

                time = this.interpolator.getPosition(time).y;
                scale = this.startScale + time * (this.endScale - this.startScale);

                return this.applyOnX ? "scaleX(" + scale + ")" : "scaleY(" + scale + ")";
            },

            calculateKeyFramesData:function (prefix, name, keyframessize) {

                if (typeof keyframessize === 'undefined') {
                    keyframessize = 100;
                }
                keyframessize >>= 0;

                var i;
                var kfr;
                var kfd = "@-" + prefix + "-keyframes " + name + " {";

                for (i = 0; i <= keyframessize; i++) {
                    kfr = "" +
                        (i / keyframessize * 100) + "%" + // percentage
                        "{" +
                        "-" + prefix + "-transform:" + this.calculateKeyFrameData(i / keyframessize) +
                        "}";

                    kfd += kfr;
                }

                kfd += "}";

                return kfd;
            }
        }

    }
});
CAAT.Module({
    defines:"CAAT.Behavior.ScaleBehavior",
    depends:[
        "CAAT.Behavior.BaseBehavior",
        "CAAT.Foundation.Actor"
    ],
    extendsClass:"CAAT.Behavior.BaseBehavior",
    aliases : ["CAAT.ScaleBehavior"],
    extendsWith:function () {

        return  {

            /**
             * ScaleBehavior applies scale affine transforms in both axis.
             * StartScale and EndScale must be supplied for each axis. This method takes care of a FF bug in which if a Scale is
             * set to 0, the animation will fail playing.
             *
             * This behavior specifies anchors in values ranges 0..1
             *
             * @constructor
             * @extendsClass CAAT.Behavior
             *
             */
            __init:function () {
                this.__super();
                this.anchor = CAAT.Foundation.Actor.ANCHOR_CENTER;
                return this;
            },

            startScaleX:1,
            endScaleX:1,
            startScaleY:1,
            endScaleY:1,
            anchorX:.50,
            anchorY:.50,

            getPropertyName:function () {
                return "scale";
            },

            /**
             * Applies corresponding scale values for a given time.
             *
             * @param time the time to apply the scale for.
             * @param actor the target actor to Scale.
             * @return {object} an object of the form <code>{ scaleX: {float}, scaleY: {float}�}</code>
             */
            setForTime:function (time, actor) {

                var scaleX = this.startScaleX + time * (this.endScaleX - this.startScaleX);
                var scaleY = this.startScaleY + time * (this.endScaleY - this.startScaleY);

                // Firefox 3.x & 4, will crash animation if either scaleX or scaleY equals 0.
                if (0 === scaleX) {
                    scaleX = 0.01;
                }
                if (0 === scaleY) {
                    scaleY = 0.01;
                }

                if (this.doValueApplication) {
                    actor.setScaleAnchored(scaleX, scaleY, this.anchorX, this.anchorY);
                }

                return { scaleX:scaleX, scaleY:scaleY };
            },
            /**
             * Define this scale behaviors values.
             *
             * Be aware the anchor values are supplied in <b>RELATIVE PERCENT</b> to
             * actor's size.
             *
             * @param startX {number} initial X axis scale value.
             * @param endX {number} final X axis scale value.
             * @param startY {number} initial Y axis scale value.
             * @param endY {number} final Y axis scale value.
             * @param anchorx {float} the percent position for anchorX
             * @param anchory {float} the percent position for anchorY
             *
             * @return this.
             */
            setValues:function (startX, endX, startY, endY, anchorx, anchory) {
                this.startScaleX = startX;
                this.endScaleX = endX;
                this.startScaleY = startY;
                this.endScaleY = endY;

                if (typeof anchorx !== 'undefined' && typeof anchory !== 'undefined') {
                    this.anchorX = anchorx;
                    this.anchorY = anchory;
                }

                return this;
            },
            /**
             * Set an exact position scale anchor. Use this method when it is hard to
             * set a thorough anchor position expressed in percentage.
             * @param actor
             * @param x
             * @param y
             */
            setAnchor:function (actor, x, y) {
                this.anchorX = x / actor.width;
                this.anchorY = y / actor.height;

                return this;
            },

            calculateKeyFrameData:function (time) {
                var scaleX;
                var scaleY;

                time = this.interpolator.getPosition(time).y;
                scaleX = this.startScaleX + time * (this.endScaleX - this.startScaleX);
                scaleY = this.startScaleY + time * (this.endScaleY - this.startScaleY);

                return "scaleX(" + scaleX + ") scaleY(" + scaleY + ")";
            },

            calculateKeyFramesData:function (prefix, name, keyframessize) {

                if (typeof keyframessize === 'undefined') {
                    keyframessize = 100;
                }
                keyframessize >>= 0;

                var i;
                var kfr;
                var kfd = "@-" + prefix + "-keyframes " + name + " {";

                for (i = 0; i <= keyframessize; i++) {
                    kfr = "" +
                        (i / keyframessize * 100) + "%" + // percentage
                        "{" +
                        "-" + prefix + "-transform:" + this.calculateKeyFrameData(i / keyframessize) +
                        "}";

                    kfd += kfr;
                }

                kfd += "}";

                return kfd;
            }
        }

    }
});
/**
 *
 * taken from: http://www.quirksmode.org/js/detect.html
 *
 * 20101008 Hyperandroid. IE9 seems to identify himself as Explorer and stopped calling himself MSIE.
 *          Added Explorer description to browser list. Thanks @alteredq for this tip.
 *
 */
CAAT.Module({
    defines:"CAAT.Module.Runtime.BrowserInfo",

    constants: function() {

        function searchString(data) {
            for (var i = 0; i < data.length; i++) {
                var dataString = data[i].string;
                var dataProp = data[i].prop;
                this.versionSearchString = data[i].versionSearch || data[i].identity;
                if (dataString) {
                    if (dataString.indexOf(data[i].subString) !== -1)
                        return data[i].identity;
                }
                else if (dataProp)
                    return data[i].identity;
            }
        }

        function searchVersion(dataString) {
            var index = dataString.indexOf(this.versionSearchString);
            if (index === -1) return;
            return parseFloat(dataString.substring(index + this.versionSearchString.length + 1));
        }

        var dataBrowser= [
            {
                string:navigator.userAgent,
                subString:"Chrome",
                identity:"Chrome"
            },
            {   string:navigator.userAgent,
                subString:"OmniWeb",
                versionSearch:"OmniWeb/",
                identity:"OmniWeb"
            },
            {
                string:navigator.vendor,
                subString:"Apple",
                identity:"Safari",
                versionSearch:"Version"
            },
            {
                prop:window.opera,
                identity:"Opera"
            },
            {
                string:navigator.vendor,
                subString:"iCab",
                identity:"iCab"
            },
            {
                string:navigator.vendor,
                subString:"KDE",
                identity:"Konqueror"
            },
            {
                string:navigator.userAgent,
                subString:"Firefox",
                identity:"Firefox"
            },
            {
                string:navigator.vendor,
                subString:"Camino",
                identity:"Camino"
            },
            {        // for newer Netscapes (6+)
                string:navigator.userAgent,
                subString:"Netscape",
                identity:"Netscape"
            },
            {
                string:navigator.userAgent,
                subString:"MSIE",
                identity:"Explorer",
                versionSearch:"MSIE"
            },
            {
                string:navigator.userAgent,
                subString:"Explorer",
                identity:"Explorer",
                versionSearch:"Explorer"
            },
            {
                string:navigator.userAgent,
                subString:"Gecko",
                identity:"Mozilla",
                versionSearch:"rv"
            },
            { // for older Netscapes (4-)
                string:navigator.userAgent,
                subString:"Mozilla",
                identity:"Netscape",
                versionSearch:"Mozilla"
            }
        ];

        var dataOS=[
            {
                string:navigator.platform,
                subString:"Win",
                identity:"Windows"
            },
            {
                string:navigator.platform,
                subString:"Mac",
                identity:"Mac"
            },
            {
                string:navigator.userAgent,
                subString:"iPhone",
                identity:"iPhone/iPod"
            },
            {
                string:navigator.platform,
                subString:"Linux",
                identity:"Linux"
            }
        ];

        var browser = searchString(dataBrowser) || "An unknown browser";
        var version = searchVersion(navigator.userAgent) ||
                      searchVersion(navigator.appVersion) ||
                      "an unknown version";
        var OS = searchString(dataOS) || "an unknown OS";

        var DevicePixelRatio = window.devicePixelRatio || 1;

        return {
            browser: browser,
            version: version,
            OS: OS,
            DevicePixelRatio : DevicePixelRatio
        }

    }
});
/**
 * See LICENSE file.
 *
 * Sound implementation.
 */

CAAT.Module({
    defines:"CAAT.Module.Audio.AudioManager",
    depends:[
        "CAAT.Module.Runtime.BrowserInfo"
    ],
    extendsWith:function () {
        return {
            __init:function () {
                this.browserInfo = CAAT.Module.Runtime.BrowserInfo;
                return this;
            },

            musicChannel: null,
            browserInfo:null,
            musicEnabled:true,
            fxEnabled:true,
            audioCache:null, // audio elements.
            channels:null, // available playing channels.
            workingChannels:null, // currently playing channels.
            loopingChannels:[],
            audioTypes:{               // supported audio formats. Don't remember where i took them from :S
                'mp3':'audio/mpeg;',
                'ogg':'audio/ogg; codecs="vorbis"',
                'wav':'audio/wav; codecs="1"',
                'mp4':'audio/mp4; codecs="mp4a.40.2"'
            },

            /**
             * Initializes the sound subsystem by creating a fixed number of Audio channels.
             * Every channel registers a handler for sound playing finalization. If a callback is set, the
             * callback function will be called with the associated sound id in the cache.
             *
             * @param numChannels {number} number of channels to pre-create. 8 by default.
             *
             * @return this.
             */
            initialize:function (numChannels) {

                this.audioCache = [];
                this.channels = [];
                this.workingChannels = [];

                for (var i = 0; i <= numChannels; i++) {
                    var channel = document.createElement('audio');

                    if (null !== channel) {
                        channel.finished = -1;
                        this.channels.push(channel);
                        var me = this;
                        channel.addEventListener(
                            'ended',
                            // on sound end, set channel to available channels list.
                            function (audioEvent) {
                                var target = audioEvent.target;
                                var i;

                                // remove from workingChannels
                                for (i = 0; i < me.workingChannels.length; i++) {
                                    if (me.workingChannels[i] === target) {
                                        me.workingChannels.splice(i, 1);
                                        break;
                                    }
                                }

                                if (target.caat_callback) {
                                    target.caat_callback(target.caat_id);
                                }

                                // set back to channels.
                                me.channels.push(target);
                            },
                            false
                        );
                    }
                }

                this.musicChannel= this.channels.pop();

                return this;
            },
            /**
             * Tries to add an audio tag to the available list of valid audios. The audio is described by a url.
             * @param id {object} an object to associate the audio element (if suitable to be played).
             * @param url {string} a string describing an url.
             * @param endplaying_callback {function} callback to be called upon sound end.
             *
             * @return {boolean} a boolean indicating whether the browser can play this resource.
             *
             * @private
             */
            addAudioFromURL:function (id, url, endplaying_callback) {
                var extension = null;
                var audio = document.createElement('audio');

                if (null !== audio) {

                    if (!audio.canPlayType) {
                        return false;
                    }

                    extension = url.substr(url.lastIndexOf('.') + 1);
                    var canplay = audio.canPlayType(this.audioTypes[extension]);

                    if (canplay !== "" && canplay !== "no") {
                        audio.src = url;
                        audio.preload = "auto";
                        audio.load();
                        if (endplaying_callback) {
                            audio.caat_callback = endplaying_callback;
                            audio.caat_id = id;
                        }
                        this.audioCache.push({ id:id, audio:audio });

                        return true;
                    }
                }

                return false;
            },
            /**
             * Tries to add an audio tag to the available list of valid audios. The audio element comes from
             * an HTMLAudioElement.
             * @param id {object} an object to associate the audio element (if suitable to be played).
             * @param audio {HTMLAudioElement} a DOM audio node.
             * @param endplaying_callback {function} callback to be called upon sound end.
             *
             * @return {boolean} a boolean indicating whether the browser can play this resource.
             *
             * @private
             */
            addAudioFromDomNode:function (id, audio, endplaying_callback) {

                var extension = audio.src.substr(audio.src.lastIndexOf('.') + 1);
                if (audio.canPlayType(this.audioTypes[extension])) {
                    if (endplaying_callback) {
                        audio.caat_callback = endplaying_callback;
                        audio.caat_id = id;
                    }
                    this.audioCache.push({ id:id, audio:audio });

                    return true;
                }

                return false;
            },
            /**
             * Adds an elements to the audio cache.
             * @param id {object} an object to associate the audio element (if suitable to be played).
             * @param element {URL|HTMLElement} an url or html audio tag.
             * @param endplaying_callback {function} callback to be called upon sound end.
             *
             * @return {boolean} a boolean indicating whether the browser can play this resource.
             *
             * @private
             */
            addAudioElement:function (id, element, endplaying_callback) {
                if (typeof element === "string") {
                    return this.addAudioFromURL(id, element, endplaying_callback);
                } else {
                    try {
                        if (element instanceof HTMLAudioElement) {
                            return this.addAudioFromDomNode(id, element, endplaying_callback);
                        }
                    }
                    catch (e) {
                    }
                }

                return false;
            },
            /**
             * creates an Audio object and adds it to the audio cache.
             * This function expects audio data described by two elements, an id and an object which will
             * describe an audio element to be associated with the id. The object will be of the form
             * array, dom node or a url string.
             *
             * <p>
             * The audio element can be one of the two forms:
             *
             * <ol>
             *  <li>Either an HTMLAudioElement/Audio object or a string url.
             *  <li>An array of elements of the previous form.
             * </ol>
             *
             * <p>
             * When the audio attribute is an array, this function will iterate throught the array elements
             * until a suitable audio element to be played is found. When this is the case, the other array
             * elements won't be taken into account. The valid form of using this addAudio method will be:
             *
             * <p>
             * 1.<br>
             * addAudio( id, url } ). In this case, if the resource pointed by url is
             * not suitable to be played (i.e. a call to the Audio element's canPlayType method return 'no')
             * no resource will be added under such id, so no sound will be played when invoking the play(id)
             * method.
             * <p>
             * 2.<br>
             * addAudio( id, dom_audio_tag ). In this case, the same logic than previous case is applied, but
             * this time, the parameter url is expected to be an audio tag present in the html file.
             * <p>
             * 3.<br>
             * addAudio( id, [array_of_url_or_domaudiotag] ). In this case, the function tries to locate a valid
             * resource to be played in any of the elements contained in the array. The array element's can
             * be any type of case 1 and 2. As soon as a valid resource is found, it will be associated to the
             * id in the valid audio resources to be played list.
             *
             * @return this
             */
            addAudio:function (id, array_of_url_or_domnodes, endplaying_callback) {

                if (array_of_url_or_domnodes instanceof Array) {
                    /*
                     iterate throught array elements until we can safely add an audio element.
                     */
                    for (var i = 0; i < array_of_url_or_domnodes.length; i++) {
                        if (this.addAudioElement(id, array_of_url_or_domnodes[i], endplaying_callback)) {
                            break;
                        }
                    }
                } else {
                    this.addAudioElement(id, array_of_url_or_domnodes, endplaying_callback);
                }

                return this;
            },
            /**
             * Returns an audio object.
             * @param aId {object} the id associated to the target Audio object.
             * @return {object} the HTMLAudioElement addociated to the given id.
             */
            getAudio:function (aId) {
                for (var i = 0; i < this.audioCache.length; i++) {
                    if (this.audioCache[i].id === aId) {
                        return this.audioCache[i].audio;
                    }
                }

                return null;
            },

            stopMusic : function() {
                this.musicChannel.pause();
            },

            playMusic : function(id) {
                if (!this.musicEnabled) {
                    return this;
                }

                var audio_in_cache = this.getAudio(id);
                // existe el audio, y ademas hay un canal de audio disponible.
                if (null !== audio_in_cache) {
                    var audio =this.musicChannel;
                    if (null !== audio) {
                        audio.src = audio_in_cache.src;
                        audio.preload = "auto";

                        if (this.browserInfo.browser === 'Firefox') {
                            audio.addEventListener(
                                'ended',
                                // on sound end, set channel to available channels list.
                                function (audioEvent) {
                                    var target = audioEvent.target;
                                    target.currentTime = 0;
                                },
                                false
                            );
                        } else {
                            audio.loop = true;
                        }
                        audio.load();
                        audio.play();
                        return audio;
                    }
                }
            },

            /**
             * Set an audio object volume.
             * @param id {object} an audio Id
             * @param volume {number} volume to set. The volume value is not checked.
             *
             * @return this
             */
            setVolume:function (id, volume) {
                var audio = this.getAudio(id);
                if (null != audio) {
                    audio.volume = volume;
                }

                return this;
            },

            /**
             * Plays an audio file from the cache if any sound channel is available.
             * The playing sound will occupy a sound channel and when ends playing will leave
             * the channel free for any other sound to be played in.
             * @param id {object} an object identifying a sound in the sound cache.
             * @return this.
             */
            play:function (id) {
                if (!this.fxEnabled) {
                    return this;
                }

                var audio = this.getAudio(id);
                // existe el audio, y ademas hay un canal de audio disponible.
                if (null !== audio && this.channels.length > 0) {
                    var channel = this.channels.shift();
                    channel.src = audio.src;
                    channel.load();
                    channel.volume = audio.volume;
                    channel.play();
                    this.workingChannels.push(channel);
                }

                return this;
            },
            /**
             * This method creates a new AudioChannel to loop the sound with.
             * It returns an Audio object so that the developer can cancel the sound loop at will.
             * The user must call <code>pause()</code> method to stop playing a loop.
             * <p>
             * Firefox does not honor the loop property, so looping is performed by attending end playing
             * event on audio elements.
             *
             * @return {HTMLElement} an Audio instance if a valid sound id is supplied. Null otherwise
             */
            loop:function (id) {

                if (!this.musicEnabled) {
                    return this;
                }

                var audio_in_cache = this.getAudio(id);
                // existe el audio, y ademas hay un canal de audio disponible.
                if (null !== audio_in_cache) {
                    var audio = document.createElement('audio');
                    if (null !== audio) {
                        audio.src = audio_in_cache.src;
                        audio.preload = "auto";

                        if (this.browserInfo.browser === 'Firefox') {
                            audio.addEventListener(
                                'ended',
                                // on sound end, set channel to available channels list.
                                function (audioEvent) {
                                    var target = audioEvent.target;
                                    target.currentTime = 0;
                                },
                                false
                            );
                        } else {
                            audio.loop = true;
                        }
                        audio.load();
                        audio.play();
                        this.loopingChannels.push(audio);
                        return audio;
                    }
                }

                return null;
            },
            /**
             * Cancel all playing audio channels
             * Get back the playing channels to available channel list.
             *
             * @return this
             */
            endSound:function () {
                var i;
                for (i = 0; i < this.workingChannels.length; i++) {
                    this.workingChannels[i].pause();
                    this.channels.push(this.workingChannels[i]);
                }

                for (i = 0; i < this.loopingChannels.length; i++) {
                    this.loopingChannels[i].pause();
                }

                this.stopMusic();

                return this;
            },
            setSoundEffectsEnabled:function (enable) {
                this.fxEnabled = enable;
                for (var i = 0; i < this.loopingChannels.length; i++) {
                    if (enable) {
                        this.loopingChannels[i].play();
                    } else {
                        this.loopingChannels[i].pause();
                    }
                }
                return this;
            },
            isSoundEffectsEnabled:function () {
                return this.fxEnabled;
            },
            setMusicEnabled:function (enable) {
                this.musicEnabled = enable;
                this.stopMusic();
                return this;
            },
            isMusicEnabled:function () {
                return this.musicEnabled;
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 **/
CAAT.Module({
    defines : "CAAT.Module.Storage.LocalStorage",
    constants : {

        /**
         * Stores an object in local storage. The data will be saved as JSON.stringify.
         * @param key {string} key to store data under.
         * @param data {object} an object.
         * @return this
         *
         * @static
         */
        save : function( key, data ) {
            try {
                localStorage.setItem( key, JSON.stringify(data) );
            } catch(e) {
                // eat it
            }
            return this;
        },
        /**
         * Retrieve a value from local storage.
         * @param key {string} the key to retrieve.
         * @return {object} object stored under the key parameter.
         *
         * @static
         */
        load : function( key, defValue ) {
            try {
                var v= localStorage.getItem( key );

                return null===v ? defValue : JSON.parse(v);
            } catch(e) {
                return null;
            }
        },

        /**
         * Removes a value stored in local storage.
         * @param key {string}
         * @return this
         *
         * @static
         */
        remove : function( key ) {
            try {
                localStorage.removeItem(key);
            } catch(e) {
                // eat it
            }
            return this;
        }
    },
    extendsWith : {

    }

});
/**
 * See LICENSE file.
 *
 * @author: Mario Gonzalez (@onedayitwilltake) and Ibon Tolosana (@hyperandroid)
 *
 * Helper classes for color manipulation.
 *
 **/

CAAT.Module({
    defines:"CAAT.Module.ColorUtil.Color",
    depends:[
    ],
    constants:{
        /**
         * Enumeration to define types of color ramps.
         * @enum {number}
         */
        RampEnumeration:{
            RAMP_RGBA:0,
            RAMP_RGB:1,
            RAMP_CHANNEL_RGB:2,
            RAMP_CHANNEL_RGBA:3,
            RAMP_CHANNEL_RGB_ARRAY:4,
            RAMP_CHANNEL_RGBA_ARRAY:5
        },

        /**
         * HSV to RGB color conversion
         * <p>
         * H runs from 0 to 360 degrees<br>
         * S and V run from 0 to 100
         * <p>
         * Ported from the excellent java algorithm by Eugene Vishnevsky at:
         * http://www.cs.rit.edu/~ncs/color/t_convert.html
         *
         * @static
         */
        hsvToRgb:function (h, s, v) {
            var r, g, b, i, f, p, q, t;

            // Make sure our arguments stay in-range
            h = Math.max(0, Math.min(360, h));
            s = Math.max(0, Math.min(100, s));
            v = Math.max(0, Math.min(100, v));

            // We accept saturation and value arguments from 0 to 100 because that's
            // how Photoshop represents those values. Internally, however, the
            // saturation and value are calculated from a range of 0 to 1. We make
            // That conversion here.
            s /= 100;
            v /= 100;

            if (s === 0) {
                // Achromatic (grey)
                r = g = b = v;
                return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
            }

            h /= 60; // sector 0 to 5
            i = Math.floor(h);
            f = h - i; // factorial part of h
            p = v * (1 - s);
            q = v * (1 - s * f);
            t = v * (1 - s * (1 - f));

            switch (i) {
                case 0:
                    r = v;
                    g = t;
                    b = p;
                    break;

                case 1:
                    r = q;
                    g = v;
                    b = p;
                    break;

                case 2:
                    r = p;
                    g = v;
                    b = t;
                    break;

                case 3:
                    r = p;
                    g = q;
                    b = v;
                    break;

                case 4:
                    r = t;
                    g = p;
                    b = v;
                    break;

                default: // case 5:
                    r = v;
                    g = p;
                    b = q;
            }

            return new CAAT.Module.ColorUtil.Color(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
        },

        /**
         * Interpolate the color between two given colors. The return value will be a calculated color
         * among the two given initial colors which corresponds to the 'step'th color of the 'nsteps'
         * calculated colors.
         * @param r0 {number} initial color red component.
         * @param g0 {number} initial color green component.
         * @param b0 {number} initial color blue component.
         * @param r1 {number} final color red component.
         * @param g1 {number} final color green component.
         * @param b1 {number} final color blue component.
         * @param nsteps {number} number of colors to calculate including the two given colors. If 16 is passed as value,
         * 14 colors plus the two initial ones will be calculated.
         * @param step {number} return this color index of all the calculated colors.
         *
         * @return { r{number}, g{number}, b{number} } return an object with the new calculated color components.
         * @static
         */
        interpolate:function (r0, g0, b0, r1, g1, b1, nsteps, step) {

            var r, g, b;

            if (step <= 0) {
                return {
                    r:r0,
                    g:g0,
                    b:b0
                };
            } else if (step >= nsteps) {
                return {
                    r:r1,
                    g:g1,
                    b:b1
                };
            }

            r = (r0 + (r1 - r0) / nsteps * step) >> 0;
            g = (g0 + (g1 - g0) / nsteps * step) >> 0;
            b = (b0 + (b1 - b0) / nsteps * step) >> 0;

            if (r > 255) {
                r = 255;
            } else if (r < 0) {
                r = 0;
            }
            if (g > 255) {
                g = 255;
            } else if (g < 0) {
                g = 0;
            }
            if (b > 255) {
                b = 255;
            } else if (b < 0) {
                b = 0;
            }

            return {
                r:r,
                g:g,
                b:b
            };
        },

        /**
         * Generate a ramp of colors from an array of given colors.
         * @param fromColorsArray {[number]} an array of colors. each color is defined by an integer number from which
         * color components will be extracted. Be aware of the alpha component since it will also be interpolated for
         * new colors.
         * @param rampSize {number} number of colors to produce.
         * @param returnType {CAAT.ColorUtils.RampEnumeration} a value of CAAT.ColorUtils.RampEnumeration enumeration.
         *
         * @return { [{number},{number},{number},{number}] } an array of integers each of which represents a color of
         * the calculated color ramp.
         *
         * @static
         */
        makeRGBColorRamp:function (fromColorsArray, rampSize, returnType) {

            var ramp = [], nc = fromColorsArray.length - 1, chunk = rampSize / nc, i, j,
                na, nr, ng, nb,
                c, a0, r0, g0, b0,
                c1, a1, r1, g1, b1,
                da, dr, dg, db;

            for (i = 0; i < nc; i += 1) {
                c = fromColorsArray[i];
                a0 = (c >> 24) & 0xff;
                r0 = (c & 0xff0000) >> 16;
                g0 = (c & 0xff00) >> 8;
                b0 = c & 0xff;

                c1 = fromColorsArray[i + 1];
                a1 = (c1 >> 24) & 0xff;
                r1 = (c1 & 0xff0000) >> 16;
                g1 = (c1 & 0xff00) >> 8;
                b1 = c1 & 0xff;

                da = (a1 - a0) / chunk;
                dr = (r1 - r0) / chunk;
                dg = (g1 - g0) / chunk;
                db = (b1 - b0) / chunk;

                for (j = 0; j < chunk; j += 1) {
                    na = (a0 + da * j) >> 0;
                    nr = (r0 + dr * j) >> 0;
                    ng = (g0 + dg * j) >> 0;
                    nb = (b0 + db * j) >> 0;

                    var re = CAAT.Module.ColorUtil.Color.RampEnumeration;

                    switch (returnType) {
                        case re.RAMP_RGBA:
                            ramp.push('argb(' + na + ',' + nr + ',' + ng + ',' + nb + ')');
                            break;
                        case re.RAMP_RGB:
                            ramp.push('rgb(' + nr + ',' + ng + ',' + nb + ')');
                            break;
                        case re.RAMP_CHANNEL_RGB:
                            ramp.push(0xff000000 | nr << 16 | ng << 8 | nb);
                            break;
                        case re.RAMP_CHANNEL_RGBA:
                            ramp.push(na << 24 | nr << 16 | ng << 8 | nb);
                            break;
                        case re.RAMP_CHANNEL_RGBA_ARRAY:
                            ramp.push([ nr, ng, nb, na ]);
                            break;
                        case re.RAMP_CHANNEL_RGB_ARRAY:
                            ramp.push([ nr, ng, nb ]);
                            break;
                    }
                }
            }

            return ramp;

        },

        random:function () {
            var a = '0123456789abcdef';
            var c = '#';
            for (var i = 0; i < 3; i++) {
                c += a[ (Math.random() * a.length) >> 0 ];
            }
            return c;
        }
    },

    extendsWith:{
        __init:function (r, g, b) {
            this.r = r || 255;
            this.g = g || 255;
            this.b = b || 255;
            return this;
        },

        r:255,
        g:255,
        b:255,

        /**
         * Get color hexadecimal representation.
         * @return {string} a string with color hexadecimal representation.
         */
        toHex:function () {
            // See: http://jsperf.com/rgb-decimal-to-hex/5
            return ('000000' + ((this.r << 16) + (this.g << 8) + this.b).toString(16)).slice(-6);
        }
    }
});
/**
 * See LICENSE file.
 *
 * Get realtime Debug information of CAAT's activity.
 * Set CAAT.DEBUG=1 before any CAAT.Director object creation.
 * This class creates a DOM node called 'caat-debug' and associated styles
 * The debug panel is minimized by default and shows short information. It can be expanded and minimized again by clicking on it
 *
 */

CAAT.Module( {
    defines : "CAAT.Module.Debug.Debug",
    depends : [
        "CAAT.Event.AnimationLoop"
    ],
    extendsWith : {

        width:              0,
        height:             0,
        canvas:             null,
        ctx:                null,
        statistics:         null,
        framerate:          null,
        textContainer:      null,
        textFPS:            null,
        textEntitiesTotal:  null,
        textEntitiesActive: null,
        textDraws:          null,
        textDrawTime:       null,
        textRAFTime:        null,
        textDirtyRects:     null,
        textDiscardDR:      null,

        frameTimeAcc :      0,
        frameRAFAcc :       0,

        canDebug:           false,

        SCALE:  60,

        debugTpl: 
            "    <style type=\"text/css\">"+
            "        #caat-debug {"+
            "            z-index: 10000;"+
            "            position:fixed;"+
            "            bottom:0;"+
            "            left:0;"+
            "            width:100%;"+
            "            background-color: rgba(0,0,0,0.8);"+
            "        }"+
            "        #caat-debug.caat_debug_max {"+
            "            margin-bottom: 0px;"+
            "        }"+
            "        .caat_debug_bullet {"+
            "            display:inline-block;"+
            "            background-color:#f00;"+
            "            width:8px;"+
            "            height:8px;"+
            "            border-radius: 4px;"+
            "            margin-left:10px;"+
            "            margin-right:2px;"+
            "        }"+
            "        .caat_debug_description {"+
            "            font-size:11px;"+
            "            font-family: helvetica, arial;"+
            "            color: #aaa;"+
            "            display: inline-block;"+
            "        }"+
            "        .caat_debug_value {"+
            "            font-size:11px;"+
            "            font-family: helvetica, arial;"+
            "            color: #fff;"+
            "            width:25px;"+
            "            text-align: right;"+
            "            display: inline-block;"+
            "            margin-right: .3em;"+
            "        }"+
            "        .caat_debug_indicator {"+
            "            float: right;"+
            "        }"+
            "        #debug_tabs {"+
            "            border-top: 1px solid #888;"+
            "            height:25px;"+
            "        }"+
            "        .tab_max_min {"+
            "            font-family: helvetica, arial;"+
            "            font-size: 12px;"+
            "            font-weight: bold;"+
            "            color: #888;"+
            "            border-right: 1px solid #888;"+
            "            float: left;"+
            "            cursor: pointer;"+
            "            padding-left: 5px;"+
            "            padding-right: 5px;"+
            "            padding-top: 5px;"+
            "            height: 20px;"+
            "        }"+
            "        .debug_tabs_content_hidden {"+
            "            display: none;"+
            "            width: 100%;"+
            "        }"+
            "        .debug_tabs_content_visible {"+
            "            display: block;"+
            "            width: 100%;"+
            "        }"+
            "        .checkbox_enabled {"+
            "            display:inline-block;"+
            "            background-color:#eee;"+
            "            border: 1px solid #eee;"+
            "            width:6px;"+
            "            height:8px;"+
            "            margin-left:12px;"+
            "            margin-right:2px;"+
            "            cursor: pointer;"+
            "        }"+
            "        .checkbox_disabled {"+
            "            display:inline-block;"+
            "            width:6px;"+
            "            height:8px;"+
            "            background-color: #333;"+
            "            border: 1px solid #eee;"+
            "            margin-left:12px;"+
            "            margin-right:2px;"+
            "            cursor: pointer;"+
            "        }"+
            "        .checkbox_description {"+
            "            font-size:11px;"+
            "            font-family: helvetica, arial;"+
            "            color: #fff;"+
            "        }"+
            "        .debug_tab {"+
            "            font-family: helvetica, arial;"+
            "            font-size: 12px;"+
            "            color: #fff;"+
            "            border-right: 1px solid #888;"+
            "            float: left;"+
            "            padding-left: 5px;"+
            "            padding-right: 5px;"+
            "            height: 20px;"+
            "            padding-top: 5px;"+
            "            cursor: default;"+
            "        }"+
            "        .debug_tab_selected {"+
            "            background-color: #444;"+
            "            cursor: default;"+
            "        }"+
            "        .debug_tab_not_selected {"+
            "            background-color: #000;"+
            "            cursor: pointer;"+
            "        }"+
            "    </style>"+
            "    <div id=\"caat-debug\">"+
            "        <div id=\"debug_tabs\">"+
            "            <span class=\"tab_max_min\" onCLick=\"javascript: var debug = document.getElementById('debug_tabs_content');if (debug.className === 'debug_tabs_content_visible') {debug.className = 'debug_tabs_content_hidden'} else {debug.className = 'debug_tabs_content_visible'}\"> CAAT Debug panel </span>"+
            "            <span id=\"caat-debug-tab0\" class=\"debug_tab debug_tab_selected\">Performance</span>"+
            "            <span id=\"caat-debug-tab1\" class=\"debug_tab debug_tab_not_selected\">Controls</span>"+
            "            <span class=\"caat_debug_indicator\">"+
            "                <span class=\"caat_debug_bullet\" style=\"background-color:#0f0;\"></span>"+
            "                <span class=\"caat_debug_description\">Draw Time: </span>"+
            "                <span class=\"caat_debug_value\" id=\"textDrawTime\">5.46</span>"+
            "                <span class=\"caat_debug_description\">ms.</span>"+
            "            </span>"+
            "            <span class=\"caat_debug_indicator\">"+
            "                <span class=\"caat_debug_bullet\" style=\"background-color:#f00;\"></span>"+
            "                <span class=\"caat_debug_description\">FPS: </span>"+
            "                <span class=\"caat_debug_value\" id=\"textFPS\">48</span>"+
            "            </span>"+
            "        </div>"+
            "        <div id=\"debug_tabs_content\" class=\"debug_tabs_content_hidden\">"+
            "            <div id=\"caat-debug-tab0-content\">"+
            "                <canvas id=\"caat-debug-canvas\" height=\"60\"></canvas>"+
            "                <div>"+
            "                    <span>"+
            "                        <span class=\"caat_debug_bullet\" style=\"background-color:#0f0;\"></span>"+
            "                        <span class=\"caat_debug_description\">RAF Time:</span>"+
            "                        <span class=\"caat_debug_value\" id=\"textRAFTime\">20.76</span>"+
            "                        <span class=\"caat_debug_description\">ms.</span>"+
            "                    </span>"+
            "                    <span>"+
            "                        <span class=\"caat_debug_bullet\" style=\"background-color:#0ff;\"></span>"+
            "                        <span class=\"caat_debug_description\">Entities Total: </span>"+
            "                        <span class=\"caat_debug_value\" id=\"textEntitiesTotal\">41</span>"+
            "                    </span>"+
            "                    <span>"+
            "                        <span class=\"caat_debug_bullet\" style=\"background-color:#0ff;\"></span>"+
            "                        <span class=\"caat_debug_description\">Entities Active: </span>"+
            "                        <span class=\"caat_debug_value\" id=\"textEntitiesActive\">37</span>"+
            "                    </span>"+
            "                    <span>"+
            "                        <span class=\"caat_debug_bullet\" style=\"background-color:#00f;\"></span>"+
            "                        <span class=\"caat_debug_description\">Draws: </span>"+
            "                        <span class=\"caat_debug_value\" id=\"textDraws\">0</span>"+
            "                    </span>"+
            "                    <span>"+
            "                        <span class=\"caat_debug_bullet\" style=\"background-color:#00f;\"></span>"+
            "                        <span class=\"caat_debug_description\">DirtyRects: </span>"+
            "                        <span class=\"caat_debug_value\" id=\"textDirtyRects\">0</span>"+
            "                    </span>"+
            "                    <span>"+
            "                        <span class=\"caat_debug_bullet\" style=\"background-color:#00f;\"></span>"+
            "                        <span class=\"caat_debug_description\">Discard DR: </span>"+
            "                        <span class=\"caat_debug_value\" id=\"textDiscardDR\">0</span>"+
            "                    </span>"+
            "                </div>"+
            "            </div>"+
            "            <div id=\"caat-debug-tab1-content\">"+
            "                <div>"+
            "                    <div>"+
            "                        <span id=\"control-sound\"></span>"+
            "                        <span class=\"checkbox_description\">Sound</span>"+
            "                    </div>"+
            "                    <div>"+
            "                        <span id=\"control-music\"></span>"+
            "                        <span class=\"checkbox_description\">Music</span>"+
            "                    </div>"+
            "                    <div>"+
            "                        <span id=\"control-aabb\"></span>"+
            "                        <span class=\"checkbox_description\">AA Bounding Boxes</span>"+
            "                    </div>"+
            "                    <div>"+
            "                        <span id=\"control-bb\"></span>"+
            "                        <span class=\"checkbox_description\">Bounding Boxes</span>"+
            "                    </div>"+
            "                    <div>"+
            "                        <span id=\"control-dr\"></span>"+
            "                        <span class=\"checkbox_description\">Dirty Rects</span>"+
            "                    </div>"+
            "                </div>"+
            "            </div>"+
            "        </div>"+
            "    </div>",


        setScale : function(s) {
            this.scale= s;
            return this;
        },

        initialize: function(w,h) {
            w= window.innerWidth;

            this.width= w;
            this.height= h;

            this.framerate = {
                refreshInterval: CAAT.FPS_REFRESH || 500,   // refresh every ? ms, updating too quickly gives too large rounding errors
                frames: 0,                                  // number offrames since last refresh
                timeLastRefresh: 0,                         // When was the framerate counter refreshed last
                fps: 0,                                     // current framerate
                prevFps: -1,                                // previously drawn FPS
                fpsMin: 1000,                               // minimum measured framerate
                fpsMax: 0                                   // maximum measured framerate
            };

            var debugContainer= document.getElementById('caat-debug');
            if (!debugContainer) {
                var wrap = document.createElement('div');
                wrap.innerHTML=this.debugTpl;
                document.body.appendChild(wrap);

                eval( ""+
                    " var __x= CAAT;" +
                    "        function initCheck( name, bool, callback ) {"+
                    "            var elem= document.getElementById(name);"+
                    "            if ( elem ) {"+
                    "                elem.className= (bool) ? \"checkbox_enabled\" : \"checkbox_disabled\";"+
                    "                if ( callback ) {"+
                    "                    elem.addEventListener( \"click\", (function(elem, callback) {"+
                    "                        return function(e) {"+
                    "                            elem.__value= !elem.__value;"+
                    "                            elem.className= (elem.__value) ? \"checkbox_enabled\" : \"checkbox_disabled\";"+
                    "                            callback(e,elem.__value);"+
                    "                        }"+
                    "                    })(elem, callback), false );"+
                    "                }"+
                    "                elem.__value= bool;"+
                    "            }"+
                    "        }"+
                    "        function setupTabs() {"+
                    "            var numTabs=0;"+
                    "            var elem;"+
                    "            var elemContent;"+
                    "            do {"+
                    "                elem= document.getElementById(\"caat-debug-tab\"+numTabs);"+
                    "                if ( elem ) {"+
                    "                    elemContent= document.getElementById(\"caat-debug-tab\"+numTabs+\"-content\");"+
                    "                    if ( elemContent ) {"+
                    "                        elemContent.style.display= numTabs===0 ? 'block' : 'none';"+
                    "                        elem.className= numTabs===0 ? \"debug_tab debug_tab_selected\" : \"debug_tab debug_tab_not_selected\";"+
                    "                        elem.addEventListener( \"click\", (function(tabIndex) {"+
                    "                            return function(e) {"+
                    "                                for( var i=0; i<numTabs; i++ ) {"+
                    "                                    var _elem= document.getElementById(\"caat-debug-tab\"+i);"+
                    "                                    var _elemContent= document.getElementById(\"caat-debug-tab\"+i+\"-content\");"+
                    "                                    _elemContent.style.display= i===tabIndex ? 'block' : 'none';"+
                    "                                    _elem.className= i===tabIndex ? \"debug_tab debug_tab_selected\" : \"debug_tab debug_tab_not_selected\";"+
                    "                                }"+
                    "                            }"+
                    "                        })(numTabs), false );"+
                    "                    }"+
                    "                    numTabs++;"+
                    "                }"+
                    "            } while( elem );"+
                    "        }"+
                    "        initCheck( \"control-sound\", __x.director[0].isSoundEffectsEnabled(), function(e, bool) {"+
                    "            __x.director[0].setSoundEffectsEnabled(bool);"+
                    "        } );"+
                    "        initCheck( \"control-music\", __x.director[0].isMusicEnabled(), function(e, bool) {"+
                    "            __x.director[0].setMusicEnabled(bool);"+
                    "        } );"+
                    "        initCheck( \"control-aabb\", CAAT.DEBUGBB, function(e,bool) {"+
                    "            CAAT.DEBUGAABB= bool;"+
                    "            __x.director[0].currentScene.dirty= true;"+
                    "        } );"+
                    "        initCheck( \"control-bb\", CAAT.DEBUGBB, function(e,bool) {"+
                    "            CAAT.DEBUGBB= bool;"+
                    "            if ( bool ) {"+
                    "                CAAT.DEBUGAABB= true;"+
                    "            }"+
                    "            __x.director[0].currentScene.dirty= true;"+
                    "        } );"+
                    "        initCheck( \"control-dr\", CAAT.DEBUG_DIRTYRECTS , function( e,bool ) {"+
                    "            CAAT.DEBUG_DIRTYRECTS= bool;"+
                    "        });"+
                    "        setupTabs();" );

            }

            this.canvas= document.getElementById('caat-debug-canvas');
            if ( null===this.canvas ) {
                this.canDebug= false;
                return;
            }

            this.canvas.width= w;
            this.canvas.height=h;
            this.ctx= this.canvas.getContext('2d');

            this.ctx.fillStyle= '#000';
            this.ctx.fillRect(0,0,this.width,this.height);

            this.textFPS= document.getElementById("textFPS");
            this.textDrawTime= document.getElementById("textDrawTime");
            this.textRAFTime= document.getElementById("textRAFTime");
            this.textEntitiesTotal= document.getElementById("textEntitiesTotal");
            this.textEntitiesActive= document.getElementById("textEntitiesActive");
            this.textDraws= document.getElementById("textDraws");
            this.textDirtyRects= document.getElementById("textDirtyRects");
            this.textDiscardDR= document.getElementById("textDiscardDR");


            this.canDebug= true;

            return this;
        },

        debugInfo : function( statistics ) {
            this.statistics= statistics;

            var cc= CAAT;

            this.frameTimeAcc+= cc.FRAME_TIME;
            this.frameRAFAcc+= cc.REQUEST_ANIMATION_FRAME_TIME;

            /* Update the framerate counter */
            this.framerate.frames++;
            if ( cc.RAF > this.framerate.timeLastRefresh + this.framerate.refreshInterval ) {
                this.framerate.fps = ( ( this.framerate.frames * 1000 ) / ( cc.RAF - this.framerate.timeLastRefresh ) ) | 0;
                this.framerate.fpsMin = this.framerate.frames > 0 ? Math.min( this.framerate.fpsMin, this.framerate.fps ) : this.framerate.fpsMin;
                this.framerate.fpsMax = Math.max( this.framerate.fpsMax, this.framerate.fps );

                this.textFPS.innerHTML= this.framerate.fps;

                var value= ((this.frameTimeAcc*100/this.framerate.frames)|0)/100;
                this.frameTimeAcc=0;
                this.textDrawTime.innerHTML= value;

                var value2= ((this.frameRAFAcc*100/this.framerate.frames)|0)/100;
                this.frameRAFAcc=0;
                this.textRAFTime.innerHTML= value2;

                this.framerate.timeLastRefresh = cc.RAF;
                this.framerate.frames = 0;

                this.paint(value2);
            }

            this.textEntitiesTotal.innerHTML= this.statistics.size_total;
            this.textEntitiesActive.innerHTML= this.statistics.size_active;
            this.textDirtyRects.innerHTML= this.statistics.size_dirtyRects;
            this.textDraws.innerHTML= this.statistics.draws;
            this.textDiscardDR.innerHTML= this.statistics.size_discarded_by_dirty_rects;
        },

        paint : function( rafValue ) {
            var ctx= this.ctx;
            var t=0;

            ctx.drawImage(
                this.canvas,
                1, 0, this.width-1, this.height,
                0, 0, this.width-1, this.height );

            ctx.strokeStyle= 'black';
            ctx.beginPath();
            ctx.moveTo( this.width-.5, 0 );
            ctx.lineTo( this.width-.5, this.height );
            ctx.stroke();

            ctx.strokeStyle= '#a22';
            ctx.beginPath();
            t= this.height-((20/this.SCALE*this.height)>>0)-.5;
            ctx.moveTo( .5, t );
            ctx.lineTo( this.width+.5, t );
            ctx.stroke();

            ctx.strokeStyle= '#aa2';
            ctx.beginPath();
            t= this.height-((30/this.SCALE*this.height)>>0)-.5;
            ctx.moveTo( .5, t );
            ctx.lineTo( this.width+.5, t );
            ctx.stroke();

            var fps = Math.min( this.height-(this.framerate.fps/this.SCALE*this.height), 59 );
            if (-1===this.framerate.prevFps) {
                this.framerate.prevFps= fps|0;
            }

            ctx.strokeStyle= '#0ff';//this.framerate.fps<15 ? 'red' : this.framerate.fps<30 ? 'yellow' : 'green';
            ctx.beginPath();
            ctx.moveTo( this.width, (fps|0)-.5 );
            ctx.lineTo( this.width, this.framerate.prevFps-.5 );
            ctx.stroke();

            this.framerate.prevFps= fps;


            var t1= ((this.height-(rafValue/this.SCALE*this.height))>>0)-.5;
            ctx.strokeStyle= '#ff0';
            ctx.beginPath();
            ctx.moveTo( this.width, t1 );
            ctx.lineTo( this.width, t1 );
            ctx.stroke();
        }
    }

});
/**
 * See LICENSE file.
 *
 **/

CAAT.Module({
    defines : "CAAT.Module.Font.Font",
    aliases : "CAAT.Font",
    depends : [
        "CAAT.Foundation.SpriteImage"
    ],
    constants: {

        getFontMetrics:function (font) {
            var ret;
            if (CAAT.CSS_TEXT_METRICS) {
                try {
                    ret = CAAT.Module.Font.Font.getFontMetricsCSS(font);
                    return ret;
                } catch (e) {

                }
            }

            return CAAT.Module.Font.Font.getFontMetricsNoCSS(font);
        },

        getFontMetricsNoCSS:function (font) {

            var re = /(\d+)p[x|t]/i;
            var res = re.exec(font);

            var height;

            if (!res) {
                height = 32;     // no px or pt value in font. assume 32.)
            } else {
                height = res[1] | 0;
            }

            var ascent = height - 1;
            var h = (height + height * .2) | 0;
            return {
                height:h,
                ascent:ascent,
                descent:h - ascent
            }

        },

        /**
         * Totally ripped from:
         *
         * jQuery (offset function)
         * Daniel Earwicker: http://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
         *
         * @param font
         * @return {*}
         */
        getFontMetricsCSS:function (font) {

            function offset(elem) {

                var box, docElem, body, win, clientTop, clientLeft, scrollTop, scrollLeft, top, left;
                var doc = elem && elem.ownerDocument;
                docElem = doc.documentElement;

                box = elem.getBoundingClientRect();
                //win = getWindow( doc );

                body = document.body;
                win = doc.nodeType === 9 ? doc.defaultView || doc.parentWindow : false;

                clientTop = docElem.clientTop || body.clientTop || 0;
                clientLeft = docElem.clientLeft || body.clientLeft || 0;
                scrollTop = win.pageYOffset || docElem.scrollTop;
                scrollLeft = win.pageXOffset || docElem.scrollLeft;
                top = box.top + scrollTop - clientTop;
                left = box.left + scrollLeft - clientLeft;

                return { top:top, left:left };
            }

            try {
                var text = document.createElement("span");
                text.style.font = font;
                text.innerHTML = "Hg";

                var block = document.createElement("div");
                block.style.display = "inline-block";
                block.style.width = "1px";
                block.style.heigh = "0px";

                var div = document.createElement("div");
                div.appendChild(text);
                div.appendChild(block);


                var body = document.body;
                body.appendChild(div);

                try {

                    var result = {};

                    block.style.verticalAlign = 'baseline';
                    result.ascent = offset(block).top - offset(text).top;

                    block.style.verticalAlign = 'bottom';
                    result.height = offset(block).top - offset(text).top;

                    result.ascent = Math.ceil(result.ascent);
                    result.height = Math.ceil(result.height);

                    result.descent = result.height - result.ascent;

                    return result;

                } finally {
                    body.removeChild(div);
                }
            } catch (e) {
                return null;
            }
        }
    },
    extendsWith:function () {

        var UNKNOWN_CHAR_WIDTH = 10;

        return {

            fontSize:10,
            fontSizeUnit:"px",
            font:'Sans-Serif',
            fontStyle:'',
            fillStyle:'#fff',
            strokeStyle:null,
            strokeSize:1,
            padding:0,
            image:null,
            charMap:null,

            height:0,
            ascent:0,
            descent:0,

            setPadding:function (padding) {
                this.padding = padding;
                return this;
            },

            setFontStyle:function (style) {
                this.fontStyle = style;
                return this;
            },

            setStrokeSize:function (size) {
                this.strokeSize = size;
                return this;
            },

            setFontSize:function (fontSize) {
                this.fontSize = fontSize;
                this.fontSizeUnit = 'px';
                return this;
            },

            setFont:function (font) {
                this.font = font;
                return this;
            },

            setFillStyle:function (style) {
                this.fillStyle = style;
                return this;
            },

            setStrokeStyle:function (style) {
                this.strokeStyle = style;
                return this;
            },

            createDefault:function (padding) {
                var str = "";
                for (var i = 32; i < 128; i++) {
                    str = str + String.fromCharCode(i);
                }

                return this.create(str, padding);
            },

            create:function (chars, padding) {

                padding = padding | 0;
                this.padding = padding;

                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');

                ctx.textBaseline = 'bottom';
                ctx.font = this.fontStyle + ' ' + this.fontSize + "" + this.fontSizeUnit + " " + this.font;

                var textWidth = 0;
                var charWidth = [];
                var i;
                var x;
                var cchar;

                for (i = 0; i < chars.length; i++) {
                    var cw = Math.max(1, (ctx.measureText(chars.charAt(i)).width >> 0) + 1) + 2 * padding;
                    charWidth.push(cw);
                    textWidth += cw;
                }


                var fontMetrics = CAAT.Font.getFontMetrics(ctx.font);
                var baseline = "alphabetic", yoffset, canvasheight;

                canvasheight = fontMetrics.height;
                this.ascent = fontMetrics.ascent;
                this.descent = fontMetrics.descent;
                this.height = fontMetrics.height;
                yoffset = fontMetrics.ascent;

                canvas.width = textWidth;
                canvas.height = canvasheight;
                ctx = canvas.getContext('2d');

                //ctx.textBaseline= 'bottom';
                ctx.textBaseline = baseline;
                ctx.font = this.fontStyle + ' ' + this.fontSize + "" + this.fontSizeUnit + " " + this.font;
                ctx.fillStyle = this.fillStyle;
                ctx.strokeStyle = this.strokeStyle;

                this.charMap = {};

                x = 0;
                for (i = 0; i < chars.length; i++) {
                    cchar = chars.charAt(i);
                    ctx.fillText(cchar, x + padding, yoffset);
                    if (this.strokeStyle) {
                        ctx.beginPath();
                        ctx.lineWidth = this.strokeSize;
                        ctx.strokeText(cchar, x + padding, yoffset);
                    }
                    this.charMap[cchar] = {
                        x:x + padding,
                        width:charWidth[i] - 2 * padding
                    };
                    x += charWidth[i];
                }

                this.image = canvas;

                return this;
            },

            setAsSpriteImage:function () {
                var cm = [];
                var _index = 0;
                for (var i in this.charMap) {
                    var _char = i;
                    var charData = this.charMap[i];

                    cm[i] = {
                        id:_index++,
                        height:this.height,
                        xoffset:0,
                        letter:_char,
                        yoffset:0,
                        width:charData.width,
                        xadvance:charData.width,
                        x:charData.x,
                        y:0
                    };
                }

                this.spriteImage = new CAAT.Foundation.SpriteImage().initializeAsGlyphDesigner(this.image, cm);
                return this;
            },

            getAscent:function () {
                return this.ascent;
            },

            getDescent:function () {
                return this.descent;
            },

            stringHeight:function () {
                return this.height;
            },

            getFontData:function () {
                return {
                    height:this.height,
                    ascent:this.ascent,
                    descent:this.descent
                };
            },

            stringWidth:function (str) {
                var i, l, w = 0, c;

                for (i = 0, l = str.length; i < l; i++) {
                    c = this.charMap[ str.charAt(i) ];
                    if (c) {
                        w += c.width;
                    } else {
                        w += UNKNOWN_CHAR_WIDTH;
                    }
                }

                return w;
            },

            drawText:function (str, ctx, x, y) {
                var i, l, charInfo, w;
                var height = this.image.height;

                for (i = 0, l = str.length; i < l; i++) {
                    charInfo = this.charMap[ str.charAt(i) ];
                    if (charInfo) {
                        w = charInfo.width;
                        ctx.drawImage(
                            this.image,
                            charInfo.x, 0,
                            w, height,
                            x, y,
                            w, height);

                        x += w;
                    } else {
                        ctx.strokeStyle = '#f00';
                        ctx.strokeRect(x, y, UNKNOWN_CHAR_WIDTH, height);
                        x += UNKNOWN_CHAR_WIDTH;
                    }
                }
            },

            save:function () {
                var str = "image/png";
                var strData = this.image.toDataURL(str);
                document.location.href = strData.replace(str, "image/octet-stream");
            },

            drawSpriteText:function (director, time) {
                this.spriteImage.drawSpriteText(director, time);
            }

        }
    }

});

/**
 * See LICENSE file.
 *
	  ####  #####  ##### ####    ###  #   # ###### ###### ##     ##  #####  #     #      ########    ##    #  #  #####
	 #   # #   #  ###   #   #  #####  ###    ##     ##   ##  #  ##    #    #     #     #   ##   #  #####  ###   ###
	 ###  #   #  ##### ####   #   #   #   ######   ##   #########  #####  ##### ##### #   ##   #  #   #  #   # #####
 -
 File:
 	PackedCircle.js
 Created By:
 	Mario Gonzalez
 Project	:
 	None
 Abstract:
 	 A single packed circle.
	 Contains a reference to it's div, and information pertaining to it state.
 Basic Usage:
	http://onedayitwillmake.com/CirclePackJS/
*/

CAAT.Module( {
    defines : "CAAT.Module.CircleManager.PackedCircle",
    depends : [
        "CAAT.Module.CircleManager.PackedCircle",
        "CAAT.Math.Point"
    ],
    constants : {
        BOUNDS_RULE_WRAP:		1,      // Wrap to otherside
        BOUNDS_RULE_CONSTRAINT:	2,      // Constrain within bounds
        BOUNDS_RULE_DESTROY:	4,      // Destroy when it reaches the edge
        BOUNDS_RULE_IGNORE:		8		// Ignore when reaching bounds
    },
    extendsWith : {
        __init : function() {
            this.boundsRule = CAAT.Module.CircleManager.PackedCircle.BOUNDS_RULE_IGNORE;
            this.position = new CAAT.Math.Point(0,0,0);
            this.offset = new CAAT.Math.Point(0,0,0);
            this.targetPosition = new CAAT.Math.Point(0,0,0);
            return this;
        },

		id:             0,
		delegate:		null,
		position:		null,
		offset:			null,

		targetPosition:	null,	// Where it wants to go
		targetChaseSpeed: 0.02,

		isFixed:		false,
		boundsRule:		0,
		collisionMask:	0,
		collisionGroup:	0,

		containsPoint: function(aPoint)
		{
			var distanceSquared = this.position.getDistanceSquared(aPoint);
			return distanceSquared < this.radiusSquared;
		},

		getDistanceSquaredFromPosition: function(aPosition)
		{
			var distanceSquared = this.position.getDistanceSquared(aPosition);
			// if it's shorter than either radius, we intersect
			return distanceSquared < this.radiusSquared;
		},

		intersects: function(aCircle)
		{
			var distanceSquared = this.position.getDistanceSquared(aCircle.position);
			return (distanceSquared < this.radiusSquared || distanceSquared < aCircle.radiusSquared);
		},

/**
 * ACCESSORS
 */
		setPosition: function(aPosition)
		{
			this.position = aPosition;
			return this;
		},

		setDelegate: function(aDelegate)
		{
			this.delegate = aDelegate;
			return this;
		},

		setOffset: function(aPosition)
		{
			this.offset = aPosition;
			return this;
		},

		setTargetPosition: function(aTargetPosition)
		{
			this.targetPosition = aTargetPosition;
			return this;
		},

		setTargetChaseSpeed: function(aTargetChaseSpeed)
		{
			this.targetChaseSpeed = aTargetChaseSpeed;
			return this;
		},

		setIsFixed: function(value)
		{
			this.isFixed = value;
			return this;
		},

		setCollisionMask: function(aCollisionMask)
		{
			this.collisionMask = aCollisionMask;
			return this;
		},

		setCollisionGroup: function(aCollisionGroup)
		{
			this.collisionGroup = aCollisionGroup;
			return this;
		},

		setRadius: function(aRadius)
		{
			this.radius = aRadius;
			this.radiusSquared = this.radius*this.radius;
			return this;
		},

		initialize : function(overrides)
		{
			if (overrides)
			{
				for (var i in overrides)
				{
					this[i] = overrides[i];
				}
			}

			return this;
		},

		dealloc: function()
		{
			this.position = null;
			this.offset = null;
			this.delegate = null;
			this.targetPosition = null;
		}
	}
});
/**
 *
 * See LICENSE file.
 * 
	  ####  #####  ##### ####    ###  #   # ###### ###### ##     ##  #####  #     #      ########    ##    #  #  #####
	 #   # #   #  ###   #   #  #####  ###    ##     ##   ##  #  ##    #    #     #     #   ##   #  #####  ###   ###
	 ###  #   #  ##### ####   #   #   #   ######   ##   #########  #####  ##### ##### #   ##   #  #   #  #   # #####
 -
 File:
 	PackedCircle.js
 Created By:
 	Mario Gonzalez
 Project	:
 	None
 Abstract:
 	 A single packed circle.
	 Contains a reference to it's div, and information pertaining to it state.
 Basic Usage:
	http://onedayitwillmake.com/CirclePackJS/
*/

CAAT.Module( {
    defines : "CAAT.Module.CircleManager.PackedCircleManager",
    depends : [
        "CAAT.Math.Point",
        "CAAT.Math.Rectangle"
    ],
    extendsWith : {

        __init : function() {
            this.bounds= new CAAT.Math.Rectangle();
        },

		allCircles:					[],
		numberOfCollisionPasses:	1,
		numberOfTargetingPasses:	0,
		bounds:						null,

		/**
		 * Adds a circle to the simulation
		 * @param aCircle
		 */
		addCircle: function(aCircle)
		{
			aCircle.id = this.allCircles.length;
			this.allCircles.push(aCircle);
			return this;
		},

		/**
		 * Removes a circle from the simulations
		 * @param aCircle	Circle to remove
		 */
		removeCircle: function(aCircle)
		{
			var index = 0,
				found = false,
				len = this.allCircles.length;

			if(len === 0) {
				throw "Error: (PackedCircleManager) attempting to remove circle, and allCircles.length === 0!!";
			}

			while (len--) {
				if(this.allCircles[len] === aCircle) {
					found = true;
					index = len;
					break;
				}
			}

			if(!found) {
				throw "Could not locate circle in allCircles array!";
			}

			// Remove
			this.allCircles[index].dealloc();
			this.allCircles[index] = null;

			return this;
		},

		/**
		 * Forces all circles to move to where their delegate position is
		 * Assumes all targets have a 'position' property!
		 */
		forceCirclesToMatchDelegatePositions: function()
		{
			var len = this.allCircles.length;

			// push toward target position
			for(var n = 0; n < len; n++)
			{
				var aCircle = this.allCircles[n];
				if(!aCircle || !aCircle.delegate) {
					continue;
				}

				aCircle.position.set(aCircle.delegate.x + aCircle.offset.x,
						aCircle.delegate.y + aCircle.offset.y);
			}
		},

		pushAllCirclesTowardTarget: function(aTarget)
		{
			var v = new CAAT.Math.Point(0,0,0),
				circleList = this.allCircles,
				len = circleList.length;

			// push toward target position
			for(var n = 0; n < this.numberOfTargetingPasses; n++)
			{
				for(var i = 0; i < len; i++)
				{
					var c = circleList[i];

					if(c.isFixed) continue;

					v.x = c.position.x - (c.targetPosition.x+c.offset.x);
					v.y = c.position.y - (c.targetPosition.y+c.offset.y);
					v.multiply(c.targetChaseSpeed);

					c.position.x -= v.x;
					c.position.y -= v.y;
				}
			}
		},

		/**
		 * Packs the circles towards the center of the bounds.
		 * Each circle will have it's own 'targetPosition' later on
		 */
		handleCollisions: function()
		{
			this.removeExpiredElements();

			var v = new CAAT.Math.Point(0,0, 0),
				circleList = this.allCircles,
				len = circleList.length;

			// Collide circles
			for(var n = 0; n < this.numberOfCollisionPasses; n++)
			{
				for(var i = 0; i < len; i++)
				{
					var ci = circleList[i];


					for (var j = i + 1; j< len; j++)
					{
						var cj = circleList[j];

						if( !this.circlesCanCollide(ci, cj) ) continue;   // It's us!

						var dx = cj.position.x - ci.position.x,
							dy = cj.position.y - ci.position.y;

						// The distance between the two circles radii, but we're also gonna pad it a tiny bit
						var r = (ci.radius + cj.radius) * 1.08,
							d = ci.position.getDistanceSquared(cj.position);

						/**
						 * Collision detected!
						 */
						if (d < (r * r) - 0.02 )
						{
							v.x = dx;
							v.y = dy;
							v.normalize();

							var inverseForce = (r - Math.sqrt(d)) * 0.5;
							v.multiply(inverseForce);

							// Move cj opposite of the collision as long as its not fixed
							if(!cj.isFixed)
							{
								if(ci.isFixed)
									v.multiply(2.2);	// Double inverse force to make up for the fact that the other object is fixed

								// ADD the velocity
								cj.position.translatePoint(v);
							}

							// Move ci opposite of the collision as long as its not fixed
							if(!ci.isFixed)
							{
								if(cj.isFixed)
									v.multiply(2.2);	// Double inverse force to make up for the fact that the other object is fixed

								 // SUBTRACT the velocity
								ci.position.subtract(v);
							}

							// Emit the collision event from each circle, with itself as the first parameter
//							if(this.dispatchCollisionEvents && n == this.numberOfCollisionPasses-1)
//							{
//								this.eventEmitter.emit('collision', cj, ci, v);
//							}
						}
					}
				}
			}
		},

		handleBoundaryForCircle: function(aCircle, boundsRule)
		{
//			if(aCircle.boundsRule === true) return; // Ignore if being dragged

			var xpos = aCircle.position.x;
			var ypos = aCircle.position.y;

			var radius = aCircle.radius;
			var diameter = radius*2;

			// Toggle these on and off,
			// Wrap and bounce, are opposite behaviors so pick one or the other for each axis, or bad things will happen.
			var wrapXMask = 1 << 0;
			var wrapYMask = 1 << 2;
			var constrainXMask = 1 << 3;
			var constrainYMask = 1 << 4;
			var emitEvent = 1 << 5;

			// TODO: Promote to member variable
			// Convert to bitmask - Uncomment the one you want, or concact your own :)
	//		boundsRule = wrapY; // Wrap only Y axis
	//		boundsRule = wrapX; // Wrap only X axis
	//		boundsRule = wrapXMask | wrapYMask; // Wrap both X and Y axis
			boundsRule = wrapYMask | constrainXMask;  // Wrap Y axis, but constrain horizontally

			// Wrap X
			if(boundsRule & wrapXMask && xpos-diameter > this.bounds.right) {
				aCircle.position.x = this.bounds.left + radius;
			} else if(boundsRule & wrapXMask && xpos+diameter < this.bounds.left) {
				aCircle.position.x = this.bounds.right - radius;
			}
			// Wrap Y
			if(boundsRule & wrapYMask && ypos-diameter > this.bounds.bottom) {
				aCircle.position.y = this.bounds.top - radius;
			} else if(boundsRule & wrapYMask && ypos+diameter < this.bounds.top) {
				aCircle.position.y = this.bounds.bottom + radius;
			}

			// Constrain X
			if(boundsRule & constrainXMask && xpos+radius >= this.bounds.right) {
				aCircle.position.x = aCircle.position.x = this.bounds.right-radius;
			} else if(boundsRule & constrainXMask && xpos-radius < this.bounds.left) {
				aCircle.position.x = this.bounds.left + radius;
			}

			// Constrain Y
			if(boundsRule & constrainYMask && ypos+radius > this.bounds.bottom) {
				aCircle.position.y = this.bounds.bottom - radius;
			} else if(boundsRule & constrainYMask && ypos-radius < this.bounds.top) {
				aCircle.position.y = this.bounds.top + radius;
			}
		},

		/**
		 * Given an x,y position finds circle underneath and sets it to the currently grabbed circle
		 * @param {Number} xpos		An x position
		 * @param {Number} ypos		A y position
		 * @param {Number} buffer	A radiusSquared around the point in question where something is considered to match
		 */
		getCircleAt: function(xpos, ypos, buffer)
		{
			var circleList = this.allCircles;
			var len = circleList.length;
			var grabVector = new CAAT.Math.Point(xpos, ypos, 0);

			// These are set every time a better match i found
			var closestCircle = null;
			var closestDistance = Number.MAX_VALUE;

			// Loop thru and find the closest match
			for(var i = 0; i < len; i++)
			{
				var aCircle = circleList[i];
				if(!aCircle) continue;
				var distanceSquared = aCircle.position.getDistanceSquared(grabVector);

				if(distanceSquared < closestDistance && distanceSquared < aCircle.radiusSquared + buffer)
				{
					closestDistance = distanceSquared;
					closestCircle = aCircle;
				}
			}

			return closestCircle;
		},

		circlesCanCollide: function(circleA, circleB)
		{
		    if(!circleA || !circleB || circleA===circleB) return false; 					// one is null (will be deleted next loop), or both point to same obj.
//			if(circleA.delegate == null || circleB.delegate == null) return false;					// This circle will be removed next loop, it's entity is already removed

//			if(circleA.isFixed & circleB.isFixed) return false;
//			if(circleA.delegate .clientID === circleB.delegate.clientID) return false; 				// Don't let something collide with stuff it owns

			// They dont want to collide
//			if((circleA.collisionGroup & circleB.collisionMask) == 0) return false;
//			if((circleB.collisionGroup & circleA.collisionMask) == 0) return false;

			return true;
		},
/**
 * Accessors
 */
		setBounds: function(x, y, w, h)
		{
			this.bounds.x = x;
			this.bounds.y = y;
			this.bounds.width = w;
			this.bounds.height = h;
		},

		setNumberOfCollisionPasses: function(value)
		{
			this.numberOfCollisionPasses = value;
			return this;
		},

		setNumberOfTargetingPasses: function(value)
		{
			this.numberOfTargetingPasses = value;
			return this;
		},

/**
 * Helpers
 */
		sortOnDistanceToTarget: function(circleA, circleB)
		{
			var valueA = circleA.getDistanceSquaredFromPosition(circleA.targetPosition);
			var valueB = circleB.getDistanceSquaredFromPosition(circleA.targetPosition);
			var comparisonResult = 0;

			if(valueA > valueB) comparisonResult = -1;
			else if(valueA < valueB) comparisonResult = 1;

			return comparisonResult;
		},

/**
 * Memory Management
 */
		removeExpiredElements: function()
		{
			// remove null elements
			for (var k = this.allCircles.length; k >= 0; k--) {
				if (this.allCircles[k] === null)
					this.allCircles.splice(k, 1);
			}
		},

		initialize : function(overrides)
		{
			if (overrides)
			{
				for (var i in overrides)
				{
					this[i] = overrides[i];
				}
			}

			return this;
		}
	}
});
/**
 * See LICENSE file.
 *
 * Image/Resource preloader.
 *
 *
 **/

CAAT.Module( {
    defines : "CAAT.Module.Preloader.Preloader",
    extendsWith : function() {

        var descriptor= function(id, path, loader) {

            var me= this;

            this.id=    id;
            this.path=  path;
            this.image= new Image();

            this.image.onload = function() {
                loader.__onload(me);
            };

            this.image.onerror= function(e) {
                loader.__onerror(me);
            } ;

            this.load= function() {
                me.image.src= me.path;
            };

            return this;
        };

        return {
            __init : function()   {
                this.elements= [];
                return this;
            },

            elements:       null,   // a list of elements to load
            imageCounter:   0,      // elements counter.
            cfinished:      null,
            cloaded:        null,
            cerrored:       null,
            loadedCount:    0,

            addElement : function( id, path ) {
                this.elements.push( new descriptor(id,path,this) );
                return this;
            },

            __onload : function( d ) {
                if ( this.cloaded ) {
                    this.cloaded(d.id);
                }

                this.loadedCount++;
                if ( this.loadedCount===this.elements.length ) {
                    if ( this.cfinished ) {
                        this.cfinished( this.elements );
                    }
                }
            },

            __onerror : function( d ) {
                if ( this.cerrored ) {
                    this.cerrored(d.id);
                }
            },

            load: function( onfinished, onload_one, onerror ) {

                this.cfinished= onfinished;
                this.cloaded= onload_one;
                this.cerroed= onerror;

                var i;

                for( i=0; i<this.elements.length; i++ ) {
                    this.elements[i].load();
                }

                return this;
            }
        }
    }
});
/**
 * See LICENSE file.
 *
 * Image/Resource preloader.
 *
 *
 **/

CAAT.Module( {
    defines : "CAAT.Module.Preloader.ImagePreloader",
    aliases : ["CAAT.ImagePreloader"],
    extendsWith : {
        __init : function()   {
            this.images = [];
            return this;
        },

        images:                 null,   // a list of elements to load
        notificationCallback:   null,   // notification callback invoked for each image loaded.
        imageCounter:           0,      // elements counter.

        /**
         * Start images loading asynchronous process. This method will notify every image loaded event
         * and is responsibility of the caller to count the number of loaded images to see if it fits his
         * needs.
         * 
         * @param aImages {{ id:{url}, id2:{url}, ...} an object with id/url pairs.
         * @param callback_loaded_one_image {function( imageloader {CAAT.ImagePreloader}, counter {number}, images {{ id:{string}, image: {Image}}} )}
         * function to call on every image load.
         */
        loadImages: function( aImages, callback_loaded_one_image, callback_error ) {

            if (!aImages) {
                if (callback_loaded_one_image ) {
                    callback_loaded_one_image(0,[]);
                }
            }

            var me= this, i;
            this.notificationCallback = callback_loaded_one_image;
            this.images= [];
            for( i=0; i<aImages.length; i++ ) {
                this.images.push( {id:aImages[i].id, image: new Image() } );
            }

            for( i=0; i<aImages.length; i++ ) {
                this.images[i].image.onload = function imageLoaded() {
                    me.imageCounter++;
                    me.notificationCallback(me.imageCounter, me.images);
                };

                this.images[i].image.onerror= (function(index) {
                        return function(e) {
                            if ( callback_error ) {
                                callback_error( e, index );
                            }
                        }
                    })(i);

                this.images[i].image.src= aImages[i].url;
            }

            if ( aImages.length===0 ) {
                callback_loaded_one_image(0,[]);
            }
        }

    }
});
/**
 * See LICENSE file.
 */
CAAT.Module({
    defines:"CAAT.Module.Image.ImageUtil",
    depends : [
        "CAAT.Math.Matrix"
    ],
    extendsWith:{

    },
    constants:{
        createAlphaSpriteSheet:function (maxAlpha, minAlpha, sheetSize, image, bg_fill_style) {

            if (maxAlpha < minAlpha) {
                var t = maxAlpha;
                maxAlpha = minAlpha;
                minAlpha = t;
            }

            var canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height * sheetSize;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = bg_fill_style ? bg_fill_style : 'rgba(255,255,255,0)';
            ctx.fillRect(0, 0, image.width, image.height * sheetSize);

            var i;
            for (i = 0; i < sheetSize; i++) {
                ctx.globalAlpha = 1 - (maxAlpha - minAlpha) / sheetSize * (i + 1);
                ctx.drawImage(image, 0, i * image.height);
            }

            return canvas;
        },

        /**
         * Creates a rotated canvas image element.
         */
        rotate:function (image, angle) {

            angle = angle || 0;
            if (!angle) {
                return image;
            }

            var canvas = document.createElement("canvas");
            canvas.width = image.height;
            canvas.height = image.width;
            var ctx = canvas.getContext('2d');
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var m = new CAAT.Math.Matrix();
            m.multiply(new CAAT.Math.Matrix().setTranslate(canvas.width / 2, canvas.width / 2));
            m.multiply(new CAAT.Math.Matrix().setRotation(angle * Math.PI / 180));
            m.multiply(new CAAT.Math.Matrix().setTranslate(-canvas.width / 2, -canvas.width / 2));
            m.transformRenderingContext(ctx);
            ctx.drawImage(image, 0, 0);

            return canvas;
        },

        /**
         * Remove an image's padding transparent border.
         * Transparent means that every scan pixel is alpha=0.
         */
        optimize:function (image, threshold, areas) {
            threshold >>= 0;

            var atop = true;
            var abottom = true;
            var aleft = true;
            var aright = true;
            if (typeof areas !== 'undefined') {
                if (typeof areas.top !== 'undefined') {
                    atop = areas.top;
                }
                if (typeof areas.bottom !== 'undefined') {
                    abottom = areas.bottom;
                }
                if (typeof areas.left !== 'undefined') {
                    aleft = areas.left;
                }
                if (typeof areas.right !== 'undefined') {
                    aright = areas.right;
                }
            }


            var canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            var ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillRect(0, 0, image.width, image.height);
            ctx.drawImage(image, 0, 0);

            var imageData = ctx.getImageData(0, 0, image.width, image.height);
            var data = imageData.data;

            var i, j;
            var miny = 0, maxy = canvas.height - 1;
            var minx = 0, maxx = canvas.width - 1;

            var alpha = false;

            if (atop) {
                for (i = 0; i < canvas.height; i++) {
                    for (j = 0; j < canvas.width; j++) {
                        if (data[i * canvas.width * 4 + 3 + j * 4] > threshold) {
                            alpha = true;
                            break;
                        }
                    }

                    if (alpha) {
                        break;
                    }
                }
                // i contiene el indice del ultimo scan que no es transparente total.
                miny = i;
            }

            if (abottom) {
                alpha = false;
                for (i = canvas.height - 1; i >= miny; i--) {
                    for (j = 0; j < canvas.width; j++) {
                        if (data[i * canvas.width * 4 + 3 + j * 4] > threshold) {
                            alpha = true;
                            break;
                        }
                    }

                    if (alpha) {
                        break;
                    }
                }
                maxy = i;
            }

            if (aleft) {
                alpha = false;
                for (j = 0; j < canvas.width; j++) {
                    for (i = miny; i <= maxy; i++) {
                        if (data[i * canvas.width * 4 + 3 + j * 4 ] > threshold) {
                            alpha = true;
                            break;
                        }
                    }
                    if (alpha) {
                        break;
                    }
                }
                minx = j;
            }

            if (aright) {
                alpha = false;
                for (j = canvas.width - 1; j >= minx; j--) {
                    for (i = miny; i <= maxy; i++) {
                        if (data[i * canvas.width * 4 + 3 + j * 4 ] > threshold) {
                            alpha = true;
                            break;
                        }
                    }
                    if (alpha) {
                        break;
                    }
                }
                maxx = j;
            }

            if (0 === minx && 0 === miny && canvas.width - 1 === maxx && canvas.height - 1 === maxy) {
                return canvas;
            }

            var width = maxx - minx + 1;
            var height = maxy - miny + 1;
            var id2 = ctx.getImageData(minx, miny, width, height);

            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d');
            ctx.putImageData(id2, 0, 0);

            return canvas;
        },


        createThumb:function (image, w, h, best_fit) {
            w = w || 24;
            h = h || 24;
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');

            if (best_fit) {
                var max = Math.max(image.width, image.height);
                var ww = image.width / max * w;
                var hh = image.height / max * h;
                ctx.drawImage(image, (w - ww) / 2, (h - hh) / 2, ww, hh);
            } else {
                ctx.drawImage(image, 0, 0, w, h);
            }

            return canvas;
        }
    }

})
/**
 * See LICENSE file.
 *
 * This file contains the definition for objects QuadTree and HashMap.
 * Quadtree offers an exact list of collisioning areas, while HashMap offers a list of potentially colliding elements.
 *
 **/

CAAT.Module({

    defines:"CAAT.Module.Collision.QuadTree",
    depends:[
        "CAAT.Math.Rectangle"
    ],
    extendsClass:"CAAT.Math.Rectangle",
    extendsWith:function () {

        var QT_MAX_ELEMENTS = 1;
        var QT_MIN_WIDTH = 32;

        return {

            bgActors:null,

            quadData:null,

            create:function (l, t, r, b, backgroundElements, minWidth, maxElements) {

                if (typeof minWidth === 'undefined') {
                    minWidth = QT_MIN_WIDTH;
                }
                if (typeof maxElements === 'undefined') {
                    maxElements = QT_MAX_ELEMENTS;
                }

                var cx = (l + r) / 2;
                var cy = (t + b) / 2;

                this.x = l;
                this.y = t;
                this.x1 = r;
                this.y1 = b;
                this.width = r - l;
                this.height = b - t;

                this.bgActors = this.__getOverlappingActorList(backgroundElements);

                if (this.bgActors.length <= maxElements || this.width <= minWidth) {
                    return this;
                }

                this.quadData = new Array(4);
                this.quadData[0] = new CAAT.Module.Collision.QuadTree().create(l, t, cx, cy, this.bgActors);  // TL
                this.quadData[1] = new CAAT.Module.Collision.QuadTree().create(cx, t, r, cy, this.bgActors);  // TR
                this.quadData[2] = new CAAT.Module.Collision.QuadTree().create(l, cy, cx, b, this.bgActors);  // BL
                this.quadData[3] = new CAAT.Module.Collision.QuadTree().create(cx, cy, r, b, this.bgActors);

                return this;
            },

            __getOverlappingActorList:function (actorList) {
                var tmpList = [];
                for (var i = 0, l = actorList.length; i < l; i++) {
                    var actor = actorList[i];
                    if (this.intersects(actor.AABB)) {
                        tmpList.push(actor);
                    }
                }
                return tmpList;
            },

            getOverlappingActors:function (rectangle) {
                var i, j, l;
                var overlappingActors = [];
                var qoverlappingActors;
                var actors = this.bgActors;
                var actor;

                if (this.quadData) {
                    for (i = 0; i < 4; i++) {
                        if (this.quadData[i].intersects(rectangle)) {
                            qoverlappingActors = this.quadData[i].getOverlappingActors(rectangle);
                            for (j = 0, l = qoverlappingActors.length; j < l; j++) {
                                overlappingActors.push(qoverlappingActors[j]);
                            }
                        }
                    }
                } else {
                    for (i = 0, l = actors.length; i < l; i++) {
                        actor = actors[i];
                        if (rectangle.intersects(actor.AABB)) {
                            overlappingActors.push(actor);
                        }
                    }
                }

                return overlappingActors;
            }
        }
    }
});
CAAT.Module( {
    defines : "CAAT.Module.Collision.SpatialHash",
    aliases : ["CAAT.SpatialHash"],
    depends : [
        "CAAT.Math.Rectangle"
    ],
    extendsWith : {


        elements    :   null,

        width       :   null,
        height      :   null,

        rows        :   null,
        columns     :   null,

        xcache      :   null,
        ycache      :   null,
        xycache     :   null,

        rectangle   :   null,
        r0          :   null,
        r1          :   null,

        initialize : function( w,h, rows,columns ) {

            var i, j;

            this.elements= [];
            for( i=0; i<rows*columns; i++ ) {
                this.elements.push( [] );
            }

            this.width=     w;
            this.height=    h;

            this.rows=      rows;
            this.columns=   columns;

            this.xcache= [];
            for( i=0; i<w; i++ ) {
                this.xcache.push( (i/(w/columns))>>0 );
            }

            this.ycache= [];
            for( i=0; i<h; i++ ) {
                this.ycache.push( (i/(h/rows))>>0 );
            }

            this.xycache=[];
            for( i=0; i<this.rows; i++ ) {

                this.xycache.push( [] );
                for( j=0; j<this.columns; j++ ) {
                    this.xycache[i].push( j + i*columns  );
                }
            }

            this.rectangle= new CAAT.Math.Rectangle().setBounds( 0, 0, w, h );
            this.r0=        new CAAT.Math.Rectangle();
            this.r1=        new CAAT.Math.Rectangle();

            return this;
        },

        clearObject : function() {
            var i;

            for( i=0; i<this.rows*this.columns; i++ ) {
                this.elements[i]= [];
            }

            return this;
        },

        /**
         * Add an element of the form { id, x,y,width,height, rectangular }
         */
        addObject : function( obj  ) {
            var x= obj.x|0;
            var y= obj.y|0;
            var width= obj.width|0;
            var height= obj.height|0;

            var cells= this.__getCells( x,y,width,height );
            for( var i=0; i<cells.length; i++ ) {
                this.elements[ cells[i] ].push( obj );
            }
        },

        __getCells : function( x,y,width,height ) {

            var cells= [];
            var i;

            if ( this.rectangle.contains(x,y) ) {
                cells.push( this.xycache[ this.ycache[y] ][ this.xcache[x] ] );
            }

            /**
             * if both squares lay inside the same cell, it is not crossing a boundary.
             */
            if ( this.rectangle.contains(x+width-1,y+height-1) ) {
                var c= this.xycache[ this.ycache[y+height-1] ][ this.xcache[x+width-1] ];
                if ( c===cells[0] ) {
                    return cells;
                }
                cells.push( c );
            }

            /**
             * the other two AABB points lie inside the screen as well.
             */
            if ( this.rectangle.contains(x+width-1,y) ) {
                var c= this.xycache[ this.ycache[y] ][ this.xcache[x+width-1] ];
                if ( c===cells[0] || c===cells[1] ) {
                    return cells;
                }
                cells.push(c);
            }

            // worst case, touching 4 screen cells.
            if ( this.rectangle.contains(x+width-1,y+height-1) ) {
                var c= this.xycache[ this.ycache[y+height-1] ][ this.xcache[x] ];
                cells.push(c);
            }

            return cells;
        },

        solveCollision : function( callback ) {
            var i,j,k;

            for( i=0; i<this.elements.length; i++ ) {
                var cell= this.elements[i];

                if ( cell.length>1 ) {  // at least 2 elements could collide
                    this._solveCollisionCell( cell, callback );
                }
            }
        },

        _solveCollisionCell : function( cell, callback ) {
            var i,j;

            for( i=0; i<cell.length; i++ ) {

                var pivot= cell[i];
                this.r0.setBounds( pivot.x, pivot.y, pivot.width, pivot.height );

                for( j=i+1; j<cell.length; j++ ) {
                    var c= cell[j];

                    if ( this.r0.intersects( this.r1.setBounds( c.x, c.y, c.width, c.height ) ) ) {
                        callback( pivot, c );
                    }
                }
            }
        },

        /**
         *
         * @param x
         * @param y
         * @param w
         * @param h
         * @param oncollide function that returns boolean. if returns true, stop testing collision.
         */
        collide : function( x,y,w,h, oncollide ) {
            x|=0;
            y|=0;
            w|=0;
            h|=0;

            var cells= this.__getCells( x,y,w,h );
            var i,j,l;
            var el= this.elements;

            this.r0.setBounds( x,y,w,h );

            for( i=0; i<cells.length; i++ ) {
                var cell= cells[i];

                var elcell= el[cell];
                for( j=0, l=elcell.length; j<l; j++ ) {
                    var obj= elcell[j];

                    this.r1.setBounds( obj.x, obj.y, obj.width, obj.height );

                    // collides
                    if ( this.r0.intersects( this.r1 ) ) {
                        if ( oncollide(obj) ) {
                            return;
                        }
                    }
                }
            }
        }

    }
});
CAAT.Module({
    defines : "CAAT.Module.TexturePacker.TextureElement",
    extendsWith : {

        inverted:   false,
        image:      null,
        u:          0,
        v:          0,
        glTexture:  null
    }
});
