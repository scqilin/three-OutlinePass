var THREE = require('three')
/*  
* CopyShader 
* EffectComposer
* Pass 
* RenderPass 
* ShaderPass 
* OutlinePass 
* MaskPass
* ClearMaskPass
*/
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.CopyShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"opacity":  { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float opacity;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = texture2D( tDiffuse, vUv );",
			"gl_FragColor = opacity * texel;",

		"}"

	].join( "\n" )

};


/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.EffectComposer = function ( renderer, renderTarget ) {

	this.renderer = renderer;

	if ( renderTarget === undefined ) {

		var parameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			stencilBuffer: false
		};

		var size = renderer.getDrawingBufferSize( new THREE.Vector2() );
		renderTarget = new THREE.WebGLRenderTarget( size.width, size.height, parameters );
		renderTarget.texture.name = 'EffectComposer.rt1';

	}

	this.renderTarget1 = renderTarget;
	this.renderTarget2 = renderTarget.clone();
	this.renderTarget2.texture.name = 'EffectComposer.rt2';

	this.writeBuffer = this.renderTarget1;
	this.readBuffer = this.renderTarget2;

	this.passes = [];

	// dependencies

	if ( THREE.CopyShader === undefined ) {

		console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

	}

	if ( THREE.ShaderPass === undefined ) {

		console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

	}

	this.copyPass = new THREE.ShaderPass( THREE.CopyShader );

	this._previousFrameTime = Date.now();

};

Object.assign( THREE.EffectComposer.prototype, {

	swapBuffers: function () {

		var tmp = this.readBuffer;
		this.readBuffer = this.writeBuffer;
		this.writeBuffer = tmp;

	},

	addPass: function ( pass ) {

		this.passes.push( pass );

		var size = this.renderer.getDrawingBufferSize( new THREE.Vector2() );
		pass.setSize( size.width, size.height );

	},

	insertPass: function ( pass, index ) {

		this.passes.splice( index, 0, pass );

	},

	render: function ( deltaTime ) {

		// deltaTime value is in seconds

		if ( deltaTime === undefined ) {

			deltaTime = ( Date.now() - this._previousFrameTime ) * 0.001;

		}

		this._previousFrameTime = Date.now();

		var currentRenderTarget = this.renderer.getRenderTarget();

		var maskActive = false;

		var pass, i, il = this.passes.length;

		for ( i = 0; i < il; i ++ ) {

			pass = this.passes[ i ];

			if ( pass.enabled === false ) continue;

			pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

			if ( pass.needsSwap ) {

				if ( maskActive ) {

					var context = this.renderer.context;

					context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

					this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime );

					context.stencilFunc( context.EQUAL, 1, 0xffffffff );

				}

				this.swapBuffers();

			}

			if ( THREE.MaskPass !== undefined ) {

				if ( pass instanceof THREE.MaskPass ) {

					maskActive = true;

				} else if ( pass instanceof THREE.ClearMaskPass ) {

					maskActive = false;

				}

			}

		}

		this.renderer.setRenderTarget( currentRenderTarget );

	},

	reset: function ( renderTarget ) {

		if ( renderTarget === undefined ) {

			var size = this.renderer.getDrawingBufferSize( new THREE.Vector2() );

			renderTarget = this.renderTarget1.clone();
			renderTarget.setSize( size.width, size.height );

		}

		this.renderTarget1.dispose();
		this.renderTarget2.dispose();
		this.renderTarget1 = renderTarget;
		this.renderTarget2 = renderTarget.clone();

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;

	},

	setSize: function ( width, height ) {

		this.renderTarget1.setSize( width, height );
		this.renderTarget2.setSize( width, height );

		for ( var i = 0; i < this.passes.length; i ++ ) {

			this.passes[ i ].setSize( width, height );

		}

	}

} );


THREE.Pass = function () {

	// if set to true, the pass is processed by the composer
	this.enabled = true;

	// if set to true, the pass indicates to swap read and write buffer after rendering
	this.needsSwap = true;

	// if set to true, the pass clears its buffer before rendering
	this.clear = false;

	// if set to true, the result of the pass is rendered to screen
	this.renderToScreen = false;

};

