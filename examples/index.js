import * as THREE from "three"
import {RenderPass,EffectComposer,OutlinePass} from "three-outlinepass"
import * as OrbitControls from "three-orbitcontrols"

function init() {
    var scene, camera, renderer, light, controls, compose, renderPass;
    var outlinePass;
    var clock = new THREE.Clock();
    var selectedObjects = [];
    drawScene();

    function drawScene() {
        iniScene();
        iniLight();
        orbitControls();
        windowResize();        
        selectedObjects.push(cubeDr(4, 0, 2, 0));
        selectedObjects.push(cubeDr(4, 5, 2, 0));
        selectedObjects.push(cubeDr(4, -4, 2, 0));
        cubeDr(4, 0, 6, 0);
        iniPlane();
        render();
    }

    function iniScene() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
        renderer = new THREE.WebGLRenderer({alpha: true});
        camera.position.set(-10, 10, 30);
        camera.lookAt(scene.position);
        renderer.setClearColor(0x222222,.0);
        renderer.shadowMap.enabled = true;

        renderer.setSize(window.innerWidth, window.innerHeight);
        compose = new EffectComposer(renderer);
        renderPass = new RenderPass(scene, camera);
       
        outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth,window.innerHeight),scene,camera);
        outlinePass.renderToScreen = true;
        outlinePass.selectedObjects = selectedObjects;

        compose.addPass(renderPass);
        compose.addPass(outlinePass);

        var params = {
            edgeStrength: 3.0,
            edgeGlow: 1,
            edgeThickness: 1.0,
            pulsePeriod: 0,
            usePatternTexture: false
        };
        outlinePass.edgeStrength = params.edgeStrength;
        outlinePass.edgeGlow = params.edgeGlow;
        outlinePass.visibleEdgeColor.set(0xffffff);
        outlinePass.hiddenEdgeColor.set(0xff00ff);

        scene.add(new THREE.AxesHelper(4));
        let dom = document.createElement('div');
        dom.style.backgroundColor = 'cadetblue';
        document.body.appendChild(dom)
        dom.appendChild(renderer.domElement);
    }

    function iniLight() {
        light = new THREE.AmbientLight(0x333333);
        scene.add(light);

        light = new THREE.SpotLight(0x888888);
        light.position.set(0, 40, 30);
        light.castShadow = true;
        light.shadow.mapSize.height = 4096;
        light.shadow.mapSize.width = 4096;
        scene.add(light);

        light = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        light.position.set(0, 200, 0);
        scene.add(light);
    }

    function iniPlane() {
        var planeGeo = new THREE.PlaneGeometry(40, 40);
        var planeMat = new THREE.MeshPhongMaterial({ color: 0x999999 });
        var plane = new THREE.Mesh(planeGeo, planeMat);
        plane.receiveShadow = true;
        plane.position.y = -0.01;
        plane.rotation.x = -0.5 * Math.PI;
        scene.add(plane);

        var grid = new THREE.GridHelper(40, 20, 0x000000, 0x000000);
        grid.material.transparent = true;
        grid.material.opacity = 0.3;
        scene.add(grid);
    }

    function cubeDr(a, x, y, z) {
        var cubeGeo = new THREE.BoxGeometry(a, a, a);
        var cubeMat = new THREE.MeshPhongMaterial({
            color: 0xfff000 * Math.random()
        });
        var cube = new THREE.Mesh(cubeGeo, cubeMat);
        cube.position.set(x, y, z);
        cube.castShadow = true;
        scene.add(cube);
        return cube;
    }
    
    function orbitControls() {
        controls = new OrbitControls(camera, renderer.domElement);     
        controls.autoRotateSpeed = 0.2;
        controls.enableDamping = true;
        controls.dampingFactor = 0.4;
        controls.enableZoom = true;
        controls.minDistance = 5;
        controls.maxDistance = 1000;
    }
  
    function windowResize() {
        window.addEventListener('resize', onWindowResize, false);
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    function render() {
        var delta = clock.getDelta();
        requestAnimationFrame(render);
        //renderer.render(scene, camera);
        compose.render(delta);
        controls.update(delta);
    }   
}
window.onload = init;
