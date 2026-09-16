import * as THREE from 'three';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8e8);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
camera.position.set(0, 4, -6);
camera.lookAt(0, 1, 10);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.5);
sun.position.set(-30, 40, 20);
scene.add(sun, new THREE.HemisphereLight(0xbfd9f2, 0x5d944f, 0.9));
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshLambertMaterial({ color: 0x5d944f }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = 120;
scene.add(ground);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