Object.assign( THREE.Pass.prototype, {

	setSize: function ( width, height ) {},

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

	}

} );

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

	this.clear = true;
	this.clearDepth = false;
	this.needsSwap = false;

};

THREE.RenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.RenderPass,

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		this.scene.overrideMaterial = this.overrideMaterial;

		var oldClearColor, oldClearAlpha;

		if ( this.clearColor ) {

			oldClearColor = renderer.getClearColor().getHex();
			oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor( this.clearColor, this.clearAlpha );

		}

		if ( this.clearDepth ) {

			renderer.clearDepth();

		}

		renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );

		// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
		if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
		renderer.render( this.scene, this.camera );

		if ( this.clearColor ) {

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}

		this.scene.overrideMaterial = null;
		renderer.autoClear = oldAutoClear;

	}

} );

/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.ShaderPass = function ( shader, textureID ) {

	THREE.Pass.call( this );

	this.textureID = ( textureID !== undefined ) ? textureID : "tDiffuse";

	if ( shader instanceof THREE.ShaderMaterial ) {

		this.uniforms = shader.uniforms;

		this.material = shader;

	} else if ( shader ) {

		this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

		this.material = new THREE.ShaderMaterial( {

			defines: Object.assign( {}, shader.defines ),
			uniforms: this.uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader

		} );

	}

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

};

THREE.ShaderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.ShaderPass,

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		if ( this.uniforms[ this.textureID ] ) {

			this.uniforms[ this.textureID ].value = readBuffer.texture;

		}

		this.quad.material = this.material;

		if ( this.renderToScreen ) {

			renderer.setRenderTarget( null );
			renderer.render( this.scene, this.camera );

		} else {

			renderer.setRenderTarget( writeBuffer );
			if ( this.clear ) renderer.clear();
			renderer.render( this.scene, this.camera );

		}

	}

} );

/**
 * @author spidersharma / http://eduperiment.com/
 */

