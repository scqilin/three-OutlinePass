# three.js OutlinePass
> is the three.js OutlinePass from [official examples](https://threejs.org/examples/?q=outlin#webgl_postprocessing_outline)

# Installation
To install with npm do

    npm install three
    npm install three-outlinepass

# Usage

three.js - Outline Pass,I have just clone the code and modified to export it as a module so you can do something like

```javascript
import * as THREE from "three"
import { RenderPass, EffectComposer, OutlinePass } from "three-outlinepass"


var compose = new EffectComposer(renderer, undefined);
var selectedObjects = []
var renderPass = new RenderPass(scene, camera, undefined, undefined, undefined);
var outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera, selectedObjects);
outlinePass.renderToScreen = true;
outlinePass.selectedObjects = selectedObjects;

compose.addPass(renderPass);

compose.addPass(outlinePass);
var params = {
    edgeStrength: 2,
    edgeGlow: 1,
    edgeThickness: 1.0,
    pulsePeriod: 0,
    usePatternTexture: false
};

outlinePass.edgeStrength = params.edgeStrength;
outlinePass.edgeGlow = params.edgeGlow;
outlinePass.visibleEdgeColor.set(0xffffff);
outlinePass.hiddenEdgeColor.set(0xffffff);

compose.render(scene, camera)   
```


**See also example**
[code]()
[demo]()

The code also works in typescript.