THREE.OutlinePass = function ( resolution, scene, camera, selectedObjects ) {

    this.renderScene = scene;
    this.renderCamera = camera;
    this.selectedObjects = selectedObjects !== undefined ? selectedObjects : [];
    this.visibleEdgeColor = new THREE.Color( 1, 1, 1 );
    this.hiddenEdgeColor = new THREE.Color( 0.1, 0.04, 0.02 );
    this.edgeGlow = 0.0;
    this.usePatternTexture = false;
    this.edgeThickness = 1.0;
    this.edgeStrength = 3.0;
    this.downSampleRatio = 2;
    this.pulsePeriod = 0;

    THREE.Pass.call( this );

    this.resolution = ( resolution !== undefined ) ? new THREE.Vector2( resolution.x,
        resolution.y ) : new THREE.Vector2( 256, 256 );

    var pars = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
    };

    var resx = Math.round( this.resolution.x / this.downSampleRatio );
    var resy = Math.round( this.resolution.y / this.downSampleRatio );

    this.maskBufferMaterial = new THREE.MeshBasicMaterial( {
        color: 0xffffff
    } );
    this.maskBufferMaterial.side = THREE.DoubleSide;
    this.renderTargetMaskBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution
        .y, pars );
    this.renderTargetMaskBuffer.texture.name = "OutlinePass.mask";
    this.renderTargetMaskBuffer.texture.generateMipmaps = false;

    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.side = THREE.DoubleSide;
    this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
    this.depthMaterial.blending = THREE.NoBlending;

    this.prepareMaskMaterial = this.getPrepareMaskMaterial();
    this.prepareMaskMaterial.side = THREE.DoubleSide;

    this.renderTargetDepthBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution
        .y, pars );
    this.renderTargetDepthBuffer.texture.name = "OutlinePass.depth";
    this.renderTargetDepthBuffer.texture.generateMipmaps = false;

    this.renderTargetMaskDownSampleBuffer = new THREE.WebGLRenderTarget( resx, resy, pars );
    this.renderTargetMaskDownSampleBuffer.texture.name = "OutlinePass.depthDownSample";
    this.renderTargetMaskDownSampleBuffer.texture.generateMipmaps = false;

    this.renderTargetBlurBuffer1 = new THREE.WebGLRenderTarget( resx, resy, pars );
    this.renderTargetBlurBuffer1.texture.name = "OutlinePass.blur1";
    this.renderTargetBlurBuffer1.texture.generateMipmaps = false;
    this.renderTargetBlurBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round(
        resy / 2 ), pars );
    this.renderTargetBlurBuffer2.texture.name = "OutlinePass.blur2";
    this.renderTargetBlurBuffer2.texture.generateMipmaps = false;

    this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
    this.renderTargetEdgeBuffer1 = new THREE.WebGLRenderTarget( resx, resy, pars );
    this.renderTargetEdgeBuffer1.texture.name = "OutlinePass.edge1";
    this.renderTargetEdgeBuffer1.texture.generateMipmaps = false;
    this.renderTargetEdgeBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round(
        resy / 2 ), pars );
    this.renderTargetEdgeBuffer2.texture.name = "OutlinePass.edge2";
    this.renderTargetEdgeBuffer2.texture.generateMipmaps = false;

    var MAX_EDGE_THICKNESS = 4;
    var MAX_EDGE_GLOW = 4;

    this.separableBlurMaterial1 = this.getSeperableBlurMaterial( MAX_EDGE_THICKNESS );
    this.separableBlurMaterial1.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );
    this.separableBlurMaterial1.uniforms[ "kernelRadius" ].value = 1;
    this.separableBlurMaterial2 = this.getSeperableBlurMaterial( MAX_EDGE_GLOW );
    this.separableBlurMaterial2.uniforms[ "texSize" ].value = new THREE.Vector2( Math.round(
        resx / 2 ), Math.round( resy / 2 ) );
    this.separableBlurMaterial2.uniforms[ "kernelRadius" ].value = MAX_EDGE_GLOW;

    // Overlay material
    this.overlayMaterial = this.getOverlayMaterial();

    // copy material
    if ( THREE.CopyShader === undefined )
        console.error( "THREE.OutlinePass relies on THREE.CopyShader" );

    var copyShader = THREE.CopyShader;

    this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
    this.copyUniforms[ "opacity" ].value = 1.0;

    this.materialCopy = new THREE.ShaderMaterial( {
        uniforms: this.copyUniforms,
        vertexShader: copyShader.vertexShader,
        fragmentShader: copyShader.fragmentShader,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true
    } );

    this.enabled = true;
    this.needsSwap = false;

    this.oldClearColor = new THREE.Color();
    this.oldClearAlpha = 1;

    this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
    this.scene = new THREE.Scene();

    this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
    this.quad.frustumCulled = false; // Avoid getting clipped
    this.scene.add( this.quad );
	
  	this.pulseWeight = 1.0;
    //this.tempPulseColor1 = new THREE.Color();
    //this.tempPulseColor2 = new THREE.Color();
    this.textureMatrix = new THREE.Matrix4();

};

THREE.OutlinePass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

    constructor: THREE.OutlinePass,

    dispose: function () {

        this.renderTargetMaskBuffer.dispose();
        this.renderTargetDepthBuffer.dispose();
        this.renderTargetMaskDownSampleBuffer.dispose();
        this.renderTargetBlurBuffer1.dispose();
        this.renderTargetBlurBuffer2.dispose();
        this.renderTargetEdgeBuffer1.dispose();
        this.renderTargetEdgeBuffer2.dispose();

    },

    setSize: function ( width, height ) {

        this.renderTargetMaskBuffer.setSize( width, height );

        var resx = Math.round( width / this.downSampleRatio );
        var resy = Math.round( height / this.downSampleRatio );
        this.renderTargetMaskDownSampleBuffer.setSize( resx, resy );
        this.renderTargetBlurBuffer1.setSize( resx, resy );
        this.renderTargetEdgeBuffer1.setSize( resx, resy );
        this.separableBlurMaterial1.uniforms[ "texSize" ].value = new THREE.Vector2(
            resx, resy );

        resx = Math.round( resx / 2 );
        resy = Math.round( resy / 2 );

        this.renderTargetBlurBuffer2.setSize( resx, resy );
        this.renderTargetEdgeBuffer2.setSize( resx, resy );

        this.separableBlurMaterial2.uniforms[ "texSize" ].value = new THREE.Vector2(
            resx, resy );

    },

    changeVisibilityOfSelectedObjects: function ( bVisible ) {

        function gatherSelectedMeshesCallBack( object ) {

            if ( object instanceof THREE.Mesh ) object.visible = bVisible;

        }

        for ( var i = 0; i < this.selectedObjects.length; i++ ) {

            var selectedObject = this.selectedObjects[ i ];
            selectedObject.traverse( gatherSelectedMeshesCallBack );

        }

    },

    changeVisibilityOfNonSelectedObjects: function ( bVisible ) {

        var selectedMeshes = [];

        function gatherSelectedMeshesCallBack( object ) {

            if ( object instanceof THREE.Mesh ) selectedMeshes.push( object );

        }

        for ( var i = 0; i < this.selectedObjects.length; i++ ) {

            var selectedObject = this.selectedObjects[ i ];
            selectedObject.traverse( gatherSelectedMeshesCallBack );

        }

        function VisibilityChangeCallBack( object ) {

            if ( object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE
                .Sprite ) {

                var bFound = false;

                for ( var i = 0; i < selectedMeshes.length; i++ ) {

                    var selectedObjectId = selectedMeshes[ i ].id;

                    if ( selectedObjectId === object.id ) {

                        bFound = true;
                        break;

                    }

                }

                if ( !bFound ) {

                    var visibility = object.visible;

                    if ( !bVisible || object.bVisible ) object.visible = bVisible;

                    object.bVisible = visibility;

                }

            }

        }

        this.renderScene.traverse( VisibilityChangeCallBack );

    },

    updateTextureMatrix: function () {

        this.textureMatrix.set( 0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0 );
        this.textureMatrix.multiply( this.renderCamera.projectionMatrix );
        this.textureMatrix.multiply( this.renderCamera.matrixWorldInverse );

    },

    render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

        if ( this.selectedObjects.length === 0 ) return;

        this.oldClearColor.copy( renderer.getClearColor() );
        this.oldClearAlpha = renderer.getClearAlpha();
        var oldAutoClear = renderer.autoClear;

        renderer.autoClear = false;

        if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

        renderer.setClearColor( 0xffffff, 1 );

        // Make selected objects invisible
        this.changeVisibilityOfSelectedObjects( false );

        var currentBackground = this.renderScene.background;
        this.renderScene.background = null;

        // 1. Draw Non Selected objects in the depth buffer
        this.renderScene.overrideMaterial = this.depthMaterial;
        renderer.render( this.renderScene, this.renderCamera, this.renderTargetDepthBuffer,
            true );

        // Make selected objects visible
        this.changeVisibilityOfSelectedObjects( true );

        // Update Texture Matrix for Depth compare
        this.updateTextureMatrix();

        // Make non selected objects invisible, and draw only the selected objects, by comparing the depth buffer of non selected objects
        this.changeVisibilityOfNonSelectedObjects( false );
        this.renderScene.overrideMaterial = this.prepareMaskMaterial;
        this.prepareMaskMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2(
            this.renderCamera.near, this.renderCamera.far );
        this.prepareMaskMaterial.uniforms[ "depthTexture" ].value = this.renderTargetDepthBuffer
            .texture;
        this.prepareMaskMaterial.uniforms[ "textureMatrix" ].value = this.textureMatrix;
        renderer.render( this.renderScene, this.renderCamera, this.renderTargetMaskBuffer,
            true );
        this.renderScene.overrideMaterial = null;
        this.changeVisibilityOfNonSelectedObjects( true );

        this.renderScene.background = currentBackground;

        // 2. Downsample to Half resolution
        this.quad.material = this.materialCopy;
        this.copyUniforms[ "tDiffuse" ].value = this.renderTargetMaskBuffer.texture;
        renderer.render( this.scene, this.camera, this.renderTargetMaskDownSampleBuffer,
            true );

        //this.tempPulseColor1.copy( this.visibleEdgeColor );
        //this.tempPulseColor2.copy( this.hiddenEdgeColor );

        if ( this.pulsePeriod > 0 ) {

            var scalar = ( 1 + 0.25 ) / 2 + Math.cos( performance.now() * 0.01 / this.pulsePeriod ) *
                ( 1.0 - 0.25 ) / 2;
          	this.pulseWeight = scalar;
            //this.tempPulseColor1.multiplyScalar( scalar );
            //this.tempPulseColor2.multiplyScalar( scalar );

        }

        // 3. Apply Edge Detection Pass
        this.quad.material = this.edgeDetectionMaterial;
        this.edgeDetectionMaterial.uniforms[ "maskTexture" ].value = this.renderTargetMaskDownSampleBuffer
            .texture;
        this.edgeDetectionMaterial.uniforms[ "texSize" ].value = new THREE.Vector2(
            this.renderTargetMaskDownSampleBuffer.width, this.renderTargetMaskDownSampleBuffer
            .height );
        this.edgeDetectionMaterial.uniforms[ "visibleEdgeColor" ].value = this.visibleEdgeColor;
        this.edgeDetectionMaterial.uniforms[ "hiddenEdgeColor" ].value = this.hiddenEdgeColor;
        renderer.render( this.scene, this.camera, this.renderTargetEdgeBuffer1, true );

        // 4. Apply Blur on Half res
        this.quad.material = this.separableBlurMaterial1;
        this.separableBlurMaterial1.uniforms[ "colorTexture" ].value = this.renderTargetEdgeBuffer1
            .texture;
        this.separableBlurMaterial1.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionX;
        this.separableBlurMaterial1.uniforms[ "kernelRadius" ].value = this.edgeThickness;
        renderer.render( this.scene, this.camera, this.renderTargetBlurBuffer1, true );
        this.separableBlurMaterial1.uniforms[ "colorTexture" ].value = this.renderTargetBlurBuffer1
            .texture;
        this.separableBlurMaterial1.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionY;
        renderer.render( this.scene, this.camera, this.renderTargetEdgeBuffer1, true );

        // Apply Blur on quarter res
        this.quad.material = this.separableBlurMaterial2;
        this.separableBlurMaterial2.uniforms[ "colorTexture" ].value = this.renderTargetEdgeBuffer1
            .texture;
        this.separableBlurMaterial2.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionX;
        renderer.render( this.scene, this.camera, this.renderTargetBlurBuffer2, true );
        this.separableBlurMaterial2.uniforms[ "colorTexture" ].value = this.renderTargetBlurBuffer2
            .texture;
        this.separableBlurMaterial2.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionY;
        renderer.render( this.scene, this.camera, this.renderTargetEdgeBuffer2, true );

        // Blend it additively over the input texture
        this.quad.material = this.overlayMaterial;
        this.overlayMaterial.uniforms[ "maskTexture" ].value = this.renderTargetMaskBuffer
            .texture;
        this.overlayMaterial.uniforms[ "edgeTexture1" ].value = this.renderTargetEdgeBuffer1
            .texture;
        this.overlayMaterial.uniforms[ "edgeTexture2" ].value = this.renderTargetEdgeBuffer2
            .texture;
        this.overlayMaterial.uniforms[ "patternTexture" ].value = this.patternTexture;
        this.overlayMaterial.uniforms[ "edgeStrength" ].value = this.edgeStrength;
        this.overlayMaterial.uniforms[ "edgeGlow" ].value = this.edgeGlow;
        this.overlayMaterial.uniforms[ "usePatternTexture" ].value = this.usePatternTexture;
        this.overlayMaterial.uniforms[ "visibleEdgeColor" ].value = this.visibleEdgeColor;
        this.overlayMaterial.uniforms[ "hiddenEdgeColor" ].value = this.hiddenEdgeColor;
        this.overlayMaterial.uniforms[ "pulseWeight" ].value = this.pulseWeight;
        

        if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

        renderer.render( this.scene, this.camera, readBuffer, false );

        renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
        renderer.autoClear = oldAutoClear;

    },

    getPrepareMaskMaterial: function () {

        return new THREE.ShaderMaterial( {

            uniforms: {
                "depthTexture": {
                    value: null
                },
                "cameraNearFar": {
                    value: new THREE.Vector2( 0.5, 0.5 )
                },
                "textureMatrix": {
                    value: new THREE.Matrix4()
                }
            },

            vertexShader: "varying vec2 vUv;\
				varying vec4 projTexCoord;\
				varying vec4 vPosition;\
				uniform mat4 textureMatrix;\
				void main() {\
					vUv = uv;\
					vPosition = modelViewMatrix * vec4( position, 1.0 );\
					vec4 worldPosition = modelMatrix * vec4( position, 1.0 );\
					projTexCoord = textureMatrix * worldPosition;\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

            fragmentShader: "#include <packing>\
				varying vec2 vUv;\
				varying vec4 vPosition;\
				varying vec4 projTexCoord;\
				uniform sampler2D depthTexture;\
				uniform vec2 cameraNearFar;\
				\
				void main() {\
					float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));\
					float viewZ = -perspectiveDepthToViewZ( depth, cameraNearFar.x, cameraNearFar.y );\
					float depthTest = (-vPosition.z > viewZ) ? 1.0 : 0.0;\
					gl_FragColor = vec4(0.0, depthTest, 1.0, 1.0);\
				}"
        } );

    },

    getEdgeDetectionMaterial: function () {

        return new THREE.ShaderMaterial( {

            uniforms: {
                "maskTexture": {
                    value: null
                },
                "texSize": {
                    value: new THREE.Vector2( 0.5, 0.5 )
                },
                "visibleEdgeColor": {
                    value: new THREE.Vector3( 1.0, 1.0, 1.0 )
                },
                "hiddenEdgeColor": {
                    value: new THREE.Vector3( 1.0, 1.0, 1.0 )
                },
            },

            vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

            fragmentShader: "varying vec2 vUv;\
				uniform sampler2D maskTexture;\
				uniform vec2 texSize;\
				uniform vec3 visibleEdgeColor;\
				uniform vec3 hiddenEdgeColor;\
				\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);\
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);\
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);\
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);\
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);\
					float diff1 = (c1.r - c2.r)*0.5;\
					float diff2 = (c3.r - c4.r)*0.5;\
					float d = length( vec2(diff1, diff2) );\
					float a1 = min(c1.g, c2.g);\
					float a2 = min(c3.g, c4.g);\
					float visibilityFactor = min(a1, a2);\
					vec3 visible = vec3(1.0, 0.0, 0.0);\
					vec3 hidden = vec3(0.0, 1.0, 0.0);\
					vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visible : hidden;\
					gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);\
				}"
        } );

    },

    getSeperableBlurMaterial: function ( maxRadius ) {

        return new THREE.ShaderMaterial( {

            defines: {
                "MAX_RADIUS": maxRadius,
            },

            uniforms: {
                "colorTexture": {
                    value: null
                },
                "texSize": {
                    value: new THREE.Vector2( 0.5, 0.5 )
                },
                "direction": {
                    value: new THREE.Vector2( 0.5, 0.5 )
                },
                "kernelRadius": {
                    value: 1.0
                }
            },

            vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

            fragmentShader: "#include <common>\
				varying vec2 vUv;\
				uniform sampler2D colorTexture;\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				uniform float kernelRadius;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\
					vec2 invSize = 1.0 / texSize;\
					float weightSum = gaussianPdf(0.0, kernelRadius);\
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
					vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);\
					vec2 uvOffset = delta;\
					for( int i = 1; i <= MAX_RADIUS; i ++ ) {\
						float w = gaussianPdf(uvOffset.x, kernelRadius);\
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
						diffuseSum += ((sample1 + sample2) * w);\
						weightSum += (2.0 * w);\
						uvOffset += delta;\
					}\
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\
				}"
        } );

    },

    getOverlayMaterial: function () {

        return new THREE.ShaderMaterial( {

            uniforms: {
                "maskTexture": {
                    value: null
                },
                "edgeTexture1": {
                    value: null
                },
                "edgeTexture2": {
                    value: null
                },
                "patternTexture": {
                    value: null
                },
                "edgeStrength": {
                    value: 1.0
                },
                "edgeGlow": {
                    value: 1.0
                },
                "usePatternTexture": {
                    value: 0.0
                },
                "visibleEdgeColor": {
                    value: new THREE.Vector3( 1.0, 1.0, 1.0 )
                },
                "hiddenEdgeColor": {
                    value: new THREE.Vector3( 1.0, 1.0, 1.0 )
                },
                "pulseWeight": {
                  	value: 1.0
                }
            },

            vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

            fragmentShader: "varying vec2 vUv;\
				uniform sampler2D maskTexture;\
				uniform sampler2D edgeTexture1;\
				uniform sampler2D edgeTexture2;\
				uniform sampler2D patternTexture;\
				uniform float edgeStrength;\
				uniform float edgeGlow;\
				uniform bool usePatternTexture;\
				uniform vec3 visibleEdgeColor;\
				uniform vec3 hiddenEdgeColor;\
        uniform float pulseWeight;\
				\
				void main() {\
					vec4 edgeValue1 = texture2D(edgeTexture1, vUv);\
					vec4 edgeValue2 = texture2D(edgeTexture2, vUv);\
					vec4 maskColor = texture2D(maskTexture, vUv);\
					vec4 patternColor = texture2D(patternTexture, 6.0 * vUv);\
          float visibilityFactor = 1.0 - maskColor.g > 0.0 ? 1.0 : 0.5;\
					vec4 edgeValue = edgeValue1 + edgeValue2 * edgeGlow;\
					vec4 colorWeights = edgeStrength * maskColor.r * edgeValue;\
					float alpha = (colorWeights.r + colorWeights.g) * pulseWeight;\
          float norm = 0.0;\
					if (alpha!=0.0)\
						norm = 1.0 / alpha;\
					vec3 visiblePart = visibleEdgeColor * norm * colorWeights.r;\
					vec3 hiddenPart = hiddenEdgeColor * norm * colorWeights.g;\
					vec4 finalColor = vec4(visiblePart+hiddenPart, alpha);\
          if(usePatternTexture)\
						finalColor += + visibilityFactor * (1.0 - maskColor.r) * (1.0 - patternColor.r);\
					gl_FragColor = finalColor;\
				}",
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            transparent: true
        } );

    }

} );

THREE.OutlinePass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
THREE.OutlinePass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

THREE.MaskPass = function ( scene, camera ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.clear = true;
	this.needsSwap = false;

	this.inverse = false;

};

THREE.MaskPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.MaskPass,

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		var context = renderer.context;
		var state = renderer.state;

		// don't update color or depth

		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( false );

		// lock buffers

		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );

		// set up stencil

		var writeValue, clearValue;

		if ( this.inverse ) {

			writeValue = 0;
			clearValue = 1;

		} else {

			writeValue = 1;
			clearValue = 0;

		}

		state.buffers.stencil.setTest( true );
		state.buffers.stencil.setOp( context.REPLACE, context.REPLACE, context.REPLACE );
		state.buffers.stencil.setFunc( context.ALWAYS, writeValue, 0xffffffff );
		state.buffers.stencil.setClear( clearValue );

		// draw into the stencil buffer

		renderer.setRenderTarget( readBuffer );
		if ( this.clear ) renderer.clear();
		renderer.render( this.scene, this.camera );

		renderer.setRenderTarget( writeBuffer );
		if ( this.clear ) renderer.clear();
		renderer.render( this.scene, this.camera );

		// unlock color and depth buffer for subsequent rendering

		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );

		// only render where stencil is set to 1

		state.buffers.stencil.setFunc( context.EQUAL, 1, 0xffffffff ); // draw if == 1
		state.buffers.stencil.setOp( context.KEEP, context.KEEP, context.KEEP );

	}

} );


THREE.ClearMaskPass = function () {

	THREE.Pass.call( this );

	this.needsSwap = false;

};

THREE.ClearMaskPass.prototype = Object.create( THREE.Pass.prototype );

Object.assign( THREE.ClearMaskPass.prototype, {

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		renderer.state.buffers.stencil.setTest( false );

	}

} );

exports.CopyShader = THREE.CopyShader;
exports.EffectComposer = THREE.EffectComposer;
exports.RenderPass = THREE.RenderPass;
exports.OutlinePass = THREE.OutlinePass;
exports.ShaderPass = THREE.ShaderPass;
exports.MaskPass = THREE.MaskPass;
exports.ClearMaskPass = THREE.ClearMaskPass;



